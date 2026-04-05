# Current State Review

## Artefacts Reviewed

### Planning and foundation

- `docs/planning/foundation/search-strategy.md`
- `docs/planning/foundation/automation-spec.md`
- `docs/planning/foundation/automation-architecture.md`
- `docs/planning/foundation/data-model.md`

### Existing uplift records

- `docs/uplifts/2026-03-query-led-search-model/README.md`
- `docs/uplifts/2026-03-pass1-analysis-layer/README.md`
- `docs/uplifts/2026-03-tripcom-combination-branch-search/README.md`
- `docs/uplifts/2026-03-results-grouping-and-dedupe/README.md`

### Runtime and persistence

- `src/lib/runs/plan-strategies.ts`
- `src/lib/runs/create-run-from-session.ts`
- `src/lib/runs/deterministic-engine.ts`
- `scripts/automation/run-baseline-search.mjs`
- `src/lib/db/schema/run.ts`
- `src/lib/db/schema/ai.ts`

### UI and user-facing framing

- `src/components/ai/strategy-proposal-list.tsx`
- `src/components/ai/ai-influence-panel.tsx`
- `src/components/runs/run-progress-panel.tsx`
- `src/app/sessions/[sessionId]/page.tsx`
- `src/components/sessions/session-form.tsx`

## How The Current System Works

### 1. Session authoring

The session captures:

- route endpoints
- departure and return bounds
- trip-duration bounds
- stop-duration bounds
- booking mode
- max stops
- search intensity

This gives the engine a constrained search space, but the only real search-shape
control exposed to the user is `searchIntensity`.

### 2. Run planning

`planStrategiesForSession()` compiles the session into a fixed queue. Today that
queue is not strategy selection in a broad sense; it is a prewritten recipe with
only a few intensity-based limits:

- `packaged_direct_sweep`
- `pass1_analysis`
- `packaged_departure_anchor_followup`
- optional `packaged_stopover_followup`
- optional `stitched_followup`

The planner does not currently:

- choose between strategy families based on evidence
- vary strategy ordering by session shape
- maintain an exploration vs exploitation portfolio
- score competing strategy candidates before queueing them

### 3. Baseline live search

The live worker enumerates every legal outbound/return pair inside the allowed
window, then samples them evenly by the direct-sweep limit from
`searchIntensity`.

For each sampled pair it:

- constructs a Trip.com direct round-trip URL
- loads outbound results
- sorts by cheapest
- scans visible outbound cards
- explores multiple outbound branches
- opens return results behind each branch
- scans multiple return options per branch
- persists extracted candidates and query summaries

This is a meaningful improvement over the original one-branch model, but it is
still a bounded fixed pattern rather than a flexible search framework.

### 4. Pass 1 analysis

After the direct sweep, the worker runs deterministic local analysis over the
recorded queries and linked candidates.

It currently derives:

- cheapest departure dates
- cheapest outbound airlines
- cheapest departure-date plus airline combinations
- observed stopover city frequencies and prices
- recommended departure-date anchors

This analysis is persisted and shown in the UI. That is a good foundation, but
it only drives one concrete next action today: anchored departure-date follow-up.

### 5. Anchored departure follow-up

The anchored follow-up takes the strongest departure dates from pass 1 and tests
additional return-date combinations that were not already sampled in the direct
sweep.

This is the first genuinely evidence-led branch in the current system, but it is
still narrow:

- only departure-date evidence is actionable
- follow-up remains the same direct-query execution pattern
- there is no generalized mechanism for other evidence types to create new work

### 6. Stopover follow-up

The stopover follow-up reads recorded stopover evidence from completed direct
queries, picks a small number of cheapest observed mainland-China cities, then
reuses stored Trip.com result URLs to search for cards that mention that city.

The current selection mechanism is fragile because it depends on:

- visible-card text matching
- repeated Trip.com page reloads
- inferred stopover matching rather than a stable upstream query primitive

The implementation is transparent about failures, which is good, but the method
itself remains brittle.

### 7. Stitched follow-up

`stitched_followup` is currently not a live stitched search. It derives
synthetic stitched candidates from previously extracted packaged candidates by
applying a discount and different risk notes.

This is useful as a placeholder for UI and data-model testing, but it is not a
real search methodology yet.

### 8. Suggestion layer

The so-called AI proposal flow is deterministic rule generation:

- it inspects the current planned strategy types
- it may draft a stitched follow-up comparison
- it validates that draft
- the user can accept or dismiss it
- accepted proposals are inserted into the run queue

There is no external model, no historical pattern mining across runs, and no
genuine inference step. The current naming overstates what the feature is.

## What Is Strong Already

- Query execution is now first-class and auditable.
- The run model can persist strategy rows, query rows, linked candidates, and
  analysis snapshots.
- The worker records branch-search coverage, not just final candidate prices.
- The UI exposes strategy queue, query log, and pass-1 analysis in a useful way.
- The schema is ahead of the runtime in a good sense: it can support a richer
  planner than the current implementation uses.

## Main Strategic Gaps

### 1. Planning and runtime are out of alignment

The foundation spec describes a broader strategy catalog:

- direct baselines
- one-stop and two-stop sweeps
- open-jaw returns
- stitched hub splits
- date-neighborhood expansion
- duration expansion
- bounded AI experimentation

The live runtime currently executes only a small subset of that picture.

### 2. The planner is recipe-based, not portfolio-based

The current engine decides counts, not strategy families. `searchIntensity`
changes sample size, branch count, and follow-up count, but it does not change
the search logic in a substantive way.

### 3. Evidence is collected more broadly than it is used

The system records enough information to support richer search follow-up, but
today only two evidence types are actionable:

- cheap departure dates
- observed stopover cities

Airlines, route patterns, branch-coverage data, and cross-run history do not yet
feed back into planner decisions.

### 4. Execution and planning are too coupled

Strategy meaning currently lives across:

- planner code
- worker `if/else` branches
- query payload conventions

There is no intermediate search-program layer that can be compiled, inspected,
scored, and then executed by adapters.

### 5. Suggestion language is misleading

The product currently says:

- `AI strategy suggestions`
- `AI influence`
- `accepted AI ideas`

But the implementation is deterministic rule-based proposal generation. That
creates both credibility risk and design confusion.

### 6. User intent is under-expressed

The user can currently set route constraints and `searchIntensity`, but cannot
shape search behavior in more meaningful terms such as:

- explore new patterns more aggressively
- focus on proven cheap structures
- prioritize lower-risk packaged results
- spend more budget on alternate return-city exploration

## Working Assessment

The current system is not badly designed. It has evolved into a much better
measurement and observability layer than the first baseline implementation.

The real limitation is architectural:

- it can measure more than it can decide
- it can record more than it can exploit
- it presents a suggestion layer that is less capable than its label suggests

The next uplift should therefore focus on a flexible search-program model and an
honest recommendation/suggestion model before adding more one-off branches.
