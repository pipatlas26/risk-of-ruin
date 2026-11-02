'use strict';
/* Zero-dependency tests. Run: node test.js  (also what `npm test` does) */
const assert = require('assert');
const { runRiskOfRuin, mulberry32 } = require('./risk-of-ruin.js');

const base = { winRate: 0.5, avgWinR: 1.5, trades: 200, runs: 20000, ruinThreshold: 0.5, seed: 42 };

console.log('risk-of-ruin :: tests');

// 1. determinism — same seed, same answer
const a = runRiskOfRuin({ ...base, riskPct: 0.05 });
const b = runRiskOfRuin({ ...base, riskPct: 0.05 });
assert.deepStrictEqual(a, b, 'same seed must give identical results');
console.log('  ok  deterministic with a seed');

// 2. different seeds move the answer within sampling noise, not wildly
const c = runRiskOfRuin({ ...base, riskPct: 0.05, seed: 7 });
assert.ok(Math.abs(c.riskOfRuin - a.riskOfRuin) < 0.03, 'seed sensitivity should be small at 20k runs');
console.log('  ok  seed variation stays inside sampling noise');

// 3. risk per trade dominates ruin probability
const low = runRiskOfRuin({ ...base, riskPct: 0.01 });
const high = runRiskOfRuin({ ...base, riskPct: 0.05 });
assert.ok(high.riskOfRuin > low.riskOfRuin, 'higher risk must mean higher ruin probability');
assert.ok(low.riskOfRuin < 0.01, '1% risk with a 0.25R edge should almost never breach 50% drawdown');
console.log(`  ok  risk monotonicity (1% → ${(low.riskOfRuin * 100).toFixed(2)}%, 5% → ${(high.riskOfRuin * 100).toFixed(2)}%)`);

// 4. negative expectancy must be worse than no edge
const neg = runRiskOfRuin({ ...base, avgWinR: 0.8, riskPct: 0.02 });
const flat = runRiskOfRuin({ ...base, avgWinR: 1.0, riskPct: 0.02 });
assert.ok(neg.finishedAhead < 0.35, 'negative expectancy should mostly finish behind');
assert.ok(neg.riskOfRuin > flat.riskOfRuin, 'negative edge ruins more often than a flat one');
console.log('  ok  negative expectancy is punished');

// 5. expectancy maths is stated, not implied
const e = runRiskOfRuin({ ...base, riskPct: 0.01 });
assert.ok(Math.abs(e.expectancyR - 0.25) < 1e-9, 'expectancy = wr*avgWinR - (1-wr)');
console.log('  ok  expectancy calculated from inputs');

// 6. outputs are sane ranges
for (const k of ['riskOfRuin', 'finishedAhead', 'worstDrawdown']) {
  assert.ok(e[k] >= 0 && e[k] <= 1, k + ' must be a probability');
}
assert.ok(e.medianFinalEquity > 0, 'median equity must be positive');
assert.ok(Number.isInteger(e.longestLosingStreak) && e.longestLosingStreak >= 0, 'streak is a count');
console.log('  ok  all outputs inside valid ranges');

// 7. the PRNG itself
const r1 = mulberry32(123), r2 = mulberry32(123);
for (let i = 0; i < 1000; i++) assert.strictEqual(r1(), r2(), 'mulberry32 must be reproducible');
const mean = (() => { const r = mulberry32(9); let s = 0; for (let i = 0; i < 100000; i++) s += r(); return s / 100000; })();
assert.ok(Math.abs(mean - 0.5) < 0.01, 'PRNG should be roughly uniform');
console.log('  ok  mulberry32 reproducible and uniform');

// 8. input guards
const clamped = runRiskOfRuin({ winRate: 5, avgWinR: -2, riskPct: 99, trades: 0, runs: 1 });
assert.ok(Number.isFinite(clamped.riskOfRuin), 'nonsense inputs must not produce NaN');
console.log('  ok  hostile inputs are clamped, not fatal');

console.log('\nall tests passed');
