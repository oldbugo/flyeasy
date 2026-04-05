# Round Trip Baseline And Multi-City Cluster

Status: `In progress`

## Context

The earlier strategy-tab uplift still bundled stopover evidence follow-up inside
the baseline packaged-fare strategy.

That made two things harder than they should be:

- the baseline strategy was trying to do too much
- the stopover and multi-city direction did not have a clear strategy boundary

The follow-up product direction was to separate those concerns:

- keep the baseline focused on round-trip market discovery
- remove stopover verification from the baseline cluster
- create a dedicated strategy cluster for the multi-city direction
- make the handoff between strategies more legible through expected inputs and
  expected outputs

## Implemented Shape

### Round trip baseline

The former `Price-first market scan` is now presented to the user as
`Round trip baseline`.

Its focus is now explicitly narrower:

- direct round-trip sweep
- pass-1 evidence extraction
- optional anchored departure follow-up

Stopover verification is no longer part of the baseline cluster.

### Multi-city verification

A new optional `Multi-city verification` strategy cluster now owns the first
stopover-focused step.

Its current executable path is:

- review the cheapest round-trip winners from earlier strategies
- compare those winners against the strongest departure-date trends
- compare those winners against the cheapest airline trends
- rank stopover cities from the combined evidence
- verify the strongest stopover cities live
- run a dedicated long-stop validation stage against the verified cities

This is still not the final target shape. The longer-term direction remains a
deeper multi-city and long-stop verification cluster.

The next milestone after this document is recorded separately in
`06-long-stop-followup-pass.md`.

### Strategy handoff visibility

The strategy tab now shows:

- expected inputs per strategy
- expected outputs per strategy
- ordered strategy steps in the scan

This makes it clearer how one strategy hands evidence to the next instead of
making each strategy look like an isolated tuning panel.

## Current Status

`Complete`:

- baseline renamed to `Round trip baseline`
- baseline stopover verification removed
- multi-city work split into a separate strategy cluster
- expected inputs and outputs shown per strategy in the UI
- multi-city verification now reviews top round-trip winners before it chooses
  stopover cities
- multi-city verification now uses baseline departure-date and airline trends
  when it ranks cities
- a `multi_city_verification_rank` analysis snapshot is recorded before the
  verification queries run
- a dedicated `multi_city_long_stop_validation` analysis stage now runs after
  city verification
- the strategy tab and run view now surface the latest multi-city evidence and
  long-stop readiness output
- the follow-on long-stop query pass now exists and is documented separately in
  `06-long-stop-followup-pass.md`

`In progress`:

- stronger longer-stop validation beyond the first readiness stage
- stronger use of route-shape and candidate-family history inside the
  multi-city cluster
- richer city-specific follow-up beyond the current ranked verification probe

`Not started`:

- a dedicated candidate-review explanation view in the session UI

## Verification

- `npm run typecheck`
- `npm run lint`
