// Date-pair planners for the round-trip baseline's direct sweep
// (docs/uplifts/2026-10-date-search-strategy/03b-revised-plan-app-runs.md).
//
// Each planner is a generator: it yields the next { departDate, returnDate,
// durationDays } pair to search and receives that search's result back from
// `next()`: { price } when Trip.com returned a price, or null when the search
// came back empty or failed. Missing results are skipped, never treated as
// expensive. A planner yields at most `budget` distinct pairs.
//
// The search worker and the offline simulator (scripts/research) both run
// these planners, so what is simulated is what the app searches.

export const DATE_SAMPLING_MODES = ["rotating_coverage", "weekday_sampling", "middle_start"];

export const DATE_SAMPLING_LABELS = {
  even_coverage: "Round trip baseline",
  adaptive_coverage: "Adaptive coverage baseline",
  rotating_coverage: "Rotating coverage",
  weekday_sampling: "Weekday sampling",
  middle_start: "Start in the middle"
};

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

function pairKey(departDate, returnDate) {
  return `${departDate}_${returnDate}`;
}

export function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (const char of String(seedText)) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function sampleEvenly(values, limit) {
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

// Shared bookkeeping: which pairs exist, what was searched, the best price.
function createPlanState(pairs, budget) {
  const byKey = new Map(pairs.map((pair) => [pairKey(pair.departDate, pair.returnDate), pair]));
  return {
    best: null,
    budget: Math.max(0, Math.min(budget, pairs.length)),
    byKey,
    results: new Map(),
    get remaining() {
      return this.budget - this.results.size;
    },
    record(pair, result) {
      const price = Number(result?.price);
      const value = Number.isFinite(price) && price > 0 ? price : null;
      this.results.set(pairKey(pair.departDate, pair.returnDate), value);
      if (value !== null && (!this.best || value < this.best.price)) {
        this.best = { departDate: pair.departDate, price: value, returnDate: pair.returnDate };
      }
      return value;
    },
    seen(departDate, returnDate) {
      return this.results.has(pairKey(departDate, returnDate));
    }
  };
}

// Search `pair` unless it was already searched or the budget is spent.
// Returns the price, null for missing, or undefined when nothing was searched.
function* search(state, pair) {
  if (!pair || state.remaining <= 0) return undefined;
  const key = pairKey(pair.departDate, pair.returnDate);
  if (state.results.has(key)) return state.results.get(key);
  const result = yield pair;
  return state.record(pair, result);
}

// Spend the rest of the budget on untried pairs next to the best one found,
// moving whenever a neighbour is cheaper.
function* localSearch(state, radius) {
  let improved = true;
  while (improved && state.remaining > 0 && state.best) {
    improved = false;
    const anchor = state.best;
    const neighbours = [];
    for (let dd = -radius; dd <= radius; dd += 1) {
      for (let rd = -radius; rd <= radius; rd += 1) {
        if (dd === 0 && rd === 0) continue;
        const pair = state.byKey.get(pairKey(addDays(anchor.departDate, dd), addDays(anchor.returnDate, rd)));
        if (pair && !state.seen(pair.departDate, pair.returnDate)) {
          neighbours.push({ distance: Math.abs(dd) + Math.abs(rd), pair });
        }
      }
    }
    neighbours.sort((left, right) => left.distance - right.distance);
    for (const { pair } of neighbours) {
      if (state.remaining <= 0) return;
      yield* search(state, pair);
      if (state.best !== anchor) {
        improved = true;
        break;
      }
    }
  }
}

// S1r · Rotating coverage. Spreads the budget evenly across departure dates
// from a random starting offset, and cycles trip lengths separately, so each
// run covers different pairs while still spanning the whole window.
export function* rotatingCoveragePlanner({ budget, pairs, seed }) {
  const state = createPlanState(pairs, budget);
  const random = createSeededRandom(`rotating:${seed}`);
  const departures = [...new Set(pairs.map((pair) => pair.departDate))].sort();
  const durations = [...new Set(pairs.map((pair) => pair.durationDays))].sort((a, b) => a - b);
  const step = departures.length / Math.max(1, state.budget);
  const offset = random() * step;
  const durationOffset = Math.floor(random() * durations.length);
  const picked = new Set();

  for (let index = 0; index < state.budget; index += 1) {
    const departDate = departures[Math.floor(offset + index * step) % departures.length];
    for (let attempt = 0; attempt < durations.length; attempt += 1) {
      const durationDays = durations[(durationOffset + index + attempt) % durations.length];
      const key = pairKey(departDate, addDays(departDate, durationDays));
      if (state.byKey.has(key) && !picked.has(key)) {
        picked.add(key);
        yield* search(state, state.byKey.get(key));
        break;
      }
    }
  }

  // Short windows can leave budget unused; spend it next to the best pair.
  yield* localSearch(state, 1);
}

// price ≈ mean + departure-weekday + return-weekday + week-of-window effects,
// fitted by a few rounds of backfitting, with small samples shrunk to zero.
export function fitAdditiveModel(observations, departures) {
  const features = (pair) => [
    `dw${weekdayOf(pair.departDate)}`,
    `rw${weekdayOf(pair.returnDate)}`,
    `wk${Math.floor(departures.indexOf(pair.departDate) / 7)}`
  ];
  const mean = observations.reduce((sum, entry) => sum + entry.price, 0) / Math.max(1, observations.length);
  const effects = new Map();

  for (let round = 0; round < 8; round += 1) {
    for (let featureIndex = 0; featureIndex < 3; featureIndex += 1) {
      const sums = new Map();
      for (const { pair, price } of observations) {
        const keys = features(pair);
        const others = keys.reduce((sum, key, index) => (index === featureIndex ? sum : sum + (effects.get(key) ?? 0)), 0);
        const entry = sums.get(keys[featureIndex]) ?? { count: 0, total: 0 };
        entry.count += 1;
        entry.total += price - mean - others;
        sums.set(keys[featureIndex], entry);
      }
      for (const [key, { count, total }] of sums) {
        effects.set(key, total / (count + 1));
      }
    }
  }

  return (pair) => mean + features(pair).reduce((sum, key) => sum + (effects.get(key) ?? 0), 0);
}

// S5 · Weekday sampling. Searches a spread of departure-weekday ×
// return-weekday × week combinations, fits the additive model, then searches
// the pairs it predicts are cheapest and finishes with a short local search.
export function* weekdaySamplingPlanner({ budget, pairs, seed }) {
  const state = createPlanState(pairs, budget);
  const random = createSeededRandom(`weekday:${seed}`);
  const departures = [...new Set(pairs.map((pair) => pair.departDate))].sort();
  const cells = new Map();
  for (const pair of pairs) {
    const week = Math.floor(departures.indexOf(pair.departDate) / 7);
    const cell = `${weekdayOf(pair.departDate)}_${weekdayOf(pair.returnDate)}_${week % 3}`;
    if (!cells.has(cell)) cells.set(cell, []);
    cells.get(cell).push(pair);
  }
  const representatives = [...cells.values()].map((cellPairs) => cellPairs[Math.floor(random() * cellPairs.length)]);
  const rotation = Math.floor(random() * representatives.length);
  const rotated = [...representatives.slice(rotation), ...representatives.slice(0, rotation)];
  const design = sampleEvenly(rotated, Math.ceil(state.budget * 0.55));

  for (const pair of design) {
    yield* search(state, pair);
  }

  const observations = [...state.results.entries()]
    .filter(([, price]) => price !== null)
    .map(([key, price]) => ({ pair: state.byKey.get(key), price }));
  if (observations.length > 0) {
    const predict = fitAdditiveModel(observations, departures);
    const ranked = pairs
      .filter((pair) => !state.seen(pair.departDate, pair.returnDate))
      .map((pair) => ({ pair, predicted: predict(pair) }))
      .sort((left, right) => left.predicted - right.predicted);
    const localReserve = Math.min(2, Math.floor(state.remaining / 3));
    for (const { pair } of ranked) {
      if (state.remaining <= localReserve) break;
      yield* search(state, pair);
    }
  }

  yield* localSearch(state, 1);
}

// S4w · Start in the middle. Begins at the middle departure date and trip
// length, steps 7, then 3, then 1 days toward cheaper pairs (weekly steps keep
// the weekday fixed), and restarts from a quarter and three quarters of the
// way through the window while budget remains.
export function* middleStartPlanner({ budget, pairs }) {
  const state = createPlanState(pairs, budget);
  const departures = [...new Set(pairs.map((pair) => pair.departDate))].sort();
  const durations = [...new Set(pairs.map((pair) => pair.durationDays))].sort((a, b) => a - b);
  const middleDuration = durations[Math.floor((durations.length - 1) / 2)];

  function* priceAt(departDate, durationDays) {
    const pair = state.byKey.get(pairKey(departDate, addDays(departDate, durationDays)));
    if (!pair) return Number.POSITIVE_INFINITY;
    const price = yield* search(state, pair);
    return price ?? Number.POSITIVE_INFINITY;
  }

  for (const fraction of [0.5, 0.25, 0.75]) {
    if (state.remaining <= 0) break;
    const startDate = departures[Math.floor((departures.length - 1) * fraction)];
    let current = { departDate: startDate, durationDays: middleDuration };
    current.price = yield* priceAt(current.departDate, current.durationDays);

    for (const step of [7, 3, 1]) {
      let moved = true;
      while (moved && state.remaining > 0) {
        moved = false;
        const durationStep = Math.min(step, 3);
        for (const [departShift, durationShift] of [
          [step, 0],
          [-step, 0],
          [0, durationStep],
          [0, -durationStep]
        ]) {
          if (state.remaining <= 0) break;
          const departDate = addDays(current.departDate, departShift);
          const durationDays = current.durationDays + durationShift;
          const price = yield* priceAt(departDate, durationDays);
          if (price < current.price) {
            current = { departDate, durationDays, price };
            moved = true;
            break;
          }
        }
      }
    }
  }

  yield* localSearch(state, 1);
}

export function createDatePlanner(mode, options) {
  if (mode === "rotating_coverage") return rotatingCoveragePlanner(options);
  if (mode === "weekday_sampling") return weekdaySamplingPlanner(options);
  if (mode === "middle_start") return middleStartPlanner(options);
  throw new Error(`Unknown date sampling mode: ${mode}`);
}
