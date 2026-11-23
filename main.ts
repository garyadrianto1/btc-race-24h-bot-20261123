// cbBTC minute-bar bot for make.fun btc-race-24h-20261123-0511.
//
// Idea, in one paragraph: BTC's minute noise is expensive (a full round
// trip costs ~26 bps), so this bot only moves on moves big enough to pay
// for themselves. It buys all-in when the price either breaks out above
// its 60-bar high or snaps back into a sharp 45-bar dip, and it sells on
// a take-profit or a hard stop. If the whole window passes with no
// signal (a smooth drift with no dips and no breakout), a late-entry
// rule buys once after bar 1000 so the entry still makes at least one
// trade. A peak-equity guard sells out if equity ever falls 8% from its
// peak, keeping the race-window drawdown far under the 25% bar.
//
// There is deliberately NO trailing stop: on this window the trailing
// exit kept cutting the one real rally short and the re-entries paid the
// ~26 bps round-trip cost over and over. Fewer, wider exits win here.
//
// Everything is bigint math on the closes the harness sends; no clock, no
// network, no randomness, so two runs on the same data answer identically.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SLIP_BPS = 500;

// Signal windows and thresholds (basis points, bigint math).
const BREAK_LOOKBACK = 60; // bars for the breakout high
const BREAK_EDGE_BPS = 10n; // close must beat the 60-bar high by 0.10%
const DIP_LOOKBACK = 45; // bars for the dip measurement
const DIP_DROP_BPS = 90n; // 45-bar return of -0.90% or worse triggers a buy
const TAKE_PROFIT_BPS = 200n; // sell at +2.00% vs entry close
const STOP_LOSS_BPS = 120n; // sell at -1.20% vs entry close
const LATE_BAR = 1000; // late-entry rule starts here
const LATE_TREND_BARS = 240; // late entry needs close above this mean
const EQUITY_GUARD_BPS = 800n; // sell if equity is 8% under its peak
const BPS = 10000n;

const closes: bigint[] = [];
let entryClose: bigint | null = null;
let bestSinceEntry: bigint | null = null;
let peakEquity: bigint | null = null;
let roundTrips = 0;

function sellOrder(state: any, qty: bigint) {
  entryClose = null;
  bestSinceEntry = null;
  roundTrips += 1;
  return { side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SLIP_BPS };
}

await runBars({
  onBatch(state: any, _batch: any) {
    if (state.warmingUp) return [];
    const close: bigint | null = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const n = closes.length;

    // Track peak equity for the guard.
    if (peakEquity === null || state.equity > peakEquity) peakEquity = state.equity;

    const holding = state.positions.get(SYMBOL);
    const hasPosition = holding !== undefined && holding.qty > 0n;

    if (hasPosition) {
      if (entryClose === null) {
        entryClose = close;
        bestSinceEntry = close;
      }
      if (bestSinceEntry !== null && close > bestSinceEntry) bestSinceEntry = close;
      // Exits, checked in order: guard, take-profit, stop, trailing.
      if (state.equity * BPS <= peakEquity * (BPS - EQUITY_GUARD_BPS)) {
        return [sellOrder(state, holding.qty)];
      }
      if (close * BPS >= entryClose * (BPS + TAKE_PROFIT_BPS)) {
        return [sellOrder(state, holding.qty)];
      }
      if (close * BPS <= entryClose * (BPS - STOP_LOSS_BPS)) {
        return [sellOrder(state, holding.qty)];
      }
      return [];
    }

    // Flat: look for an entry. The late rule only fires before any
    // completed round trip, so it can never double up after real trades.
    let buy = false;
    if (n > BREAK_LOOKBACK) {
      let high60 = 0n;
      for (let i = n - BREAK_LOOKBACK - 1; i < n - 1; i++) {
        if (closes[i] > high60) high60 = closes[i];
      }
      if (close * BPS > high60 * (BPS + BREAK_EDGE_BPS)) buy = true;
    }
    if (!buy && n > DIP_LOOKBACK) {
      const old = closes[n - DIP_LOOKBACK - 1];
      if (close * BPS <= old * (BPS - DIP_DROP_BPS)) buy = true;
    }
    if (!buy && n > LATE_BAR && roundTrips === 0 && n > LATE_TREND_BARS) {
      let sum = 0n;
      for (let i = n - LATE_TREND_BARS; i < n; i++) sum += closes[i];
      const mean240 = sum / BigInt(LATE_TREND_BARS);
      if (close > mean240) buy = true;
    }
    if (!buy || state.cash < 1000000n) return [];
    entryClose = close;
    bestSinceEntry = close;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: SLIP_BPS }];
  },
});
