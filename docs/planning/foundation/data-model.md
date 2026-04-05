# FlyEasy Data Model Spec

## Purpose

Define the concrete storage model for FlyEasy v1 so search execution, Trip.com verification, monitoring, and AI strategy learning all persist in a consistent way.

All enum-like values in this document should follow `canonical-state-model.md`.

## Storage Boundaries

FlyEasy v1 uses three storage classes:

### 1. SQLite

Primary structured application data:

- sessions
- search runs
- executed strategies
- candidate itineraries
- itinerary legs and stopovers
- verification attempts
- price history
- AI proposals and run summaries

### 2. Local encrypted secret store

Sensitive credentials and session material:

- Trip.com username
- Trip.com password
- session tokens or browser-state references
- API keys for AI providers

These must not be stored in SQLite.

### 3. Local filesystem artefacts

Large or transient automation artefacts:

- Playwright traces
- screenshots
- HTML snapshots
- exported result payloads for debugging

SQLite should store only paths and metadata for these artefacts, not the blobs themselves.

## Design Principles

- Single-user model for v1; do not add a `users` table.
- Keep search definitions first-class so monitoring and reruns are reproducible.
- Persist every verification attempt separately from candidate creation because Trip.com availability changes over time.
- Preserve both packaged and stitched itinerary structure in a shared candidate model.
- Favor relational storage for queryable fields and JSON only for low-value raw payloads or flexible metadata.

## Core Entity Overview

The model should center on these entities:

- `session`: long-lived trip hunt and primary user-facing container
- `search_run`: one execution of a session's current search definition
- `strategy_execution`: one strategy instance executed within a run
- `candidate_family`: stable cross-run route-pattern identity
- `itinerary_candidate`: a distinct priced itinerary surfaced during a run
- `candidate_leg`: one flight leg within a candidate
- `candidate_stopover`: one intentional or incidental stop within a candidate
- `verification_attempt`: one deep Trip.com validation attempt
- `price_observation`: point-in-time price record for a candidate
- `session_shortlist_entry`: user-level shortlist state for candidates inside a session
- `ai_strategy_proposal`: one AI-generated strategy suggestion
- `run_artifact`: pointer to screenshots, traces, or exported files

## Table Spec

### `session`

Represents a long-lived trip hunt and primary user-facing container.

In v1, the session row stores the active search definition inline rather than normalizing it into a separate `search_profile` table.

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
- `created_at` text not null
- `updated_at` text not null

Rules:

- Use either duration window or return-date window, but not both as required input.
- `return_origin_mode` should support `fixed_city` and `any_mainland_city`.
- `layover_scope` should initially support only `mainland_china`.

Enums:

- `lifecycle_state`: `draft`, `live_running`, `live_idle`, `needs_attention`, `not_live`, `completed`, `archived`
- `monitoring_state`: `enabled`, `disabled`, `blocked`
- `search_intensity`: `low`, `balanced`, `high`

### `session_city_preference`

Optional city preferences linked to a session.

Suggested columns:

- `id` text primary key
- `session_id` text not null
- `city_code` text not null
- `role` text not null
- `priority` integer not null

Purpose:

- pin preferred stopover cities
- exclude stopover cities
- pin preferred return-origin cities
- separate user preferences from global strategy defaults

Recommended roles:

- `preferred_stopover_city`
- `excluded_stopover_city`
- `preferred_return_origin_city`

### `search_run`

Represents one execution of a session's current search definition.

Suggested columns:

- `id` text primary key
- `session_id` text not null
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
- `recovery_state` text not null default `not_required`
- `recovery_type` text null
- `recovery_reason` text null
- `blocked_at` text null
- `resume_available` integer not null default 0
- `resume_mode` text null
- `resume_checkpoint_json` text null
- `recovery_completed_at` text null

Enums:

- `run_mode`: `interactive`, `monitoring`
- `status`: `queued`, `running`, `blocked`, `paused`, `completed`, `failed`, `cancelled`
- `trigger_source`: `manual`, `scheduled`, `rerank_only`, `debug`
- `recovery_state`: `not_required`, `pending`, `completed`, `abandoned`
- `recovery_type`: `login_required`, `challenge_required`, `verification_blocked`, `app_interrupted`
- `resume_mode`: `same_run`, `partial_restart`, `new_run`

The `search_snapshot_json` field stores the exact resolved request used for the run so later code changes do not break reproducibility.

Recovery metadata should be stored on the run so blocked-state UX and resume behavior survive app restarts.

### `strategy_execution`

