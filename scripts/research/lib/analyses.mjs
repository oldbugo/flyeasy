// Hypothesis analyses A1–A8 from docs/uplifts/2026-10-date-search-strategy/03.
// Each returns plain numbers plus the threshold verdict, so a report can show
// the decision and not only the chart.

import { pairKey } from "./fare-grid.mjs";
import { addDays } from "./periods.mjs";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayOf(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

function ranks(values) {
  const order = values.map((value, index) => ({ index, value })).sort((a, b) => a.value - b.value);
  const result = new Array(values.length);
  order.forEach((entry, rank) => {
    result[entry.index] = rank;
  });
  return result;
}

function spearman(xs, ys) {
  return pearson(ranks(xs), ranks(ys));
}

function pricedPairs(grid) {
  return grid.pairs
    .map((pair) => ({ ...pair, cell: grid.rt[pairKey(pair.departDate, pair.returnDate)] }))
    .filter((pair) => pair.cell);
}

export function analysePriceSurface(grid) {
  const priced = pricedPairs(grid);
  const prices = priced.map((pair) => pair.cell.price);
  const median = quantile(prices, 0.5);
  const p10 = quantile(prices, 0.1);
  const best = priced.reduce((min, pair) => (!min || pair.cell.price < min.cell.price ? pair : min), null);
  const topDecileDiscount = median ? 1 - p10 / median : null;
  const departDates = [...new Set(grid.pairs.map((pair) => pair.departDate))].sort();
  const durations = [...new Set(grid.pairs.map((pair) => pair.durationDays))].sort((a, b) => a - b);

  return {
    best: best ? { departDate: best.departDate, price: best.cell.price, returnDate: best.returnDate } : null,
    heatmap: {
      departDates,
      durations,
      values: durations.map((duration) =>
        departDates.map((date) => grid.rt[pairKey(date, addDays(date, duration))]?.price ?? null)
      )
    },
    max: quantile(prices, 1),
    median,
    min: quantile(prices, 0),
    p10,
    pricedCount: prices.length,
    topDecileDiscount: round(topDecileDiscount),
    verdict: topDecileDiscount === null ? "no data" : topDecileDiscount >= 0.15 ? "pass" : "fail"
  };
}

export function analyseWeekdayEffects(grid) {
  const priced = pricedPairs(grid);
  const median = quantile(priced.map((pair) => pair.cell.price), 0.5);
  const effect = (keyOf) =>
    WEEKDAYS.map((label, day) => {
      const values = priced.filter((pair) => keyOf(pair) === day).map((pair) => pair.cell.price / median - 1);
      return { day: label, effect: round(quantile(values, 0.5)), n: values.length };
    });
  const depart = effect((pair) => weekdayOf(pair.departDate));
  const ret = effect((pair) => weekdayOf(pair.returnDate));
  const range = (rows) => {
    const values = rows.map((row) => row.effect).filter(Number.isFinite);
    return values.length ? round(Math.max(...values) - Math.min(...values)) : null;
  };

  return {
    depart,
    departRange: range(depart),
    ret,
    returnRange: range(ret),
    verdict: Math.max(range(depart) ?? 0, range(ret) ?? 0) >= 0.08 ? "pass" : "fail"
  };
}

export function analyseSmoothness(grid) {
  const lagPairs = (step, axis) => {
    const xs = [];
    const ys = [];
    for (const pair of grid.pairs) {
      const here = grid.rt[pairKey(pair.departDate, pair.returnDate)]?.price;
      const next =
        axis === "depart"
          ? grid.rt[pairKey(addDays(pair.departDate, step), addDays(pair.returnDate, step))]?.price
          : grid.rt[pairKey(pair.departDate, addDays(pair.returnDate, step))]?.price;
      if (Number.isFinite(here) && Number.isFinite(next)) {
        xs.push(here);
        ys.push(next);
      }
    }
    return round(pearson(xs, ys));
  };

  let localMinima = 0;
  for (const pair of grid.pairs) {
    const here = grid.rt[pairKey(pair.departDate, pair.returnDate)]?.price;
    if (!Number.isFinite(here)) continue;
    const neighbours = [
      [1, 1],
      [-1, -1],
      [0, 1],
      [0, -1]
    ]
      .map(([dd, rd]) => grid.rt[pairKey(addDays(pair.departDate, dd), addDays(pair.returnDate, rd))]?.price)
      .filter(Number.isFinite);
    if (neighbours.length >= 2 && neighbours.every((price) => here < price)) localMinima += 1;
  }

  const departLag1 = lagPairs(1, "depart");
  return {
    departLag1,
    departLag7: lagPairs(7, "depart"),
    localMinima,
    returnLag1: lagPairs(1, "return"),
    verdict: departLag1 === null ? "no data" : departLag1 >= 0.5 && localMinima <= 3 ? "pass" : "fail"
  };
}

function oneWayScore(grid, pair, airlineAware) {
  const outFare = grid.out[pair.departDate];
  const retFare = grid.ret[pair.returnDate];
  if (!outFare || !retFare) return null;
  let score = outFare.price + retFare.price;
  if (airlineAware) {
    for (const [code, outPrice] of Object.entries(outFare.airlineMinima ?? {})) {
      const retPrice = retFare.airlineMinima?.[code];
      if (retPrice) score = Math.min(score, 0.85 * (outPrice + retPrice));
    }
  }
  return score;
}

export function analyseSeparability(grid) {
  const evaluate = (airlineAware) => {
    const rows = pricedPairs(grid)
      .map((pair) => ({ key: pairKey(pair.departDate, pair.returnDate), price: pair.cell.price, score: oneWayScore(grid, pair, airlineAware) }))
      .filter((row) => Number.isFinite(row.score));
    if (rows.length < 10) return { recallAt30: null, rows: rows.length, spearman: null };
    const trueTop = new Set([...rows].sort((a, b) => a.price - b.price).slice(0, 10).map((row) => row.key));
    const scoreTop = [...rows].sort((a, b) => a.score - b.score).slice(0, 30);
    return {
      recallAt30: round(scoreTop.filter((row) => trueTop.has(row.key)).length / trueTop.size),
      rows: rows.length,
      scatter: rows.map((row) => [Math.round(row.score), row.price]),
      spearman: round(spearman(rows.map((row) => row.score), rows.map((row) => row.price)))
    };
  };
  const overall = evaluate(false);
  const airlineAware = evaluate(true);

  return {
    airlineAware,
    overall,
    verdict:
      overall.spearman === null
        ? "no data"
        : overall.spearman >= 0.7 && overall.recallAt30 >= 0.8
          ? "pass"
          : "fail",
    airlineAwareVerdict:
      airlineAware.recallAt30 !== null && overall.recallAt30 !== null && airlineAware.recallAt30 - overall.recallAt30 >= 0.1
        ? "better"
        : "not better"
  };
}

// Calendar prices vs the live one-way price for the same day and direction.
export function analyseCalendar(grid) {
  const errors = [];
  let calendarDays = 0;
  let pricedDays = 0;
  for (const [calendar, live] of [
    [grid.calendarOut, grid.out],
    [grid.calendarRet, grid.ret]
  ]) {
    for (const [date, price] of Object.entries(calendar ?? {})) {
      calendarDays += 1;
      if (price === null) continue;
      pricedDays += 1;
      if (live[date]) errors.push(Math.abs(price / live[date].price - 1));
    }
  }
  const medianError = quantile(errors, 0.5);
  const p90Error = quantile(errors, 0.9);
  const coverage = calendarDays ? pricedDays / calendarDays : null;

  // Blind spots matter more than average error: of the truly cheapest 10% of
  // days, how many does the calendar rank in its own cheapest 30%?
  const blindSpot = (calendar, live) => {
    const days = Object.keys(live).filter((date) => calendar?.[date] !== undefined);
    if (days.length < 10) return null;
    const trueCheap = [...days].sort((a, b) => live[a].price - live[b].price).slice(0, Math.max(1, Math.round(days.length * 0.1)));
    const calendarCheap = new Set(
      days
        .filter((date) => calendar[date] !== null)
        .sort((a, b) => calendar[a] - calendar[b])
        .slice(0, Math.round(days.length * 0.3))
    );
    return trueCheap.filter((date) => calendarCheap.has(date)).length / trueCheap.length;
  };
  const recallOut = blindSpot(grid.calendarOut, grid.out);
  const recallRet = blindSpot(grid.calendarRet, grid.ret);
  const cheapDayRecall = [recallOut, recallRet].filter(Number.isFinite);
  const minRecall = cheapDayRecall.length ? Math.min(...cheapDayRecall) : null;

  return {
    cheapDayRecallOut: round(recallOut),
    cheapDayRecallRet: round(recallRet),
    comparedDays: errors.length,
    coverage: round(coverage),
    medianError: round(medianError),
    p90Error: round(p90Error),
    verdict:
      errors.length < 10
        ? "no data"
        : medianError <= 0.05 && p90Error <= 0.15 && coverage >= 0.8 && minRecall >= 0.8
          ? "pass"
          : minRecall !== null && minRecall >= 0.8
            ? "usable for ranking only"
            : "fail"
  };
}

export function analyseAirlines(grid) {
  const priced = pricedPairs(grid);
  const cutoff = quantile(priced.map((pair) => pair.cell.price), 0.1);
  const winners = {};
  for (const pair of priced.filter((entry) => entry.cell.price <= cutoff)) {
    const minima = pair.cell.airlineMinima ?? {};
    const [code] = Object.entries(minima).sort((a, b) => a[1] - b[1])[0] ?? ["unknown"];
    winners[code] = (winners[code] ?? 0) + 1;
  }

  const schedule = {};
  for (const [date, cell] of Object.entries(grid.out)) {
    for (const code of Object.keys(cell.airlineMinima ?? {})) {
      schedule[code] ??= WEEKDAYS.map(() => 0);
      schedule[code][weekdayOf(date)] += 1;
    }
  }

  return { schedule, topDecileWinners: winners };
}

export function runAllAnalyses(grid) {
  return {
    A1_surface: analysePriceSurface(grid),
    A2_weekdays: analyseWeekdayEffects(grid),
    A3_smoothness: analyseSmoothness(grid),
    A4_separability: analyseSeparability(grid),
    A5_calendar: analyseCalendar(grid),
    A8_airlines: analyseAirlines(grid)
  };
}
