# Intentional Stopover Foundation And Outcomes

Status: `Complete`

## Why this change was needed

The upgraded round-trip baseline was already producing stronger candidate-family
handoff artifacts, but baseline candidates still were not persisting stopover
rows unless a stopover-focused follow-up query explicitly injected the city
code.

That created a real gap:

- baseline candidates could show `stop_count > 0`
- baseline handoff families could still end up with no `stopoverCities`
- multi-city verification could review zero usable seeds
- the UI could not reliably distinguish generic stop flights from intentional
  stop opportunities

The resulting multi-city outcome board was also too loose. It described the
`cheapest multi-city trip` as the cheapest verified stopover candidate, even
when that trip did not satisfy the session's intentional-stop duration window.

## What changed

### 1. Baseline candidates now persist stopovers from visible cards

The baseline worker now derives stopover rows directly from the visible Trip.com
card text whenever a stop is visible, even when no explicit stopover-city
override was supplied.

That now applies to:

- direct sweep candidates
- return-option expansion candidates
- anchored departure follow-up candidates

The worker now:

- extracts stopover-city labels from outbound and return cards
- resolves city codes directly from the card text
- records candidate stopovers for those visible cities
- applies the session min/max stop-duration window to mark
  `isIntentional`
- carries those stopovers into `intentional_stop_count`

This means the baseline handoff and later multi-city stages can finally consume
real candidate-level stopover data instead of only query-level stopover hints.

### 2. Multi-city outcomes are now intentional-stop outcomes

`multi_city_verification_results` now distinguishes between:

- cheapest verified stopover trip
- cheapest intentional multi-city trip within the session stop window

The summary now records:

- `cheapestMultiCityCandidate`
  - now meaning the cheapest intentional-stop multi-city candidate
- `cheapestVerifiedMultiCityCandidate`
  - the cheapest verified stopover result regardless of whether it matched the
    intentional stop window
- per-city intentional candidate counts
- per-city cheapest intentional candidate price
- per-city cheapest verified stopover price
- the session stop window used to interpret the results

This keeps cheapness as a ranking signal without mislabeling generic stopover
results as successful intentional-stop outcomes.

### 3. Results visibility is now explicit

The results and run-progress surfaces now call this distinction out plainly:

- intentional multi-city results are labeled as intentional
- if no result matched the stop window, the UI says so explicitly
- generic verified stopover fares are still shown as fallback context
- route rows now show direct vs recorded-stop vs intentional-stop status more
  clearly

## Impact

This materially improves the end-to-end multi-city foundation:

- baseline now produces the stopover records multi-city actually needs
- baseline family handoff artifacts should now carry real stopover-city data
- multi-city verification now reports the outcome the product actually cares
  about
- users can distinguish:
  - cheapest round trip
  - cheapest verified stopover trip
  - cheapest intentional multi-city trip

## Remaining limits

- stopover timing is still inferred from visible card text and placeholder leg
  timing rather than exact reconstructed flight segments
- if Trip.com omits the city or duration from a visible card, the baseline still
  cannot persist that detail
- long-stop validation/follow-up remains a separate later-stage path and is not
  yet fully normalized to the same session min/max stop-window semantics

## Files changed

- `scripts/automation/run-baseline-search.mjs`
- `scripts/automation/lib/search-evidence.mjs`
- `src/components/insights/search-outcome-insights.tsx`
- `src/components/runs/run-progress-panel.tsx`
- `src/components/results/live-results-board.tsx`