Represents one concrete strategy run inside a search run.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null
- `parent_strategy_execution_id` text null
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

Enums:

- `source_type`: `system`, `ai`
- `status`: `queued`, `running`, `blocked`, `completed`, `failed`, `skipped`, `cancelled`

`strategy_payload_json` should match the normalized `SearchStrategy` document from the search strategy spec.

### `itinerary_candidate`

Represents one distinct itinerary candidate surfaced by a strategy.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null
- `strategy_execution_id` text not null
- `candidate_family_id` text not null
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

Enums:

- `booking_type`: `single_booking`, `stitched`
- `trip_shape`: `round_trip`, `open_jaw`
- `latest_verification_status`: `not_checked`, `verified`, `repriced`, `unavailable`, `partial`, `failed`
- `stitched_risk_level`: `low`, `medium`, `high`

`dedupe_key` should represent the itinerary identity independent of current price so repeated reruns can link observations to the same underlying route pattern.

For MVP, `candidate_family` should be implemented as a first-class table so shortlist continuity, monitoring summaries, and "what changed" comparisons do not depend on fragile run-to-run remapping.

### `candidate_family`

Represents a stable cross-run route pattern used for history, monitoring summaries, shortlist continuity, and price-change interpretation.

Suggested columns:

- `id` text primary key
- `session_id` text not null
- `family_key` text not null
- `booking_type` text not null
- `trip_shape` text not null
- `route_summary_json` text not null
- `first_seen_at` text not null
- `last_seen_at` text not null

Rules:

- `family_key` should be more stable than a run-scoped dedupe key
- price, resume URL, and temporary verification outcomes must not affect family identity
- this table can be deferred from the first migration if implementation pressure is high, but the model should anticipate it

### `candidate_leg`

One row per flight leg in an itinerary candidate.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null
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
- `raw_leg_payload_json` text null

Rules:

- `segment_group` distinguishes outbound and return.
- `booking_reference_group` groups legs under one booking for packaged trips or one separate ticket inside a stitched itinerary.

### `candidate_stopover`

One row per stopover extracted from the candidate.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null
- `stop_index` integer not null
- `city_code` text not null
- `airport_code` text not null
- `arrival_at` text not null
- `departure_at` text not null
- `duration_minutes` integer not null
- `is_intentional` integer not null
- `is_mainland_china` integer not null

Purpose:

- separate stopover analysis from raw legs
- support filtering by intentional multi-day stops
- support AI pattern learning over winning stopover cities

### `verification_attempt`

Tracks one deep Trip.com validation attempt for one candidate.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null
- `search_run_id` text not null
- `attempt_index` integer not null
- `status` text not null
- `started_at` text not null
- `finished_at` text null
- `observed_currency` text null
- `observed_total_amount` numeric null
- `price_delta_amount` numeric null
- `fare_class_summary` text null
- `availability_message` text null
- `checkout_stage_reached` text null
- `failure_reason` text null
- `verification_payload_json` text null

Enums:

- `status`: `running`, `blocked`, `verified`, `repriced`, `unavailable`, `partial`, `failed`, `cancelled`
- `checkout_stage_reached`: `results`, `details`, `traveler_form`, `final_review`

Each attempt is immutable once written except for the final `finished_at` and terminal status fields while the attempt is active.

### `price_observation`

Normalized price time series for candidates.

Suggested columns:

- `id` text primary key
- `itinerary_candidate_id` text not null
- `search_run_id` text not null
- `verification_attempt_id` text null
- `price_kind` text not null
- `source_currency` text not null
- `source_amount` numeric not null
- `display_currency` text not null
- `display_amount` numeric not null
- `fx_provider` text null
- `fx_rate` numeric null
- `fx_rate_timestamp` text null
- `observed_at` text not null

Enums:

- `price_kind`: `displayed_search_price`, `verified_checkout_price`

This table should be append-only and used for monitoring charts and price-change detection.

### `session_shortlist_entry`

Represents a candidate saved by the user within a session for ongoing consideration.

Suggested columns:

- `id` text primary key
- `session_id` text not null
- `candidate_family_id` text not null
- `itinerary_candidate_id` text not null
- `status` text not null
- `user_note` text null
- `created_at` text not null
- `updated_at` text not null

Enums:

- `status`: `shortlisted`, `top_pick`, `dismissed`

Rules:

- a candidate family may be shortlisted multiple times across different sessions, but only once per session
- `itinerary_candidate_id` should point to the most recent or most relevant concrete candidate row for display convenience
- shortlist state is user intent, not automation output
- dismissed entries remain useful as decision history and should not be hard-deleted by default

