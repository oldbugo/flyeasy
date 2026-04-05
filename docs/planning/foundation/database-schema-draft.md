# Database Schema Draft

This document turns the conceptual data model into an implementation-oriented SQLite schema for the FlyEasy MVP.

It is intended to guide:

- the first Drizzle schema files
- the first migration set
- server-side query design
- route and action contracts

## Goal

Define a first database cut that is:

- stable enough to build the MVP UI against
- narrow enough to implement without overdesign
- compatible with later AI strategy and monitoring expansion

All enum-like values in this document should follow `canonical-state-model.md`.

## Database Choice

Use `SQLite` for the MVP.

Recommended implementation:

- `better-sqlite3` as the runtime driver
- `drizzle-orm` for typed schema definitions
- `drizzle-kit` for migrations

## Schema Design Rules

- Store timestamps as ISO 8601 UTC text.
- Use text primary keys generated in application code.
- Use explicit status columns instead of large polymorphic JSON blobs.
- Use JSON text only for snapshots, raw payloads, and flexible metadata.
- Do not store Trip.com credentials or browser session secrets in SQLite.
- Keep artifact binaries out of the database; store file paths only.

## MVP Table Set

These tables should exist in the initial schema:

- `session`
- `session_city_preference`
- `candidate_family`
- `search_run`
- `strategy_execution`
- `itinerary_candidate`
- `candidate_leg`
- `candidate_stopover`
- `verification_attempt`
- `price_observation`
- `session_shortlist_entry`
- `run_artifact`

This table can be deferred:

- `ai_strategy_proposal`
- `candidate_family`

## Proposed Drizzle Modules

Split schema definitions by domain rather than by one file per table.

```text
src/lib/db/schema/
  session.ts
  run.ts
  candidate.ts
  verification.ts
  artifact.ts
  index.ts
```

## Enum Strategy

SQLite does not have native enums, so model enums as `text` with:

- application-level Zod validation
- database-level `check` constraints for stable values

## Tables

### `session`

The primary user-facing container for a trip hunt.

Suggested columns:

- `id` text primary key
- `name` text not null
- `lifecycle_state` text not null
- `monitoring_state` text not null
- `is_live` integer not null default 0
- `origin_airport` text not null
- `outbound_destination_city` text not null
- `return_destination_airport` text not null
- `return_origin_mode` text not null
- `return_origin_city` text null
- `departure_start_date` text not null
- `departure_end_date` text not null
- `duration_min_days` integer null
- `duration_max_days` integer null
- `return_start_date` text null
- `return_end_date` text null
- `layover_scope` text not null
- `max_stops` integer not null
- `stop_duration_min_days` integer not null
- `stop_duration_max_days` integer not null
- `booking_mode` text not null
- `search_intensity` text not null
- `cabin_policy` text not null
- `notes` text null
- `last_run_started_at` text null
- `last_run_finished_at` text null
- `last_successful_run_id` text null
- `current_best_candidate_id` text null
- `created_at` text not null
- `updated_at` text not null

Checks:

- `lifecycle_state` in `draft`, `live_running`, `live_idle`, `needs_attention`, `not_live`, `completed`, `archived`
- `monitoring_state` in `enabled`, `disabled`, `blocked`
- `return_origin_mode` in `fixed_city`, `any_mainland_city`
- `layover_scope` in `mainland_china`
- `booking_mode` in `single_booking`, `stitched`, `both`
- `search_intensity` in `low`, `balanced`, `high`
- `cabin_policy` in `any`
- `max_stops` between `0` and `2`
- `stop_duration_min_days >= 0`
- `stop_duration_max_days >= stop_duration_min_days`

Notes:

- In v1, the session row stores the active search definition inline.
- `current_best_candidate_id` is a convenience pointer for dashboard rendering and can be nullable.

### `session_city_preference`

Optional city preferences attached to a session.

Suggested columns:

- `id` text primary key
- `session_id` text not null references `session(id)` on delete cascade
- `city_code` text not null
- `role` text not null
- `priority` integer not null
- `created_at` text not null

Checks:

- `role` in `preferred_stopover_city`, `excluded_stopover_city`, `preferred_return_origin_city`
- `priority >= 0`

Unique constraints:

- unique on `session_id`, `city_code`, `role`

### `search_run`

One execution of a session's current search definition.

Suggested columns:

- `id` text primary key
- `session_id` text not null references `session(id)` on delete cascade
- `run_mode` text not null
- `status` text not null
- `trigger_source` text not null
- `started_at` text not null
- `finished_at` text null
- `search_snapshot_json` text not null
- `total_strategies_planned` integer not null default 0
- `total_strategies_executed` integer not null default 0
- `total_candidates_found` integer not null default 0
- `total_candidates_verified` integer not null default 0
- `best_candidate_id` text null
- `summary_text` text null
- `failure_reason` text null
- `recovery_state` text not null default 'not_required'
- `recovery_type` text null
- `recovery_reason` text null
- `blocked_at` text null
- `resume_available` integer not null default 0
- `resume_mode` text null
- `resume_checkpoint_json` text null
- `recovery_completed_at` text null
- `created_at` text not null

