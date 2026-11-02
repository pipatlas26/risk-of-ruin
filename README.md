# risk-of-ruin

Monte Carlo **risk-of-ruin and drawdown-breach simulator** for fixed-fractional trading systems. Dependency-free, deterministic with a seed, ~120 lines.

Part of the free [PipAtlas](https://pipatlas.com) trading toolkit — education only, never financial advice.

[![tests](https://img.shields.io/badge/tests-8%20passing-brightgreen)](test.js) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)

**Live version (no install):** [pipatlas.com/tools/risk-of-ruin](https://pipatlas.com/tools/risk-of-ruin)


## Why this exists

Most "risk of ruin" calculators are black boxes. This one is a file you can read in a minute, with the model stated in the header. If you disagree with an assumption, change the line and rerun it.

The model:

- Fixed-fractional sizing — `riskPct` of current equity risked per trade.
- Each trade wins with probability `winRate`, paying `avgWinR` (in R, where 1 R = the amount risked), or loses exactly 1 R.
- Trades are independent with a constant edge. **This is an approximation** — real strategies cluster losses (news weeks, regime shifts). Expect live drawdowns to come in slightly deeper than the model says.
- "Ruin" = equity falls `ruinThreshold` below its running peak, the way a funded-account or personal max-drawdown limit actually works.

## Use it

```bash
# Node >= 14, zero dependencies — no install needed
node risk-of-ruin.js --wr=50 --rr=1.5 --risk=1 --trades=200 --ruin=30 --seed=42
```

```
PipAtlas risk-of-ruin — 10000 runs x 200 trades
  risk of ruin      : 0.01%
  finished ahead    : 99.68%
  expectancy        : 0.250 R per trade
  median final equity: 162.2% of start
  longest losing streak seen: 22
  worst drawdown    : 30.67%
```

As a library:

```js
const { runRiskOfRuin } = require('./risk-of-ruin.js');

const out = runRiskOfRuin({
  winRate: 0.5,        // 50% win rate
  avgWinR: 1.5,        // winners average 1.5R
  riskPct: 0.01,       // risk 1% of equity per trade
  trades: 200,
  ruinThreshold: 0.30, // ruin = 30% drawdown from peak
  runs: 10000,
  seed: 42,            // omit for true randomness
});

console.log(out.riskOfRuin); // 0.0001
console.log(out.expectancyR); // 0.25
```

## Read the output honestly

| Field | Meaning |
|---|---|
| `riskOfRuin` | share of runs that touched the drawdown limit |
| `finishedAhead` | share of survivors ending above starting equity |
| `expectancyR` | `winRate × avgWinR − (1 − winRate)` — **must be positive first** |
| `medianFinalEquity` | middle survivor's final equity (1.0 = break-even) |
| `longestLosingStreak` | worst streak across all runs — size for *this*, not the average |
| `worstDrawdown` | deepest peak-to-trough seen in the sample |

Sampling noise with 10,000 runs is roughly ±0.5 percentage points on the headline ruin number. Two runs differing by more than a point means the inputs changed.

## Three findings worth internalising

1. **Expectancy first, size second.** A negative-expectancy system shows rising ruin no matter how small the risk — the simulation will tell you faster than your equity curve will.
2. **Losing streaks are longer than intuition.** Over 200 trades at a 50% win rate, the worst streak in a 10,000-run sample is typically **18–22 trades**. If your risk percentage makes a 20-loss streak intolerable, the risk is wrong — not the streak.
3. **Small risk percentages are not timidity.** At 1% risk a healthy edge barely touches its drawdown limit; at 5% the same edge ruins ~85% of the time in this model. The edge didn't change; the size did.

## Pair it with

- Web version with the same model: [pipatlas.com/tools/risk-of-ruin](https://pipatlas.com/tools/risk-of-ruin)
- Position size calculator (risk % → lot size): [pipatlas.com/tools/position-size-calculator](https://pipatlas.com/tools/position-size-calculator)
- Free R-based trade log to measure your *real* win rate before trusting it here: [pipatlas.com/files/magnets/pipatlas-trade-log.xlsx](https://pipatlas.com/files/magnets/pipatlas-trade-log.xlsx)
- Expectancy explained: [pipatlas.com/glossary/expectancy](https://pipatlas.com/glossary/expectancy)

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it inside your own journal or bot.


## Install as a dependency

```bash
npm install github:pipatlas/risk-of-ruin
```

```js
const { runRiskOfRuin } = require('risk-of-ruin');

const out = runRiskOfRuin({
  winRate: 0.5,        // 50% win rate
  avgWinR: 1.5,        // winners average 1.5R
  riskPct: 0.01,       // 1% of current equity per trade
  trades: 200,
  runs: 20000,
  ruinThreshold: 0.5,  // ruin = equity 50% below its running peak
  seed: 42             // deterministic; omit for a random seed
});
```

## Tests

```bash
node test.js     # or: npm test
```

Eight checks, no test framework: seed determinism, seed sensitivity inside sampling noise,
risk monotonicity, negative-expectancy punishment, expectancy maths, output ranges,
PRNG reproducibility, and input clamping.

## What the numbers look like

20,000 runs, 200 trades, 50% win rate, winners at 1.5R (expectancy +0.25R):

| Risk per trade | Risk of ruin (50% drawdown) | Finished ahead |
|---|---|---|
| 1% | ~0.0% | 99.7% |
| 5% | ~15.8% | 84.2% |

Same strategy, same edge — the only difference is the size of each bet. That is the entire
argument for small risk per trade, and it is why this ships as code you can rerun rather
than a percentage on a poster.

## License

MIT — copy it, change it, ship it. See [LICENSE](LICENSE).
