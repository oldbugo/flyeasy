# 03a · Phase 0 Spike Results

Status: `In progress` (live collection paused on 2026-10-01)

## Tooling built

| File | Purpose |
|------|---------|
| `scripts/research/collect-fare-grid.mjs` | Resumable, randomised, batched collector. It stops at the first block. |
| `scripts/research/lib/tripcom-capture.mjs` | Records the `FlightListSearchSSE` and `GetLowPriceInCalender` responses a page already downloads |
| `scripts/research/lib/parse-flight-list.mjs` | Compact itineraries and the cheapest fare under each filter: any airline, Chinese airlines only, single ticket |
| `scripts/research/lib/parse-calendar.mjs` | Calendar cells. `-1` becomes unknown |
| `scripts/research/lib/fare-grid.mjs` | Builds a ground-truth grid from collected data, or a synthetic grid with a known optimum |
| `scripts/research/lib/strategies.mjs` | Strategies S1–S8 as pure functions over a budgeted oracle |
| `scripts/research/lib/replay.mjs` | Sub-window replay and regret metrics |
| `scripts/research/lib/analyses.mjs` | Analyses A1–A5 and A8 with decision thresholds |
| `scripts/research/build-report.mjs` | Writes `research/fare-grid/report.json`, which feeds the temporary dashboard |
| `tests/unit/research-fare-grid.test.mjs` | Unit tests for parsers, periods, strategy budgets and the calendar blind-spot check |

Raw data and the report are written to `research/fare-grid/`, which is
git-ignored.

## Findings

### P0 block: Trip.com refused the research browser

The first two loads, run with a fresh browser profile on 2026-10-01, returned
Trip.com's `whaleguard block` page instead of results. The collector now
recognises this page and stops immediately. Per the plan, it does not retry
or try to get around the block.

Note: the app's own worker uses a long-lived browser profile and opens the
Trip.com home page before searching, and it still gets results. Moving
research collection onto that path would be a way around a block that
Trip.com applied to automated traffic. That is a product and policy decision
for the owner, not something the tooling should do by itself.

### H8 early evidence: the outbound list price matches full extraction

The app's earlier runs saved Trip.com flight-list responses for their first
query (10 Dec → 24 Dec). Comparing those responses with the price the app
recorded after clicking through to a return flight:

| Run | List sorted by | Cheapest in list, Chinese airlines | Recorded after full extraction |
|-----|----------------|-----------------------------------:|-------------------------------:|
| 8daa2a | Price | 1,090 | 1,090 |
| 8cd776 | Price | 1,089 | 1,089 |
| ad5e18 | Price | 1,090 | 1,090 |
| 2c9683 | Price | 1,090 | 1,090 |
| 5cd5ce | **Direct first** | 1,486 | 1,090 |

All 4 price-sorted lists match exactly. The one mismatch came from a list
Trip.com returned sorted "direct flights first". That list did not contain
the A$1,090 fare. The collector now switches to the "Cheapest" sort whenever
the first list is not price-sorted, and records whether it got a price-sorted
list (`screenSortedByPrice`).

The cheapest fare for any airline was A$1,035–1,049, a self-transfer via Bali
on TransNusa. The session's "Chinese airlines only" setting excludes it. The
grid therefore stores itinerary-level data, so every filter can be applied
after collection.

### Price calendar: treated as untrusted

The owner does not trust the calendar's accuracy, so the plan now treats it
as an unverified hint:

- No strategy depends on it unless analysis A5 passes on real data.
- A5 now also measures **blind spots**: of the truly cheapest 10% of days, how
  many does the calendar rank among its own cheapest 30%? A calendar can have
  a small average error and still miss sale fares.
- Synthetic replay shows why this matters. Random calendar error (5–30%)
  barely changes calendar-first results, because only the ranking matters. A
  calendar that shows pre-sale prices on sale days drops calendar-first from
  82% to 56% of searches within 5% of the optimum (Mar–Jun window, 20
  loads). These figures come from synthetic data and are not evidence about
  Trip.com.

### Simulator self-test (synthetic grid only)

All strategies run within budget, and the simulator reproduces the true
optimum when the budget covers every pair (unit-tested). Strategy rankings on
the synthetic grid reflect that grid's invented structure, not Trip.com's
real prices. They will be replaced by replay on the collected grids.

## Open decision

How to collect the ground-truth grids, given the block. See the dashboard's
"Next steps" and the session summary.
