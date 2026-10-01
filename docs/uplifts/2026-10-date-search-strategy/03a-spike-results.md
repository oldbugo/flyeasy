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

## Decision (2026-10-01): collect through the app worker, cross-check with monitoring runs

The owner chose to run the grids through the app's normal worker and to
cross-check them against monitoring runs.

- `collect-fare-grid.mjs --profile app` uses the app worker's browser profile
  and its "show automation browser" setting, and opens the Trip.com flights
  page first, as the worker does. It claims the app's worker slot
  (`runtime/automation-worker.json`), so the dispatcher holds app runs until a
  batch finishes. It then hands the slot back and starts the dispatcher for any
  runs that queued meanwhile. A block stops it immediately, sets the app's
  connection state to `blocked`, and leaves the app's queue alone.
- `run-collection.mjs --period A|B` runs one collection day: sentinels, the
  20-pair click-through verification spike (once per period), up to 6 batches
  of 40 loads with 15-minute pauses for app runs, then sentinels again.
- `create-monitoring-sessions.mjs` copies the existing session for each
  period, using the app's own Duplicate logic, and enables 12-hourly
  monitoring. Monitoring only runs while the desktop app is open.
- `lib/cross-check.mjs` matches every app query (monitoring and manual) to
  the nearest research observation of the same pair within 24 hours, under
  the session's airline filter. `build-report.mjs` reports the results by run
  type, along with the click-through spike results.

The owner runs the collection and session-creation commands from their own
terminal. Claude's sandbox cannot open the visible browser window, and
creating scheduled monitoring sessions needs the owner's approval.

### Side finding: the app ignores `departure_end_date` when enumerating pairs

`enumerateDatePairs` in `run-baseline-search.mjs` loops departures from
`departure_start_date` up to `return_end_date − duration_min_days`. It never
reads `departure_end_date`. For the research sessions, this means monitoring
runs may sample departures after the period ends (e.g. up to 7 Jan 2027 for
the December session). The cross-check skips pairs that are outside the grid.
Update: this is intended. The session form saves the latest return date as
`departure_end_date` (`src/app/sessions/actions.ts`). The generator now also
respects the field, which changes nothing for app-created sessions (doc 03b).

## Second block (2026-10-01): the app worker's profile, hidden browser

Claude cannot open a visible browser from its sandbox, so it tried the app
worker's profile with the browser hidden (the app's own "show automation
browser" off mode). Trip.com returned `whaleguard block` at the flights home
page, before any search. The collector stopped and set the app's connection
state to `blocked`.

Every automated client Claude can run has now been blocked. Collection stays
stopped, and nothing retries or tries a different client to get around the
block. The `--hidden` option was not kept. The remaining untested path is the
app worker's visible browser on the owner's machine.

Options that do not depend on getting past Trip.com's bot protection:

- **A licensed fare API** for the grids, for example Amadeus Self-Service
  (Flight Offers Search, Flight Cheapest Date Search). Claude can collect
  through it unattended with the owner's API key, read from an environment
  variable. Prices will differ from Trip.com's. The date structure
  (weekday effects, one-way decomposition, smoothness) is the research
  question, and that should transfer. Check the provider's current quota and
  terms first.
- **The app's own runs on the owner's machine**: manual or monitoring runs in
  the visible browser, cross-checked with `lib/cross-check.mjs`. This gives
  far fewer pairs than a grid.
