// Offline replay: run every strategy on many sub-windows of a fare grid and
// score each by regret against the true cheapest pair in that sub-window.

import { pairKey } from "./fare-grid.mjs";
import { STRATEGIES, createOracle } from "./strategies.mjs";

export function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const DURATION_RANGES = [
  [14, 14],
  [14, 17],
  [14, 21],
  [17, 21]
];

export function buildSubWindows(grid, { count, maxDays, minDays, seed }) {
  const random = createRandom(seed);
  const allDeparts = [...new Set(grid.pairs.map((pair) => pair.departDate))].sort();
  const windows = [];

  for (let attempt = 0; windows.length < count && attempt < count * 10; attempt += 1) {
    const length = Math.min(allDeparts.length, minDays + Math.floor(random() * (maxDays - minDays + 1)));
    const startIndex = Math.floor(random() * (allDeparts.length - length + 1));
    const departDates = allDeparts.slice(startIndex, startIndex + length);
    const [durationMin, durationMax] = DURATION_RANGES[Math.floor(random() * DURATION_RANGES.length)];
    const departSet = new Set(departDates);
    const pairs = grid.pairs.filter(
      (pair) => departSet.has(pair.departDate) && pair.durationDays >= durationMin && pair.durationDays <= durationMax
    );
    const prices = pairs.map((pair) => grid.rt[pairKey(pair.departDate, pair.returnDate)]?.price).filter(Number.isFinite);

    if (prices.length < pairs.length * 0.8 || prices.length === 0) continue;

    windows.push({
      departDates,
      durationMax,
      durationMin,
      pairs,
      returnDates: [...new Set(pairs.map((pair) => pair.returnDate))].sort(),
      trueMin: Math.min(...prices)
    });
  }

  return windows;
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
}

export function replayStrategies(grid, {
  budgets = [10, 20, 40, 80, 160],
  missingRate = 0.1,
  drift = 0.03,
  seeds = 3,
  strategyNames = Object.keys(STRATEGIES),
  windows
}) {
  const results = [];

  for (const name of strategyNames) {
    for (const budget of budgets) {
      const regrets = [];
      const loadsTo2 = [];

      for (const [windowIndex, window] of windows.entries()) {
        for (let seed = 0; seed < seeds; seed += 1) {
          const random = createRandom(1000 * windowIndex + seed + 17);
          const oracle = createOracle(grid, { budget: Math.min(budget, window.pairs.length * 2), drift, missingRate, random });
          STRATEGIES[name](oracle, window, random);
          const found = oracle.best()?.truePrice ?? null;
          const regret = found === null ? 1 : found / window.trueMin - 1;
          regrets.push(regret);
          const hit = oracle.trace.find((step) => step.best !== null && step.best <= window.trueMin * 1.02);
          loadsTo2.push(hit ? hit.loads : null);
        }
      }

      const hitLoads = loadsTo2.filter((value) => value !== null);
      results.push({
        budget,
        hit2: regrets.filter((regret) => regret <= 0.02).length / regrets.length,
        hit5: regrets.filter((regret) => regret <= 0.05).length / regrets.length,
        meanRegret: regrets.reduce((sum, value) => sum + value, 0) / regrets.length,
        medianLoadsTo2: hitLoads.length ? quantile(hitLoads, 0.5) : null,
        medianRegret: quantile(regrets, 0.5),
        p90Regret: quantile(regrets, 0.9),
        runs: regrets.length,
        strategy: name
      });
    }
  }

  return results;
}
