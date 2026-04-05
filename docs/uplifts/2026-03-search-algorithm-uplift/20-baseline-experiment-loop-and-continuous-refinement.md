# Baseline Experiment Loop And Continuous Refinement

Status: `Complete`

## Why this change was needed

Adding a second baseline strategy was not enough on its own.

Without a repeatable way to compare baseline runs over time, FlyEasy would
still be relying on ad hoc judgments such as:

- one-off fare wins
- isolated route anecdotes
- remembering which run felt better

That is not a stable path to algorithm refinement.

## What changed

### 1. Added a session-level baseline experiment board

Overview and Results now surface a `Baseline strategy lab` board that compares
recent completed baseline runs within the same session.

The board now aggregates runs by baseline label and shows:

- average cheapest fare
- best observed cheapest fare
- average query where the best fare was first discovered
- average half-budget family coverage
- average distinct family count
- average stopover clue count
- average city-entry count
- average duplication pressure
- intentional multi-city hit counts

It also lists the recent run trail so the budget pattern stays visible.

### 2. Added a lightweight champion-versus-challenger readout

The board now computes a simple comparative readout between tested baselines in
the same session.

It does not claim certainty. Instead it answers:

- is there enough data to compare the baselines yet
- which baseline is currently ahead on the observed metrics
- which metrics are driving that lead

### 3. Defined the operating rule for baseline experiments

The intended testing loop is now:

1. keep the session settings fixed
2. switch only the baseline strategy
3. run both baselines on the same session repeatedly
4. compare the baseline experiment board, not just the cheapest fare
5. only treat a new baseline as stronger when its lead persists across multiple
   alternating runs

## Continuous-improvement model

This creates the first sustainable refinement loop for search methodology:

- keep the incumbent baseline available
- add one challenger baseline at a time
- instrument the baseline with per-run efficiency evidence
- compare both on the same session
- refine the reward/scoring rules
- keep or discard the challenger based on repeated evidence

This is intentionally conservative. It avoids locking FlyEasy into a new search
method simply because one run happened to look better.

## Current readout

The first real comparison that triggered this work showed:

- `Adaptive coverage baseline`
  - matched the same cheapest fare as the stable baseline
  - found it earlier in the sweep
  - reached broader family coverage halfway through the budget

That is encouraging, but it is still an early signal. The board now exists so
future refinements can be judged over a growing run history instead of memory.

## Files changed

- `src/lib/db/queries/sessions.ts`
- `src/components/insights/baseline-experiment-board.tsx`
- `src/app/sessions/[sessionId]/page.tsx`
- `src/app/sessions/[sessionId]/results/page.tsx`
