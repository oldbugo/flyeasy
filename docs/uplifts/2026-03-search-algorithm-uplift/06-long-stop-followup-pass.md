# Long-Stop Follow-Up Pass

Status: `Complete`

## Context

The multi-city cluster previously stopped at long-stop readiness analysis.

That was useful as a signal, but it still left a gap:

- the system could say a city looked promising for a longer stop
- the system could not yet run a dedicated longer-stop query to prove it

The next bounded milestone was therefore to add a real executable pass after
validation without redesigning the whole Trip.com adapter.

## Implemented Shape

The multi-city cluster now has a third stage:

- stopover city verification
- long-stop validation
- long-stop follow-up

The new long-stop follow-up pass reuses the existing stopover-city query path,
but adds a minimum stop-duration threshold.

That means the pass now:

- takes the strongest cities from long-stop validation
- reopens the recorded result page for each city
- prioritizes cards that already show longer stop durations
- keeps only candidates that actually meet the configured long-stop threshold
- records a `multi_city_long_stop_followup` analysis snapshot for the run

## Why This Shape

This was the safest next step because it avoided a large execution-adapter
rewrite.

Instead of inventing a brand new browser flow, the uplift extends the existing
stopover-focused Trip.com query mechanics with one new behavior:

- duration-aware selection and filtering

That gives FlyEasy a real longer-stop search pass now, while keeping the next
refactor options open.

## User-Facing Changes

The strategy tab now presents the multi-city cluster as a three-stage flow:

- `Stopover city verification`
- `Long-stop validation`
- `Long-stop follow-up`

The cluster also now exposes:

- how many cities should receive the dedicated long-stop query
- the latest long-stop follow-up evidence from the newest run

The run progress view now shows the long-stop follow-up output separately from
the earlier ranking and readiness stages.

## Current Status

`Complete`:

- a true executable long-stop follow-up pass now runs after validation
- the pass uses a minimum stop-duration threshold
- the pass only keeps candidates that genuinely cross that threshold
- the strategy tab exposes the new pass and its bounded city limit
- the session strategy view shows the latest long-stop follow-up evidence
- the run progress view shows long-stop follow-up output
- a `multi_city_long_stop_followup` analysis snapshot is recorded

`In progress`:

- stronger city-stay and multi-city itinerary logic beyond duration-aware
  round-trip filtering
- better reuse of the new ranking and validation signals across future
  strategy clusters

`Not started`:

- alternate return-city exploration cluster
- shared evidence and scoring extraction outside the worker

## Verification

- `npm run typecheck`
- `npm run lint`
