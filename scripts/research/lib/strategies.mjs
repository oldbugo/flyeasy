// Date-selection strategies as pure functions over an oracle, so the same
// code can be replayed offline against a fare grid and later ported into the
// app. Every oracle call costs one page load; a strategy may not exceed its
// budget. See docs/uplifts/2026-10-date-search-strategy/02-candidate-strategies.md.

import { pairKey } from "./fare-grid.mjs";
import { addDays } from "./periods.mjs";

// window: { pairs: [{ departDate, returnDate, durationDays }], departDates, returnDates }
export function createOracle(grid, { budget, missingRate = 0, random = Math.random, drift = 0 } = {}) {
  let loads = 0;
  const trace = [];
  let best = null;
  const seen = new Map();

  const noisy = (price) => (drift > 0 ? Math.round(price * (1 + drift * (random() * 2 - 1))) : price);
  const charge = () => {
    if (loads >= budget) return false;
    loads += 1;
    return true;
  };
  const dropped = () => missingRate > 0 && random() < missingRate;

  return {
    get loads() {
      return loads;
    },
    get remaining() {
      return budget - loads;
    },
    best: () => best,
    trace,
    seen,

    // Round-trip screen of one pair. Returns null when missing (unknown).
    screen(departDate, returnDate) {
      const key = pairKey(departDate, returnDate);
      if (seen.has(key)) return seen.get(key);
      if (!charge()) return undefined;
      const cell = grid.rt[key];
      const result = cell && !dropped() ? { airlineMinima: cell.airlineMinima, price: noisy(cell.price) } : null;
      seen.set(key, result);
      if (result && (!best || result.price < best.price)) {
        best = { departDate, price: result.price, returnDate, truePrice: cell.price };
      }
      trace.push({ best: best?.truePrice ?? null, loads });
      return result;
    },

    oneWay(direction, date) {
      if (!charge()) return undefined;
      const cell = (direction === "out" ? grid.out : grid.ret)[date];
      trace.push({ best: best?.truePrice ?? null, loads });
      return cell && !dropped() ? cell : null;
    },

    // One load returns the whole unverified calendar for a direction.
    calendar(direction) {
      if (!charge()) return undefined;
      trace.push({ best: best?.truePrice ?? null, loads });
      return direction === "out" ? grid.calendarOut : grid.calendarRet;
    }
  };
}

export function sampleEvenly(values, limit) {
  if (values.length <= limit) return [...values];
  if (limit <= 1) return [values[Math.floor(values.length / 2)]];
  const picked = [];
  const used = new Set();
  for (let index = 0; index < limit; index += 1) {
    const at = Math.round((index * (values.length - 1)) / (limit - 1));
    if (!used.has(at)) {
      used.add(at);
      picked.push(values[at]);
    }
  }
  return picked;
}