### `ai_strategy_proposal`

Stores AI-originated proposed strategies whether or not they were executed.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null
- `strategy_execution_id` text null
- `proposal_status` text not null
- `reason` text not null
- `hypothesis` text not null
- `proposal_payload_json` text not null
- `validation_errors_json` text null
- `created_at` text not null

Enums:

- `proposal_status`: `accepted`, `rejected`, `executed`, `superseded`

This table is important because rejected AI ideas are still useful training context for future planning and debugging.

### `run_artifact`

References generated files associated with a run, strategy, or verification attempt.

Suggested columns:

- `id` text primary key
- `search_run_id` text not null
- `strategy_execution_id` text null
- `verification_attempt_id` text null
- `artifact_type` text not null
- `file_path` text not null
- `mime_type` text null
- `created_at` text not null
- `notes` text null

Enums:

- `artifact_type`: `screenshot`, `html_snapshot`, `playwright_trace`, `json_export`

## Relationships

- one `session` has many `search_run`
- one `session` has many `session_city_preference`
- one `search_run` has many `strategy_execution`
- one `session` has many `candidate_family`
- one `search_run` has many `itinerary_candidate`
- one `candidate_family` has many `itinerary_candidate`
- one `candidate_family` has many `session_shortlist_entry`
- one `strategy_execution` has many `itinerary_candidate`
- one `itinerary_candidate` has many `candidate_leg`
- one `itinerary_candidate` has many `candidate_stopover`
- one `itinerary_candidate` has many `verification_attempt`
- one `itinerary_candidate` has many `price_observation`
- one `session` has many `session_shortlist_entry`
- one `search_run` has many `ai_strategy_proposal`
- one `search_run` has many `run_artifact`

## Required Indexes

Create indexes for:

- `search_run(session_id, started_at desc)`
- `candidate_family(session_id, family_key)`
- `strategy_execution(search_run_id, strategy_type, status)`
- `itinerary_candidate(search_run_id, latest_verification_status, latest_verified_display_amount)`
- `itinerary_candidate(dedupe_key)`
- `candidate_stopover(city_code, is_intentional)`
- `verification_attempt(itinerary_candidate_id, started_at desc)`
- `price_observation(itinerary_candidate_id, observed_at desc)`
- `session_shortlist_entry(session_id, status, updated_at desc)`
- `ai_strategy_proposal(search_run_id, proposal_status)`

## Canonical Enums And Value Rules

Use string enums in application code and database text columns for readability.

Required validation rules:

- airport codes use IATA uppercase where available
- city codes use a stable internal code chosen by implementation, but it must map many airports to one city
- ISO date-time strings should be stored in UTC
- currency should use ISO 4217 codes
- booleans in SQLite should be stored as integers `0` or `1`

## Derived Views Or Query Models

The application will need these query-level models even if implemented as SQL views later:

### `current_best_candidates`

For a given search run or session:

- latest verified amount
- displayed amount
- latest verification status
- risk level
- stopover cities
- route summary

### `candidate_price_timeline`

For one candidate:

- ordered displayed and verified price observations
- associated run ids
- latest delta from prior verified price

### `strategy_performance_summary`

For a date range or session:

- strategy type
- runs executed
- candidates found
- candidates verified
- best verified price found
- average search cost
- verification success rate

### `city_pattern_summary`

For AI and monitoring:

- stopover city
- appearances in winning itineraries
- cheapest verified itinerary involving that city
- best booking mode for that city

### `session_shortlist_summary`

For one session:

- shortlisted candidates
- current shortlist status
- latest verified amount
- freshness
- note or decision state

## Dedupe And Identity Rules

Use two identities for candidates:

- row identity: the candidate record id
- route identity: a stable `candidate_family` identity, with `dedupe_key` as the first implementation bridge if needed

The first implementation may use `dedupe_key` as a provisional route identity. Longer-term, a `candidate_family` record should own that cross-run identity explicitly.

The identity inputs should be derived from:

- booking type
- ordered airports
- approximate departure dates
- carrier and flight structure where available

Price, verification result, and resume URL must not affect the dedupe key.

## What Not To Store

Do not store these in SQLite:

- raw Trip.com passwords
- full Playwright session state blobs
- payment details
- unbounded HTML dumps inside table fields
- screenshots as binary blobs

## First Implementation Cut

For the first schema iteration, implement these tables first:

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

`ai_strategy_proposal` can be added in a later migration if needed, but the application code should already anticipate it.
