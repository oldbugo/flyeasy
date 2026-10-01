// A fare grid is the ground truth that analyses and strategy replays read:
//   rt:  "depart_return" -> { price, airlineMinima }   (round-trip screens)
//   out: date -> { price, airlineMinima }              (one-way MEL->CAN)
//   ret: date -> { price, airlineMinima }              (one-way CAN->MEL)
//   calendarOut / calendarRet: date -> price | null    (Trip.com calendar, unverified)
// Missing cells are absent. The grid is built either from collected JSONL
// or from the synthetic generator (simulator self-tests only).

import fs from "node:fs";
import path from "node:path";

import { addDays, datePairs, departureDates, returnDates } from "./periods.mjs";

export function pairKey(departDate, returnDate) {
  return `${departDate}_${returnDate}`;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Latest successful observation per key, for one fare variant.
function latestByKey(records, fareVariant) {
  const byKey = new Map();
  for (const record of records) {
    if (record.status !== "ok" || !record.screen) continue;
    const price = record.screen.cheapest?.[fareVariant] ?? null;
    if (price === null) continue;
    const existing = byKey.get(record.key);
    if (!existing || existing.observedAt < record.observedAt) {
      byKey.set(record.key, {
        airlineMinima: record.screen.singleAirlineMinima ?? {},
        observedAt: record.observedAt,
        price
      });
    }
  }
  return byKey;
}

export function loadCollectedGrid(periodDir, period, fareVariant = "chinese_airlines") {
  const rt = Object.fromEntries(latestByKey(readJsonl(path.join(periodDir, "rt_grid.jsonl")), fareVariant));
  const out = Object.fromEntries(latestByKey(readJsonl(path.join(periodDir, "ow_out.jsonl")), fareVariant));
  const ret = Object.fromEntries(latestByKey(readJsonl(path.join(periodDir, "ow_ret.jsonl")), fareVariant));
  const calendarOut = {};
  const calendarRet = {};

  // Keep the most recent one-way calendar price per day and direction.
  for (const calendar of readJsonl(path.join(periodDir, "calendar.jsonl"))) {
    if (calendar.kind !== "one_way_daily") continue;
    const target = calendar.sourceDataset === "ow_ret" ? calendarRet : calendarOut;
    for (const cell of calendar.cells) {
      target[cell.departDate] = cell.price;
    }
  }

  return {
    calendarOut,
    calendarRet,
    fareVariant,
    out,
    pairs: datePairs(period),
    period,
    ret,
    rt,
    source: "collected"
  };
}

// ---------------------------------------------------------------------------
// Synthetic grid: realistic structure, known optimum. Used to test the
// simulator and analyses. It says nothing about real Trip.com prices.

function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function gaussian(random) {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function weekday(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

const SYNTHETIC_AIRLINES = [
  // code, base one-way price, operating weekdays (0 = Sunday), round-trip factor
  { code: "CZ", base: 720, days: [0, 1, 2, 3, 4, 5, 6], rtFactor: 0.82 },
  { code: "MU", base: 640, days: [1, 3, 5, 6], rtFactor: 0.8 },
  { code: "JD", base: 560, days: [1, 4, 6], rtFactor: 0.9 },
  { code: "HU", base: 600, days: [0, 3, 5], rtFactor: 0.86 },
  { code: "3U", base: 610, days: [2, 6], rtFactor: 0.88 }
];

function seasonFactor(isoDate) {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  if (month === 12) return day >= 18 ? 1.45 : day >= 10 ? 1.2 : 1.05;
  if (month === 1) return day <= 6 ? 1.35 : 1.1;
  if (month === 4 && day <= 10) return 1.2;
  if (month === 6) return 1.1 + day / 150;
  if (month === 7) return 1.25;
  return 1;
}

export function buildSyntheticGrid(
  period,
  { calendarError = 0.12, calendarMissing = 0.25, calendarMissesSales = false, seed = 7 } = {}
) {
  const random = createRandom(seed);
  const directions = { out: departureDates(period), ret: returnDates(period) };
  const fares = { out: {}, ret: {} };
  const saleDays = { out: new Set(), ret: new Set() };

  for (const [direction, dates] of Object.entries(directions)) {
    for (const date of dates) {
      const perAirline = {};
      for (const airline of SYNTHETIC_AIRLINES) {
        if (!airline.days.includes(weekday(date))) continue;
        const sale = random() < 0.06 ? 0.72 : 1;
        if (sale < 1) saleDays[direction].add(date);
        const weekdayFactor = [5, 6, 0].includes(weekday(date)) ? 1.08 : 0.97;
        const noise = Math.exp(0.07 * gaussian(random));
        perAirline[airline.code] = Math.round(airline.base * seasonFactor(date) * weekdayFactor * sale * noise);
      }
      fares[direction][date] = perAirline;
    }
  }

  const toCell = (perAirline) => {
    const prices = Object.values(perAirline);
    return prices.length > 0 ? { airlineMinima: perAirline, price: Math.min(...prices) } : null;
  };
  const out = {};
  const ret = {};
  for (const [date, perAirline] of Object.entries(fares.out)) {
    const cell = toCell(perAirline);
    if (cell) out[date] = cell;
  }
  for (const [date, perAirline] of Object.entries(fares.ret)) {
    const cell = toCell(perAirline);
    if (cell) ret[date] = cell;
  }

  const rt = {};
  for (const pair of datePairs(period)) {
    const outFares = fares.out[pair.departDate] ?? {};
    const retFares = fares.ret[pair.returnDate] ?? {};
    const candidates = {};
    for (const airline of SYNTHETIC_AIRLINES) {
      if (outFares[airline.code] && retFares[airline.code]) {
        candidates[airline.code] = Math.round(
          airline.rtFactor * (outFares[airline.code] + retFares[airline.code]) * Math.exp(0.03 * gaussian(random))
        );
      }
    }
    // Mixed-airline itineraries price close to two one-way fares.
    const outMin = Math.min(...Object.values(outFares), Number.POSITIVE_INFINITY);
    const retMin = Math.min(...Object.values(retFares), Number.POSITIVE_INFINITY);
    if (Number.isFinite(outMin + retMin)) candidates.mixed = Math.round(1.02 * (outMin + retMin));
    const prices = Object.values(candidates);
    if (prices.length > 0) rt[pairKey(pair.departDate, pair.returnDate)] = { airlineMinima: candidates, price: Math.min(...prices) };
  }

  // Calendar = cached hint: multiplicative error and missing days.
  // calendarMissesSales models a stale cache that shows pre-sale prices.
  const makeCalendar = (cells, dates, direction) =>
    Object.fromEntries(
      dates.map((date) => [
        date,
        cells[date] && random() >= calendarMissing
          ? Math.round(
              (cells[date].price / (calendarMissesSales && saleDays[direction].has(date) ? 0.72 : 1)) *
                Math.exp(calendarError * gaussian(random))
            )
          : null
      ])
    );

  return {
    calendarOut: makeCalendar(out, directions.out, "out"),
    calendarRet: makeCalendar(ret, directions.ret, "ret"),
    fareVariant: "synthetic",
    out,
    pairs: datePairs(period),
    period,
    ret,
    rt,
    source: "synthetic"
  };
}

export function gridCoverage(grid) {
  return {
    outPriced: Object.keys(grid.out).length,
    pairCount: grid.pairs.length,
    retPriced: Object.keys(grid.ret).length,
    rtPriced: grid.pairs.filter((pair) => grid.rt[pairKey(pair.departDate, pair.returnDate)]).length
  };
}

export { addDays };
