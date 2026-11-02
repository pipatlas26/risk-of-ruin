/**
 * risk-of-ruin.js — Monte Carlo risk-of-ruin & drawdown-breach simulator.
 *
 * Dependency-free. Runs in Node (>=14) or any modern browser.
 * Deterministic when a seed is supplied (mulberry32 PRNG).
 *
 * MIT © 2026 PipAtlas — https://pipatlas.com/tools/risk-of-ruin
 *
 * Model (stated plainly, because the model IS the product):
 *   - Fixed-fractional sizing: riskPct of current equity is risked per trade.
 *   - Each trade wins with probability `winRate` and pays `avgWinR` (in R,
 *     where 1 R = the amount risked), or loses exactly 1 R.
 *   - Trades are independent and the edge is constant. That is an
 *     approximation: real strategies cluster losses. Expect live drawdowns
 *     to be slightly deeper than the model says.
 *   - "Ruin" = equity falls `ruinThreshold` below its running peak
 *     (the way funded-account / personal drawdown limits work).
 */

'use strict';

/** mulberry32 — small, fast, seedable PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} opts
 * @param {number} [opts.winRate=0.5]        probability of a winning trade (0..1)
 * @param {number} [opts.avgWinR=1.5]        average win size in R (e.g. 1.5 = 1.5x risk)
 * @param {number} [opts.riskPct=0.01]       fraction of equity risked per trade (0.01 = 1%)
 * @param {number} [opts.trades=200]         trades simulated per run
 * @param {number} [opts.ruinThreshold=0.30] ruin = this drawdown from peak (0.30 = 30%)
 * @param {number} [opts.runs=10000]         number of Monte Carlo runs
 * @param {number} [opts.seed=null]          optional seed for reproducible output
 * @returns {object} statistics
 */
function runRiskOfRuin(opts = {}) {
  const winRate = clamp(num(opts.winRate, 0.5), 0.001, 0.999);
  const avgWinR = clamp(num(opts.avgWinR, 1.5), 0.05, 50);
  const riskPct = clamp(num(opts.riskPct, 0.01), 0.0005, 0.5);
  const trades = Math.max(1, Math.round(num(opts.trades, 200)));
  const ruinThreshold = clamp(num(opts.ruinThreshold, 0.3), 0.01, 0.99);
  const runs = Math.max(100, Math.round(num(opts.runs, 10000)));
  const rand = opts.seed == null ? Math.random : mulberry32(opts.seed);

  let ruined = 0;
  let ahead = 0;
  let longestStreak = 0;
  let worstDrawdown = 0;
  let totalFinal = 0;
  const finals = [];

  for (let r = 0; r < runs; r++) {
    let equity = 1;
    let peak = 1;
    let streak = 0;
    let dead = false;

    for (let t = 0; t < trades; t++) {
      if (rand() < winRate) {
        equity *= 1 + riskPct * avgWinR;
        streak = 0;
      } else {
        equity *= 1 - riskPct;
        streak++;
        if (streak > longestStreak) longestStreak = streak;
      }
      if (equity > peak) peak = equity;
      const dd = 1 - equity / peak;
      if (dd > worstDrawdown) worstDrawdown = dd;
      if (dd >= ruinThreshold) {
        ruined++;
        dead = true;
        break;
      }
    }

    if (!dead) {
      finals.push(equity);
      totalFinal += equity;
      if (equity > 1) ahead++;
    }
  }

  finals.sort((x, y) => x - y);
  const median = finals.length ? finals[(finals.length / 2) | 0] : 0;

  return {
    runs,
    trades,
    riskOfRuin: ruined / runs,
    finishedAhead: ahead / runs,
    expectancyR: winRate * avgWinR - (1 - winRate), // in R per trade
    medianFinalEquity: median,                       // 1 = break-even
    meanFinalEquity: (totalFinal + (runs - finals.length) * 0) / runs,
    longestLosingStreak: longestStreak,
    worstDrawdown,
    survivors: finals.length,
  };
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* ------------------------------ CLI ------------------------------ */
if (typeof require !== 'undefined' && require.main === module) {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = /^--([\w-]+)=(.*)$/.exec(a);
    if (m) args[m[1]] = m[2];
  });
  const out = runRiskOfRuin({
    winRate: num(args.wr, 50) / 100,
    avgWinR: num(args.rr, 1.5),
    riskPct: num(args.risk, 1) / 100,
    trades: num(args.trades, 200),
    ruinThreshold: num(args.ruin, 30) / 100,
    runs: num(args.runs, 10000),
    seed: args.seed == null ? null : num(args.seed, 1),
  });
  const pct = (x) => (x * 100).toFixed(2) + '%';
  console.log('PipAtlas risk-of-ruin — ' + out.runs + ' runs x ' + out.trades + ' trades');
  console.log('  risk of ruin      : ' + pct(out.riskOfRuin));
  console.log('  finished ahead    : ' + pct(out.finishedAhead));
  console.log('  expectancy        : ' + out.expectancyR.toFixed(3) + ' R per trade');
  console.log('  median final equity: ' + (out.medianFinalEquity * 100).toFixed(1) + '% of start');
  console.log('  longest losing streak seen: ' + out.longestLosingStreak);
  console.log('  worst drawdown    : ' + pct(out.worstDrawdown));
}

module.exports = { runRiskOfRuin, mulberry32 };
