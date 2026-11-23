[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/garyadrianto1/btc-race-24h-bot-20261123/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/garyadrianto1/btc-race-24h-bot-20261123/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

# BTC race bot — make.fun btc-race-24h-20261123-0511

A cbBTC minute-bar trading bot for the [make.fun bounty](https://make.fun/bounty/btc-race-24h-20261123-0511): race a BTC trading bot live for 24 hours, starting with $1,000 of paper money.

## Strategy

Minute noise is expensive (a full round trip costs ~26 bps in fees, slippage and price impact), so the bot only moves on moves big enough to pay for themselves:

- **Buy all-in** when the price breaks out above its 60-bar high (+0.10% edge), or snaps into a sharp 45-bar dip (-0.90% or worse).
- **Sell** at +2.00% take-profit or -1.20% hard stop vs the entry close.
- **Late entry:** if no round trip has completed by bar 1000 and the close sits above its 240-bar mean, buy once, so the entry still makes at least one trade in a smooth drift window.
- **Equity guard:** sell out if equity falls 8% under its peak (race drawdown bar is 25%).
- **No trailing stop** — on the dev window it kept cutting the one real rally short and the re-entries paid the round-trip cost over and over.

All decisions are bigint math on the closes the harness sends. No clock, no network, no randomness: two runs on the same data answer identically.

## Run

```sh
node main.ts
```

Node 22, standard library only (plus the vendored `vendor/makefun-bars.ts` shim from the kit). The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout.

## Dev grade (local, kit harness, `--driver process`)

- Net PnL: **+$20.50** on the dev window (gate: > $0)
- Trades: 3 · max drawdown: 1.98% · win rate: 100%