function weekdayOf(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

function screenInOrder(oracle, pairs) {
  for (const pair of pairs) {
    if (oracle.remaining <= 0) return;
    oracle.screen(pair.departDate, pair.returnDate);
  }
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

// Rank pairs by a score; unknown scores go last.
function rankPairs(pairs, scoreOf) {
  return pairs
    .map((pair) => ({ pair, score: scoreOf(pair) }))
    .sort((left, right) => (left.score ?? Number.POSITIVE_INFINITY) - (right.score ?? Number.POSITIVE_INFINITY))
    .map((entry) => entry.pair);
}

// Spend what is left screening untried pairs closest to the best so far.
function localSearch(oracle, window, { radius = 3 } = {}) {
  const pairSet = new Set(window.pairs.map((pair) => pairKey(pair.departDate, pair.returnDate)));
  let improved = true;
  while (improved && oracle.remaining > 0 && oracle.best()) {
    improved = false;
    const anchor = oracle.best();
    const neighbours = [];
    for (let dd = -radius; dd <= radius; dd += 1) {
      for (let rd = -radius; rd <= radius; rd += 1) {
        if (dd === 0 && rd === 0) continue;
        const departDate = addDays(anchor.departDate, dd);
        const returnDate = addDays(anchor.returnDate, rd);
        if (pairSet.has(pairKey(departDate, returnDate)) && !oracle.seen.has(pairKey(departDate, returnDate))) {
          neighbours.push({ departDate, distance: Math.abs(dd) + Math.abs(rd), returnDate });
        }
      }
    }
    neighbours.sort((left, right) => left.distance - right.distance);
    for (const neighbour of neighbours) {
      if (oracle.remaining <= 0) return;
      oracle.screen(neighbour.departDate, neighbour.returnDate);
      if (oracle.best() !== anchor) {
        improved = true;
        break;
      }
    }
  }
}

export const STRATEGIES = {
  // S1: today's baseline (evenly spaced over the flattened pair list).
  S1_even: (oracle, window) => screenInOrder(oracle, sampleEvenly(window.pairs, oracle.remaining)),

  // S1r: same, with a random offset so repeated runs cover new pairs.
  S1r_rotating: (oracle, window, random) => {
    const step = Math.max(1, window.pairs.length / Math.max(1, oracle.remaining));
    const offset = random() * step;
    const picked = [];
    for (let at = offset; at < window.pairs.length && picked.length < oracle.remaining; at += step) {
      picked.push(window.pairs[Math.floor(at)]);
    }
    screenInOrder(oracle, picked);
  },

  // S2: trusts the calendar for ranking, then screens the top pairs.
  S2_calendar: (oracle, window) => {
    const calendarOut = oracle.calendar("out") ?? {};
    const calendarRet = oracle.calendar("ret") ?? {};
    const outFill = median(window.departDates.map((date) => calendarOut[date]));
    const retFill = median(window.returnDates.map((date) => calendarRet[date]));
    const ranked = rankPairs(window.pairs, (pair) => {
      const outPrice = calendarOut[pair.departDate] ?? outFill;
      const retPrice = calendarRet[pair.returnDate] ?? retFill;
      return outPrice !== null && retPrice !== null ? outPrice + retPrice : null;
    });
    screenInOrder(oracle, ranked.slice(0, Math.max(0, oracle.remaining - 4)));
    localSearch(oracle, window, { radius: 1 });
  },

  // S3: one-way first, overall cheapest per day.
  S3_one_way: (oracle, window) => oneWayStrategy(oracle, window, { airlineAware: false }),

  // S3b: one-way first, scored per airline (same airline both ways).
  S3b_airline_one_way: (oracle, window) => oneWayStrategy(oracle, window, { airlineAware: true }),

  // S4w: start in the middle; weekly steps first, then daily steps.
  S4w_middle_pattern: (oracle, window) => {
    const pairSet = new Map(window.pairs.map((pair) => [pairKey(pair.departDate, pair.returnDate), pair]));
    const deps = window.departDates;
    const durations = [...new Set(window.pairs.map((pair) => pair.durationDays))].sort((a, b) => a - b);
    const starts = [0.5, 0.25, 0.75].map((fraction) => ({
      departDate: deps[Math.floor((deps.length - 1) * fraction)],
      durationDays: durations[Math.floor((durations.length - 1) / 2)]
    }));
    const price = (departDate, durationDays) => {
      const returnDate = addDays(departDate, durationDays);
      if (!pairSet.has(pairKey(departDate, returnDate))) return Number.POSITIVE_INFINITY;
      const result = oracle.screen(departDate, returnDate);
      return result?.price ?? Number.POSITIVE_INFINITY;
    };

    for (const start of starts) {
      if (oracle.remaining <= 0) return;
      let current = { ...start, price: price(start.departDate, start.durationDays) };
      for (const step of [7, 3, 1]) {
        let moved = true;
        while (moved && oracle.remaining > 0) {
          moved = false;
          const moves = [
            [step, 0],
            [-step, 0],
            [0, Math.min(step, 3)],
            [0, -Math.min(step, 3)]
          ];
          for (const [dd, dr] of moves) {
            if (oracle.remaining <= 0) break;
            const departDate = addDays(current.departDate, dd);
            const durationDays = current.durationDays + dr;
            const candidate = price(departDate, durationDays);
            if (candidate < current.price) {
              current = { departDate, durationDays, price: candidate };
              moved = true;
              break;
            }
          }
        }
      }
    }
  },

  // S5: balanced weekday x week design, additive model, screen predictions.
  S5_structured: (oracle, window) => {
    const designSize = Math.max(8, Math.floor(oracle.remaining * 0.55));
    const byCell = new Map();
    for (const pair of window.pairs) {
      const week = Math.floor(window.departDates.indexOf(pair.departDate) / 7);
      const cell = `${weekdayOf(pair.departDate)}_${weekdayOf(pair.returnDate)}_${week % 3}`;
      if (!byCell.has(cell)) byCell.set(cell, []);
      byCell.get(cell).push(pair);
    }
    const design = sampleEvenly(
      [...byCell.values()].map((pairs) => pairs[Math.floor(pairs.length / 2)]),
      designSize
    );
    screenInOrder(oracle, design);

    const observations = design
      .map((pair) => ({ pair, result: oracle.seen.get(pairKey(pair.departDate, pair.returnDate)) }))
      .filter((entry) => entry.result);
    const model = fitAdditiveModel(observations, window);
    const ranked = rankPairs(
      window.pairs.filter((pair) => !oracle.seen.has(pairKey(pair.departDate, pair.returnDate))),
      model
    );
    screenInOrder(oracle, ranked.slice(0, Math.max(0, oracle.remaining - 4)));
    localSearch(oracle, window, { radius: 1 });
  },

  // S8: one-way first (airline-aware), then local search around the best.
  S8_hybrid: (oracle, window) => {
    oneWayStrategy(oracle, window, { airlineAware: true, reserveForLocal: 0.25 });
    localSearch(oracle, window, { radius: 2 });
  }
};

function oneWayStrategy(oracle, window, { airlineAware, reserveForLocal = 0 }) {
  // Spend at most ~70% of the budget on one-way loads; sample dates evenly
  // when the window has more dates than that.
  const oneWayBudget = Math.floor(oracle.remaining * 0.7);
  const totalDates = window.departDates.length + window.returnDates.length;
  const share = Math.min(1, oneWayBudget / Math.max(1, totalDates));
  const outDates = sampleEvenly(window.departDates, Math.max(1, Math.floor(window.departDates.length * share)));
  const retDates = sampleEvenly(window.returnDates, Math.max(1, Math.floor(window.returnDates.length * share)));
  const outFares = {};
  const retFares = {};
  for (const date of outDates) outFares[date] = oracle.oneWay("out", date);
  for (const date of retDates) retFares[date] = oracle.oneWay("ret", date);

  // Unloaded or missing dates borrow a nearby loaded date's fares.
  // The same weekday a week away comes first: airline schedules are weekly.
  const borrowOffsets = [7, -7, 1, -1, 14, -14, 2, -2, 3, -3];
  const nearest = (fares, date) => {
    if (fares[date]) return fares[date];
    for (const offset of borrowOffsets) {
      const candidate = addDays(date, offset);
      if (fares[candidate]) return { ...fares[candidate], borrowed: true };
    }
    return null;
  };

  const ranked = rankPairs(window.pairs, (pair) => {
    const outFare = nearest(outFares, pair.departDate);
    const retFare = nearest(retFares, pair.returnDate);
    if (!outFare || !retFare) return null;
    let score = outFare.price + retFare.price;
    if (airlineAware) {
      for (const [code, outPrice] of Object.entries(outFare.airlineMinima ?? {})) {
        const retPrice = retFare.airlineMinima?.[code];
        // Same-airline round trips are usually discounted versus two one-ways.
        if (retPrice) score = Math.min(score, 0.85 * (outPrice + retPrice));
      }
    }
    return score + (outFare.borrowed || retFare.borrowed ? 1 : 0);
  });

  const reserve = Math.floor(oracle.remaining * reserveForLocal);
  screenInOrder(oracle, ranked.slice(0, Math.max(0, oracle.remaining - reserve)));
}

// price ≈ mean + depart-weekday + return-weekday + depart-week effects,
// fitted by a few rounds of backfitting on the screened pairs.
function fitAdditiveModel(observations, window) {
  const features = (pair) => [
    `dw${weekdayOf(pair.departDate)}`,
    `rw${weekdayOf(pair.returnDate)}`,
    `wk${Math.floor(window.departDates.indexOf(pair.departDate) / 7)}`
  ];
  const mean = observations.reduce((sum, entry) => sum + entry.result.price, 0) / Math.max(1, observations.length);
  const effects = new Map();

  for (let round = 0; round < 8; round += 1) {
    for (let featureIndex = 0; featureIndex < 3; featureIndex += 1) {
      const sums = new Map();
      for (const { pair, result } of observations) {
        const keys = features(pair);
        const others = keys.reduce((sum, key, index) => (index === featureIndex ? sum : sum + (effects.get(key) ?? 0)), 0);
        const residual = result.price - mean - others;
        const entry = sums.get(keys[featureIndex]) ?? { count: 0, total: 0 };
        entry.count += 1;
        entry.total += residual;
        sums.set(keys[featureIndex], entry);
      }
      for (const [key, { count, total }] of sums) {
        // Shrink effects seen only once or twice toward zero.
        effects.set(key, total / (count + 1));
      }
    }
  }

  return (pair) => mean + features(pair).reduce((sum, key) => sum + (effects.get(key) ?? 0), 0);
}
