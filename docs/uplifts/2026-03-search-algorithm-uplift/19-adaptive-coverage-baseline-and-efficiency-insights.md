# Adaptive Coverage Baseline And Efficiency Insights

Status: `Complete`

## Why this change was needed

The historical review showed two important constraints:

- the direct sweep still wastes a lot of budget on duplicate candidate variants
- the best direct fare often appears late enough that a fixed linear ordering is
  leaving efficiency on the table

That did not justify replacing the existing baseline outright, but it did
justify adding a second selectable baseline so FlyEasy can test a more adaptive
budget-allocation method on real sessions.

## What changed

### 1. Added a second selectable baseline strategy

The strategy catalog now includes:

- `Round trip baseline`
- `Adaptive coverage baseline`

The new baseline is mutually exclusive with the existing baseline and is exposed
through the same `Search strategy` workspace.

Its direct sweep now:

- starts with an even seed sweep across the date space
- then reallocates the remaining direct-sweep budget using:
  - current-run reward
  - under-covered departure buckets
  - proximity to the best pair found so far
  - weak historical departure and return priors from the same session
  - deterministic jitter so the planner does not over-collapse into one lane

### 2. Kept the rest of the baseline comparable

The new baseline still feeds the same downstream baseline stages:

- `Return option expansion`
- `Pass 1 analysis`
- `Anchored departure follow-up`

That was deliberate. It keeps the experiment focused on the direct-sweep budget
policy instead of changing every other part of the baseline at the same time.

### 3. Added a baseline execution efficiency snapshot

The worker now records `baseline_execution_efficiency` after the direct sweep.

That snapshot records:

- baseline label and sampling mode
- planned budget vs executed direct-sweep queries
- candidate count
- distinct family count
- duplication rate
- cheapest baseline fare
- query number where the cheapest fare was first seen
- family coverage halfway through the sweep
- family coverage at the point the cheapest fare was first discovered
- unique stopover-city clue count
- the direct-sweep query sequence with per-query outcomes

### 4. Surfaced the comparison data in the UI

The latest-run results now show the new baseline efficiency board, and the live
run progress panel shows the same board while a run is in progress.

This gives FlyEasy a direct way to compare:

- whether the adaptive baseline finds the best fare earlier
- whether it reaches broader family coverage earlier
- whether it spends the same budget more effectively than the stable
  even-coverage baseline

## Impact

FlyEasy now has the first real algorithm-experiment baseline:

- one stable baseline for predictable comparison
- one adaptive baseline for bounded efficiency testing
- run-level evidence that shows how the baseline actually spent its budget

This is a meaningful uplift because it moves the search redesign from
architecture-only work into a measurable search-method experiment.

## Remaining limits

- the adaptive baseline still uses a handcrafted reward function, not the
  future shared scoring model
- historical priors are intentionally weak and date-level, not exact itinerary
  replay
- the planner still adapts only within the direct sweep, not yet across all
  strategy families

## Files changed

- `scripts/automation/run-baseline-search.mjs`
- `src/components/insights/baseline-efficiency-insights.tsx`
- `src/components/insights/search-outcome-insights.tsx`
- `src/components/runs/run-progress-panel.tsx`
- `src/lib/db/queries/sessions.ts`
- `src/lib/runs/deterministic-engine.ts`
- `src/lib/search-strategies/catalog.ts`
- `src/lib/search-strategies/session-strategies.ts`
- `src/components/sessions/session-strategy-form.tsx`
