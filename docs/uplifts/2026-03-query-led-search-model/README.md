# Query-Led Search Model

## Context

The original live Trip.com baseline run was too narrow for the product goal.

It could create persisted candidates, but it was not searching the problem in a
disciplined way:

- it effectively used one exact date pair instead of respecting the full
  departure window and duration range
- it did not record each concrete query as a first-class object
- it could not clearly explain which searches were run, which stopover cities
  were observed, or why a second-pass follow-up existed
- session-level city preferences were biasing the search path before the
  price-first engine itself had been proven

The uplift goal was to make the search engine query-led, price-first, and
auditable.

## Goal

Implement a two-pass search model for baseline runs:

1. direct round-trip sweep across sampled date pairs inside the allowed window
2. evidence-driven follow-up queries only from stopover cities actually exposed
   by the cheapest direct results

The system should record enough structured information that another developer,
AI agent, or operator can answer:

- which exact queries ran
- why each query existed
- what date pair it used
- what it found
- which stopover evidence led to any derived follow-up

## Scope

Included in this uplift:

- remove active city preference and exclusion inputs from the session authoring
  flow
- add query-level persistence for live Trip.com runs
- make the planner start with a direct round-trip sweep
- derive second-pass follow-up only from observed stopover evidence
- expose query logs in the run progress UI

Excluded from this uplift:

- changing the underlying session schema to delete old preference tables
- deep verification or logged-in booking progression
- stitched-search redesign beyond using the new direct sweep as the seed

## Query Schema

### `query_execution`

One row per concrete search query.

- `id`
- `search_run_id`
- `strategy_execution_id`
- `parent_query_execution_id`
- `query_type`
  - `direct_round_trip`
  - `stopover_filtered_round_trip`
- `source`
  - `planned`
  - `derived_from_result`
- `priority`
- `status`
  - `queued`
  - `running`
  - `blocked`
  - `completed`
  - `failed`
  - `skipped`
  - `cancelled`
- `reason`
- `query_input_json`
- `result_summary_json`
- `observed_stopover_cities_json`
- `tripcom_result_url`
- `started_at`
- `finished_at`
- `failure_reason`
- `created_at`

### `query_candidate_link`

Links a persisted itinerary candidate back to the query that produced it.

- `id`
- `query_execution_id`
- `itinerary_candidate_id`
- `link_type`
- `created_at`

### `query_input_json`

Current live payload fields:

- `allPossibleDatePairCount`
- `departDate`
- `returnDate`
- `durationDays`
- `destinationCityCode`
- `baseResultUrl` for derived follow-up
- `parentQueryExecutionId` for derived follow-up
- `stopoverCityCode`
- `stopoverCityName`

### `result_summary_json`

Current live payload fields:

- `candidateCount`
- `cheapestPrice`
- `departDate`
- `returnDate`
- `stopoverCityCount`
- `parentQueryExecutionId`
- `stopoverCityCode`
- `stopoverCityName`

## Implementation Strategy

### Search logic

- Planner starts with `packaged_direct_sweep`.
- Search intensity determines how many date pairs are sampled.
- Date pairs are generated from:
  - `departure_start_date`
  - `departure_end_date`
  - `duration_min_days`
  - `duration_max_days`
  - optional `return_start_date`
  - optional `return_end_date`
- The second pass only exists if the direct sweep exposes mainland China
  stopover cities and the session allows stops.

### Product behavior changes

- Session authoring is now price-first.
- The active form no longer asks the user to curate preferred or excluded
  stopover cities.
- The review screen explains the two-pass search logic explicitly.

### Observability

- Run progress now shows a query log, not just strategy rows.
- Query failures are surfaced honestly instead of being hidden as skipped work.
- Observed stopover evidence is persisted even when follow-up execution later
  fails.

## Outcome

Implemented:

- query persistence in the live run model
- direct date-pair sweep planning
- evidence-derived follow-up planning
- explicit cheapest-first ranking within each Trip.com result stage instead of
  trusting the default visible card order
- wider visible-card scanning before outbound selection and return candidate
  extraction
- query log UI
- active removal of preference/exclusion city inputs from the session flow
- price-first AI/system planning path cleanup

Verified:

- `Flexible Guangzhou Backup` now records sampled direct queries across the full
  allowed date range instead of one narrow date pair
- example verified run:
  - `795` possible date pairs in range
  - sampled direct queries included:
    - `2026-04-08` to `2026-04-22`
    - `2026-05-04` to `2026-05-25`
    - `2026-05-30` to `2026-06-27`
- balanced runs now persist both direct query rows and derived follow-up query
  rows with explicit parent linkage and reasons

Current limitation:

- the direct sweep is working live against Trip.com
- the second-pass stopover follow-up is implemented structurally, but the live
  Trip.com filter interaction still becomes unreliable after repeated direct
  sweep activity
- the app now records that failure honestly:
  - derived `query_execution` rows end in `failed`
  - the follow-up strategy ends in `failed`, not `skipped`
  - the run summary treats it as a non-blocking expansion failure

## Follow-Up Notes

Recommended next iteration:

1. replace the current sidebar-filter click dependency with a more direct
   Trip.com follow-up query path if one can be identified
2. if Trip.com does not expose a stable direct URL shape for stopover-filtered
   searches, consider a dedicated secondary automation profile or an alternate
   interaction route that does not depend on the fragile filter sidebar state
3. keep using the new query model as the measurement layer regardless of how the
   second-pass execution changes