Checks:

- `run_mode` in `interactive`, `monitoring`
- `status` in `queued`, `running`, `blocked`, `paused`, `completed`, `failed`, `cancelled`
- `trigger_source` in `manual`, `scheduled`, `rerank_only`, `debug`
- `recovery_state` in `not_required`, `pending`, `completed`, `abandoned`
- `recovery_type` in `login_required`, `challenge_required`, `verification_blocked`, `app_interrupted` or null
- `resume_mode` in `same_run`, `partial_restart`, `new_run` or null

Notes:

- `search_snapshot_json` is required so reruns remain reproducible even if the session later changes.
- `best_candidate_id` may be populated after candidates exist; leave it as a loose foreign key for migration simplicity in v1.
- `resume_checkpoint_json` should hold only the smallest safe recovery context needed to continue or replay work.

### `strategy_execution`

One concrete strategy attempt within a run.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null references `search_run(id)` on delete cascade
- `parent_strategy_execution_id` text null references `strategy_execution(id)` on delete set null
- `strategy_type` text not null
- `source_type` text not null
- `priority` integer not null
- `reason` text not null
- `strategy_payload_json` text not null
- `status` text not null
- `estimated_search_cost` integer not null default 0
- `actual_search_cost` integer null
- `started_at` text not null
- `finished_at` text null
- `candidate_count` integer not null default 0
- `verified_candidate_count` integer not null default 0
- `best_candidate_id` text null
- `failure_reason` text null

Checks:

- `source_type` in `system`, `ai`
- `status` in `queued`, `running`, `blocked`, `completed`, `failed`, `skipped`, `cancelled`

### `candidate_family`

Stable cross-run route-pattern identity for shortlist continuity, monitoring summaries, and change tracking.

Suggested columns:

- `id` text primary key
- `session_id` text not null references `session(id)` on delete cascade
- `family_key` text not null
- `booking_type` text not null
- `trip_shape` text not null
- `route_summary_json` text not null
- `first_seen_at` text not null
- `last_seen_at` text not null

Checks:

- `booking_type` in `single_booking`, `stitched`
- `trip_shape` in `round_trip`, `open_jaw`

Unique constraints:

- unique on `session_id`, `family_key`

### `itinerary_candidate`

The main result object surfaced to the user.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null references `search_run(id)` on delete cascade
- `strategy_execution_id` text not null references `strategy_execution(id)` on delete cascade
- `candidate_family_id` text not null references `candidate_family(id)` on delete cascade
- `dedupe_key` text not null
- `booking_type` text not null
- `trip_shape` text not null
- `outbound_destination_city` text not null
- `return_origin_city` text null
- `stop_count` integer not null
- `intentional_stop_count` integer not null default 0
- `displayed_source_currency` text not null
- `displayed_source_amount` numeric not null
- `displayed_display_currency` text not null
- `displayed_display_amount` numeric not null
- `latest_verified_source_currency` text null
- `latest_verified_source_amount` numeric null
- `latest_verified_display_currency` text null
- `latest_verified_display_amount` numeric null
- `latest_verification_status` text not null
- `fare_class_summary` text null
- `total_travel_minutes` integer null
- `stitched_risk_level` text null
- `risk_notes` text null
- `tripcom_resume_url` text null
- `tripcom_resume_token` text null
- `first_seen_at` text not null
- `last_seen_at` text not null
- `last_ranked_at` text null
- `is_current_best` integer not null default 0

Checks:

- `booking_type` in `single_booking`, `stitched`
- `trip_shape` in `round_trip`, `open_jaw`
- `latest_verification_status` in `not_checked`, `verified`, `repriced`, `unavailable`, `partial`, `failed`
- `stitched_risk_level` in `low`, `medium`, `high` or null
- `stop_count >= 0`
- `intentional_stop_count >= 0`

Unique constraints:

- unique on `search_run_id`, `dedupe_key`

Notes:

- `dedupe_key` should reflect itinerary identity, not current price.
- `candidate_family_id` links each run-scoped row to a stable cross-run route-pattern identity.
- The source/display currency split supports both Trip.com-native prices and normalized UI prices.

### `candidate_leg`

Flight-leg detail for an itinerary candidate.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null references `itinerary_candidate(id)` on delete cascade
- `leg_index` integer not null
- `segment_group` text not null
- `booking_reference_group` text not null
- `carrier_code` text null
- `flight_number` text null
- `origin_airport` text not null
- `destination_airport` text not null
- `departure_at` text not null
- `arrival_at` text not null
- `cabin_class` text null
- `fare_brand` text null
- `baggage_summary` text null
- `created_at` text not null

Unique constraints:

- unique on `itinerary_candidate_id`, `leg_index`

### `candidate_stopover`

Stop and layover detail for an itinerary candidate.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null references `itinerary_candidate(id)` on delete cascade
- `stop_index` integer not null
- `city_code` text not null
- `airport_code` text not null
- `country_code` text not null
- `arrival_at` text not null
- `departure_at` text not null
- `duration_minutes` integer not null
- `is_intentional` integer not null default 0
- `created_at` text not null

