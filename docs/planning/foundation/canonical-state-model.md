# FlyEasy Canonical State Model

## Purpose

Define one canonical set of state values for FlyEasy so product planning, schema design, API contracts, automation, and UX all refer to the same lifecycle model.

This document is the source of truth for stable enum-like values in the MVP planning set.

## Design Rules

- Product-facing labels and internal stored values are not always the same thing.
- Internal values should be stable and implementation-friendly.
- User-facing labels should be derived from internal values plus context.
- New docs should reference this file rather than inventing new state sets.

## 1. Session Lifecycle State

Stored on `session.lifecycle_state`.

Allowed values:

- `draft`
- `live_running`
- `live_idle`
- `needs_attention`
- `not_live`
- `completed`
- `archived`

User-facing grouping:

- `Live hunts`: `live_running`, `live_idle`, `needs_attention`
- `Not live`: `draft`, `not_live`, `completed`
- `Archived`: `archived`

## 2. Session Monitoring State

Stored on `session.monitoring_state`.

Allowed values:

- `enabled`
- `disabled`
- `blocked`

User-facing monitoring labels are derived:

- `Monitoring active`
- `Monitoring idle`
- `Monitoring paused`
- `Monitoring blocked`

## 3. Run Status

Stored on `search_run.status`.

Allowed values:

- `queued`
- `running`
- `blocked`
- `paused`
- `completed`
- `failed`
- `cancelled`

Rule:

- use `blocked` for recoverable intervention-required states
- use `paused` for intentional non-terminal pause states
- use `cancelled` only when the run will not resume

## 4. Strategy Execution Status

Stored on `strategy_execution.status`.

Allowed values:

- `queued`
- `running`
- `blocked`
- `completed`
- `failed`
- `skipped`
- `cancelled`

## 5. Candidate Verification Result

Stored on `itinerary_candidate.latest_verification_status`.

Allowed values:

- `not_checked`
- `verified`
- `repriced`
- `unavailable`
- `partial`
- `failed`

Freshness is separate from verification result and should be derived from the latest successful verification timestamp.

## 6. Verification Attempt Status

Stored on `verification_attempt.status`.

Allowed values:

- `running`
- `blocked`
- `verified`
- `repriced`
- `unavailable`
- `partial`
- `failed`
- `cancelled`

## 7. Verification Checkout Stage

Stored on `verification_attempt.checkout_stage_reached`.

Allowed values:

- `results`
- `details`
- `traveler_form`
- `final_review`

## 8. Booking Mode

Stored on `session.booking_mode` and strategy payloads.

Allowed values:

- `single_booking`
- `stitched`
- `both`

Rule:

- use `single_booking`, not `single`

## 9. Booking Type

Stored on `itinerary_candidate.booking_type`.

Allowed values:

- `single_booking`
- `stitched`

## 10. Trip Shape

Stored on `itinerary_candidate.trip_shape`.

Allowed values:

- `round_trip`
- `open_jaw`

## 11. Risk Level

Stored on `itinerary_candidate.stitched_risk_level` and used in DTOs.

Allowed values:

- `low`
- `medium`
- `high`

## 12. Shortlist Status

Stored on `session_shortlist_entry.status`.

Allowed values:

- `shortlisted`
- `top_pick`
- `dismissed`

Rule:

- MVP UI may expose only `shortlisted` and `dismissed` actions initially

## 13. Recovery State

Used in recovery metadata and DTOs.

Allowed values:

- `not_required`
- `pending`
- `completed`
- `abandoned`

## 14. Recovery Type

Used in recovery metadata, events, and DTOs.

Allowed values:

- `login_required`
- `challenge_required`
- `verification_blocked`
- `app_interrupted`

Rule:

- use `challenge_required`, not `captcha_required`, as the normalized product-safe type

## 15. Connection State

Used in settings, shell status, and recovery flows.

Allowed values:

- `connected`
- `session_expired`
- `challenge_required`
- `blocked`
- `unknown`

## 16. Artifact Type

Stored on `run_artifact.artifact_type` and used in event payloads.

Allowed values:

- `screenshot`
- `html_snapshot`
- `playwright_trace`
- `json_export`

Rule:

- use `playwright_trace`, not `trace`

## 17. Failure Code Style

Failure codes should be stable, finite, and upper snake case.

Recommended shared families:

- `AUTH_REQUIRED`
- `RECOVERY_REQUIRED`
- `PAGE_SHAPE_CHANGED`
- `PARSING_FAILED`
- `RATE_LIMITED`
- `CANDIDATE_UNAVAILABLE`
- `PRICE_REPRICED`
- `UNKNOWN_AUTOMATION_FAILURE`

## Current Recommendation

Treat this file as the canonical planning reference for enum-like values.
