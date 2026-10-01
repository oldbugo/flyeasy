# Date Search Strategy Uplift (2026-10)

Status: `In-app experiment running (doc 03b)` · Merged to `main` on 2 Oct 2026

## Context

FlyEasy finds cheap Trip.com round trips by searching (departure date, return
date) pairs. A realistic session has hundreds of valid pairs: 248 for a
December departure window with 14–21 day trips, and 976 for March–June 2027.
Searching all of them in the live app is not practical. Each round-trip query
takes about 40–60 s, and a long run raises the risk of a Trip.com block.

The working hypothesis is that particular flights on particular dates are much
cheaper than the rest. If that is true, we can find the cheap region of the
date space without enumerating every pair, for example:

- by scanning single (one-way) flights first and combining the cheap days, or
- by using search algorithms that start somewhere sensible, such as the middle
  of the window, and move toward cheaper dates.

## Goal

Replace the current small, fixed date-pair sample with a strategy that is
backed by data. It should reliably find the cheapest round trip (within a few
percent of the true minimum) using a small fraction of the full search cost.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Existing strategy review](01-existing-strategy-review.md) | What each current strategy does, what it costs, and how useful it is |
| 02 | [Candidate strategies](02-candidate-strategies.md) | New approaches, the hypothesis each depends on, and expected cost |
| 03 | [Test and analysis plan](03-test-and-analysis-plan.md) | Two-period data collection, offline replay, analyses, and decision rules |
| 03a | [Spike results](03a-spike-results.md) | Early evidence, and the Trip.com blocks that ended automated collection |
| 03b | [Revised plan](03b-revised-plan-app-runs.md) | **Current plan.** Test strategies through FlyEasy's own runs in both periods |

## Key findings so far

1. **Every run queries the same few pairs.** All six completed runs in the
   local database queried the same 5 of 31 possible pairs. Reruns added no new
   coverage.
2. **Date choice matters a lot.** Across those 5 pairs the cheapest fare
   ranged from AU$1,089 to AU$1,901, a 75% spread. One-way MEL→CAN prices in
   October 2026 ranged from AU$342 to AU$777 day to day.
3. **Trip.com already gives us much more data than we read.**
   - Every results page calls `GetLowPriceInCalender`. For one-way searches it
     returns a daily lowest-price calendar. For round trips it returns a
     departure×return date grid around the searched pair; the grid is sparse,
     with `-1` for unpriced cells.
   - The `FlightListSearchSSE` response holds the full itinerary list, plus
     `transferFilters[].lowestPrice` (cheapest fare per transit city) and
     `airlineFilters[].lowestPrice` (cheapest fare per airline).
   - FlyEasy only samples three of these responses per run, for diagnostics.
4. **We cannot yet measure strategy quality.** Every efficiency metric compares
   a run against its own best fare, not the true cheapest fare. A full ground
   truth price grid is needed before any strategy can be scored. Doc 03 plans
   how to build one.

## Scope

In scope: how the round-trip packaged baseline chooses dates (the "direct
sweep" and its follow-ups), new date-selection strategies, research tooling to
collect and replay data, and the analysis that picks a default.

Out of scope for now: the multi-city and stopover clusters, stitched booking
and verification. They inherit the baseline's date anchors, so they benefit
indirectly.

## Outcome

In progress. Three date-plan strategies (rotating coverage, weekday
sampling, start in the middle) are built as experiment arms next to the
round-trip baseline (doc 03b). After 2 of 7 December suites, weekday sampling
leads (0.4% mean regret, against 10.2% for the current baseline). The
March–June suites have not started. The default baseline stays unchanged until
both periods are done. Results are logged in doc 03b.