Unique constraints:

- unique on `itinerary_candidate_id`, `stop_index`

### `verification_attempt`

One deep validation pass against Trip.com.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null references `itinerary_candidate(id)` on delete cascade
- `search_run_id` text not null references `search_run(id)` on delete cascade
- `attempt_index` integer not null
- `status` text not null
- `failure_code` text null
- `failure_detail` text null
- `checkout_stage_reached` text null
- `source_currency` text null
- `source_amount` numeric null
- `display_currency` text null
- `display_amount` numeric null
- `started_at` text not null
- `finished_at` text null

Checks:

- `status` in `running`, `blocked`, `verified`, `repriced`, `unavailable`, `partial`, `failed`, `cancelled`

Unique constraints:

- unique on `itinerary_candidate_id`, `attempt_index`

Notes:

- `failure_code` should use the normalized taxonomy from the automation and recovery specs.

### `price_observation`

Append-only price history for candidates.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null references `itinerary_candidate(id)` on delete cascade
- `search_run_id` text not null references `search_run(id)` on delete cascade
- `verification_attempt_id` text null references `verification_attempt(id)` on delete set null
- `price_kind` text not null
- `source_currency` text not null
- `source_amount` numeric not null
- `display_currency` text not null
- `display_amount` numeric not null
- `fx_provider` text null
- `fx_rate` numeric null
- `fx_rate_timestamp` text null
- `observed_at` text not null

Checks:

- `price_kind` in `displayed_search_price`, `verified_checkout_price`

### `session_shortlist_entry`

User-managed shortlist state inside a session.

Suggested columns:

- `id` text primary key
- `session_id` text not null references `session(id)` on delete cascade
- `candidate_family_id` text not null references `candidate_family(id)` on delete cascade
- `itinerary_candidate_id` text not null references `itinerary_candidate(id)` on delete cascade
- `status` text not null
- `user_note` text null
- `created_at` text not null
- `updated_at` text not null

Checks:

- `status` in `shortlisted`, `top_pick`, `dismissed`

Unique constraints:

- unique on `session_id`, `candidate_family_id`

### `run_artifact`

Pointer table for automation artifacts.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null references `search_run(id)` on delete cascade
- `strategy_execution_id` text null references `strategy_execution(id)` on delete set null
- `verification_attempt_id` text null references `verification_attempt(id)` on delete set null
- `artifact_type` text not null
- `file_path` text not null
- `mime_type` text null
- `created_at` text not null

Checks:

- `artifact_type` in `screenshot`, `html_snapshot`, `playwright_trace`, `json_export`

## Index Plan

Create these indexes in the first migration:

- `session(lifecycle_state, updated_at desc)`
- `session(monitoring_state, updated_at desc)`
- `candidate_family(session_id, family_key)`
- `search_run(session_id, started_at desc)`
- `search_run(session_id, status, started_at desc)`
- `strategy_execution(search_run_id, status, priority)`
- `itinerary_candidate(search_run_id, latest_verification_status, latest_verified_display_amount)`
- `itinerary_candidate(dedupe_key)`
- `candidate_stopover(city_code, is_intentional)`
- `verification_attempt(itinerary_candidate_id, started_at desc)`
- `price_observation(itinerary_candidate_id, observed_at desc)`
- `session_shortlist_entry(session_id, status, updated_at desc)`

## Relations Summary

- one `session` has many `session_city_preference`
- one `session` has many `candidate_family`
- one `session` has many `search_run`
- one `session` has many `session_shortlist_entry`
- one `candidate_family` has many `itinerary_candidate`
- one `candidate_family` has many `session_shortlist_entry`
- one `search_run` has many `strategy_execution`
- one `search_run` has many `itinerary_candidate`
- one `search_run` has many `run_artifact`
- one `strategy_execution` has many `itinerary_candidate`
- one `itinerary_candidate` has many `candidate_leg`
- one `itinerary_candidate` has many `candidate_stopover`
- one `itinerary_candidate` has many `verification_attempt`
- one `itinerary_candidate` has many `price_observation`

## First Migration Scope

The first migration should include:

1. all MVP tables except `ai_strategy_proposal`
2. all foreign keys listed above
3. all unique constraints listed above
4. the initial index set
5. enum-like check constraints for stable statuses

## Deferred Fields And Tables

These can wait until later if implementation pressure is high:

- richer AI strategy storage
- cross-run `candidate_family` normalization
- model provenance fields for AI explanations
- aggregate analytics tables
- notification delivery tables
- cached compare-view snapshots

## Query Design Notes

The schema should support these common reads cheaply:

- dashboard session list with current state and best candidate summary
- latest run for a session
- current run progress summary
- candidate list for a run ordered by verified display price
- candidate detail with legs, stopovers, verification history, and price observations
- history view with run list and price movement

For MVP, it is acceptable to compose some of these with multiple queries rather than a single large join.

## Recommended Next Step

After this schema draft, create:

1. the route and page contract spec
2. the API and server action contract spec
3. the automation event schema
4. the initial Drizzle schema files
