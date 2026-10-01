import assert from "node:assert/strict";
import test from "node:test";

import { analyseCalendar, runAllAnalyses } from "../../scripts/research/lib/analyses.mjs";
import { buildSyntheticGrid, pairKey } from "../../scripts/research/lib/fare-grid.mjs";
import { parseLowPriceCalendar } from "../../scripts/research/lib/parse-calendar.mjs";
import {
  findFlightListPayload,
  mergeFlightLists,
  parseFlightListPayload,
  summarizeFlightList
} from "../../scripts/research/lib/parse-flight-list.mjs";
import { PERIODS, datePairs, departureDates, returnDates } from "../../scripts/research/lib/periods.mjs";
import { STRATEGIES, createOracle } from "../../scripts/research/lib/strategies.mjs";

function itinerary(segments, price, { category = "OneTicket", baggage = true } = {}) {
  return {
    journeyList: [
      {
        duration: 900,
        journeyNo: 1,
        transSectionList: segments.map(([airline, flightNo, arriveCity], index) => ({
          arriveDateTime: `2026-12-10 1${index}:00:00`,
          arrivePoint: { cityCode: arriveCity },
          departDateTime: `2026-12-10 0${index}:00:00`,
          flightInfo: { airlineCode: airline, flightNo },
          transportType: "FLIGHT"
        }))
      }
    ],
    policies: [
      {
        price: { totalPrice: price },
        tagList: [
          { key: "PRODUCT_CATEGORY", content: category },
          ...(baggage ? [{ key: "FREE_CHECKED_BAGGAGE" }] : [])
        ]
      }
    ]
  };
}

function flightListPayload({ orderBy = "Price", selected = [] } = {}) {
  return {
    basicInfo: {
      currency: "AUD",
      lowestPrice: { totalPrice: 1047 },
      recordCount: 3,
      searchCondition: { orderBy, selectJourneyList: selected }
    },
    filterOptionList: [
      {
        airlineFilters: [{ code: "8B", lowestTotalPrice: 1047 }],
        transferFilters: [{ cityCode: "HGH", lowestTotalPrice: 1090 }]
      }
    ],
    itineraryList: [
      itinerary([["8B", "8B019", "DPS"], ["8B", "8B969", "CAN"]], 1047, { category: "MultiTicket" }),
      itinerary([["JD", "JD386", "HGH"], ["GJ", "GJ8995", "CAN"]], 1090),
      itinerary([["CZ", "CZ322", "CAN"]], 1486)
    ]
  };
}

test("flight list summary applies session-style filters after collection", () => {
  const summary = summarizeFlightList(parseFlightListPayload(flightListPayload()));

  assert.equal(summary.cheapest.any, 1047);
  assert.equal(summary.cheapest.chinese_airlines, 1090);
  assert.equal(summary.cheapest.single_ticket, 1090);
  assert.equal(summary.orderBy, "Price");
  assert.equal(summary.stage, "first");
  assert.deepEqual(summary.cheapestDetail.chinese_airlines.transferCities, ["HGH"]);
  assert.deepEqual(summary.singleAirlineMinima, { "8B": 1047, CZ: 1486 });
  assert.equal(summary.transferMinima.HGH, 1090);
});

test("flight list parsing finds the payload inside recorded SSE events and marks the return stage", () => {
  const record = { events: [{ data: "keep-alive" }, { data: flightListPayload({ selected: [{ journeyNo: 1 }] }) }] };
  const parsed = parseFlightListPayload(findFlightListPayload(record));

  assert.equal(parsed.stage, "return");
  assert.equal(parsed.itineraries.length, 3);
});

test("merging lists keeps the cheapest price per itinerary", () => {
  const first = parseFlightListPayload(flightListPayload());
  const second = parseFlightListPayload(flightListPayload());
  second.itineraries[2] = { ...second.itineraries[2], price: 1400 };
  const merged = mergeFlightLists([first, second]);

  assert.equal(merged.itineraries.length, 3);
  assert.equal(merged.itineraries.find((entry) => entry.uniqueId === "CZ322").price, 1400);
});

test("calendar parsing treats -1 as unknown and detects round-trip grids", () => {
  const oneWay = parseLowPriceCalendar({
    currency: "AUD",
    lowPriceInCalenderDtoInfoList: [
      { currencyPrice: 472, dDate: 1790812800 },
      { currencyPrice: -1, dDate: 1790899200 }
    ]
  });
  assert.equal(oneWay.kind, "one_way_daily");
  assert.deepEqual(
    oneWay.cells.map((cell) => [cell.departDate, cell.price]),
    [
      ["2026-10-01", 472],
      ["2026-10-02", null]
    ]
  );

  const roundTrip = parseLowPriceCalendar({
    lowPriceInCalenderDtoInfoList: [{ aDate: 1797206400, currencyPrice: -1, dDate: 1794614400 }]
  });
  assert.equal(roundTrip.kind, "round_trip_grid");
  assert.equal(roundTrip.cells[0].returnDate, "2026-12-14");
  assert.equal(roundTrip.pricedCellCount, 0);
});

test("research periods match the plan's pair counts", () => {
  assert.equal(datePairs(PERIODS.A).length, 248);
  assert.equal(datePairs(PERIODS.B).length, 976);
  assert.equal(departureDates(PERIODS.A).length, 31);
  assert.equal(returnDates(PERIODS.A).length, 38);
});

test("every strategy stays within its page-load budget and reports a best pair", () => {
  const grid = buildSyntheticGrid(PERIODS.A, { seed: 3 });
  const window = {
    departDates: departureDates(PERIODS.A),
    pairs: grid.pairs,
    returnDates: returnDates(PERIODS.A)
  };

  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const oracle = createOracle(grid, { budget: 30 });
    strategy(oracle, window, () => 0.5);
    assert.ok(oracle.loads <= 30, `${name} used ${oracle.loads} loads`);
    assert.ok(oracle.best(), `${name} found no pair`);
  }
});

test("a budget covering every pair finds the true minimum", () => {
  const grid = buildSyntheticGrid(PERIODS.A, { seed: 3 });
  const trueMin = Math.min(...grid.pairs.map((pair) => grid.rt[pairKey(pair.departDate, pair.returnDate)]?.price ?? Infinity));
  const oracle = createOracle(grid, { budget: grid.pairs.length });
  STRATEGIES.S1_even(oracle, { departDates: [], pairs: grid.pairs, returnDates: [] });

  assert.equal(oracle.best().truePrice, trueMin);
});

test("calendar analysis flags a calendar that hides the cheapest days", () => {
  const honest = buildSyntheticGrid(PERIODS.B, { calendarError: 0.02, calendarMissing: 0, seed: 5 });
  const saleBlind = buildSyntheticGrid(PERIODS.B, {
    calendarError: 0.02,
    calendarMissesSales: true,
    calendarMissing: 0,
    seed: 5
  });

  assert.ok(analyseCalendar(honest).cheapDayRecallOut > analyseCalendar(saleBlind).cheapDayRecallOut);
  assert.ok(runAllAnalyses(honest).A1_surface.pricedCount > 0);
});
