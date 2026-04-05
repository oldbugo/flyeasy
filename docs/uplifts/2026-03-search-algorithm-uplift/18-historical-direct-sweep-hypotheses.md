# Historical Direct-Sweep Hypotheses

Status: `Complete`

## Why this review was needed

The next efficiency uplift needed to be grounded in real FlyEasy run history,
not intuition alone.

The specific question was whether the existing round-trip baseline was wasting
too much budget by sweeping date pairs in a fixed linear order, and if so,
which replacement algorithm was most justified by the data already recorded.

## Dataset reviewed

Reviewed on `2026-03-17` against the local FlyEasy database:

- completed runs: `42`
- sessions with completed runs: `6`
- completed `packaged_direct_sweep` executions: `30`

## What the historical data says

### 1. Direct sweep produces a lot of duplicate candidate pressure

Across the `30` completed direct-sweep executions:

- average candidates per direct sweep: `51.43`
- average distinct candidate families per direct sweep: `8.17`
- average duplication rate: `74.27%`

Interpretation:

- the current direct sweep is spending a lot of work on repeated variants of a
  relatively small number of candidate families
- this makes a purely linear cheapest-first interpretation much less useful than
  it initially appears

### 2. The best direct fare often appears late in the sweep

The query priority that first contained the final best direct-sweep fare was:

- priority `0`: `2` runs
- priority `1`: `3` runs
- priority `2`: `4` runs
- priority `3`: `7` runs
- priority `4`: `3` runs
- priority `5`: `8` runs
- priority `6`: `11` runs

Interpretation:

- a naive linear sweep is not reliably finding the best fare early
- there is room for a better budget-allocation policy after the first few
  exploratory queries

### 3. Family discovery improves much faster than best-fare discovery

Cumulative direct-sweep performance by query priority:

- after priority `0`
  - final-best fare already found in `6.67%` of runs
  - average final family coverage already at `28.24%`
- after priority `2`
  - final-best fare already found in `30%` of runs
  - average final family coverage already at `71%`
- after priority `4`
  - final-best fare already found in `60%` of runs
  - average final family coverage already at `92.84%`
- after priority `5`
  - final-best fare already found in `86.67%` of runs
  - average final family coverage already at `95.69%`

Interpretation:

- broad family coverage arrives earlier than the final winning fare
- this supports a two-stage approach:
  - cover the space first
  - then adapt the remaining budget

### 4. Cross-run priors are useful, but only at the right level

Top-3 prior hit rates by session history were:

- `China April Hunt`
  - airline hit rate: `80%`
  - departure-date hit rate: `44%`
  - exact date-pair hit rate: `20%`
- `Flexible Guangzhou Backup`
  - airline hit rate: `83.33%`
  - departure-date hit rate: `41.67%`
  - exact date-pair hit rate: `41.67%`

Interpretation:

- airline priors are directionally useful
- departure-date priors are weaker but still worth using as a soft signal
- exact historical date-pair replay is too weak to become the primary planner

## Hypotheses reviewed

### Hypothesis 1: Adaptive coverage baseline

Description:

- begin with an even seed sweep across the allowed date space
- then spend the remaining direct-sweep budget on date pairs chosen from:
  - current-run reward
  - under-covered departure buckets
  - weak historical session priors

Feasibility: `High`

Why:

- the worker already records enough query-level outcome detail to score early
  direct-sweep queries
- the data supports coverage first, then adaptive exploitation
- this can be added without needing a new adapter or a new storage model

Decision: `Chosen for implementation`

### Hypothesis 2: Historical replay baseline

Description:

- skip broad exploration and replay the historically strongest date pairs first

Feasibility: `Medium`

Why it was not chosen as the main uplift:

- exact date-pair priors are too weak and too session-specific
- this would overfit quickly and risk missing new market shifts

Decision: `Rejected as the primary baseline`

### Hypothesis 3: Successive-halving branch racing

Description:

- start many date pairs very shallow
- quickly drop underperforming branches
- deepen only the best surviving branches

Feasibility: `Medium`

Why it was deferred:

- the current adapter does not yet have a cheap, trustworthy partial-evaluation
  stage that can rank a branch before full outbound/return extraction
- it remains promising later, especially if Trip.com interaction costs can be
  split into a cheaper preview stage and a deeper extraction stage

Decision: `Defer`

### Hypothesis 4: Full bandit planner across strategy families

Description:

- allocate budget dynamically not only within the baseline, but across baseline,
  multi-city, alternate-city, and stitched strategy families

Feasibility: `Low to medium right now`

Why it was deferred:

- the shared scoring model is not complete yet
- expected value, novelty, and operational risk are not normalized across
  families yet

Decision: `Defer until the scoring layer is stronger`

## Outcome

The data supported one clear next step:

- keep the existing round-trip baseline available
- add a second selectable baseline that keeps early coverage broad
- let that second baseline adapt its remaining direct-sweep budget instead of
  spending it in fixed linear order

That is the basis for the `Adaptive coverage baseline` implementation recorded
in `19-adaptive-coverage-baseline-and-efficiency-insights.md`.
