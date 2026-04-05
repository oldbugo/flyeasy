# Anchored True Multi-City Search

## Status

- `Complete`

## Goal

Add a real Trip.com multi-city strategy that converts strong baseline stopover
clues into bounded three-leg searches, instead of only replaying round-trip
result pages with stopover filters.

The intended search shape is:

- keep the baseline origin, primary destination, and final return date
- use a stopover city discovered by the round-trip baseline
- vary the stopover departure date inside the session stop window
- surface the cheapest qualifying true multi-city trip

## What Changed

### New strategy bundle

The strategy catalog now includes:

- `Anchored multi-city search`

This optional bundle sits after the baseline and uses the baseline handoff to
choose:

- which cities to convert into true multi-city probes
- which baseline family contexts to keep per city
- how many stopover date variations to test
- how many distinct options to keep per Trip.com segment stage

### True Trip.com adapter

The worker now supports a new query type:

- `anchored_multi_city`

Each query builds a deterministic Trip.com `triptype=mt` URL with three legs:

1. origin -> stopover city
2. stopover city -> original destination city
3. original destination city -> return airport

The adapter keeps the baseline departure and final return dates anchored, then
samples bounded stopover departure dates between the session stop-duration
minimum and maximum.

### Candidate output

True multi-city candidates are now persisted as normal itinerary candidates so
the existing results surfaces can reuse them without a parallel schema.

Each candidate records:

- three legs
- the anchored intentional stopover city
- stop duration
- qualifying intentional-stop count
- baseline price delta through the results summary

### Results visibility

Overview, Results, and run progress now understand:

- `anchored_multi_city_results`

They show:

- cheapest qualifying true multi-city trip
- cheapest verified true multi-city fallback
- cheapest result per stopover city
- bounded query-budget summary for the adapter

## Boundaries

This is intentionally bounded.

It does **not** yet:

- brute-force every date inside the full calendar
- explore unbounded segment combinations
- replace the older multi-city verification cluster
- solve open-jaw or alternate return-origin planning

The older verification cluster still exists for cheaper signal-checking. This
new strategy is the first real Trip.com multi-city adapter beside it.

## Verification

Verified with:

- `node --check D:\\flyeasy\\scripts\\automation\\run-baseline-search.mjs`
- `node --check D:\\flyeasy\\scripts\\automation\\lib\\search-evidence.mjs`
- `npm run typecheck`
- `npm run lint`
