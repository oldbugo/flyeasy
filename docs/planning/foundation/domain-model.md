# FlyEasy Domain Model

## Purpose

Define the canonical product objects and naming rules for FlyEasy so UX, data, automation, and implementation all refer to the same concepts.

This document locks `session` as the canonical primary object across UX, product, and schema planning.

Enum-like state values should follow `canonical-state-model.md`.

## Canonical Product Objects

FlyEasy v1 should use these core objects:

### 1. Session

The primary user-facing object.

A session is a long-lived trip hunt that evolves over time.

It contains:

- the current trip definition
- monitoring state
- run history
- candidate history
- learned patterns and changes over time
- user-level actions such as pause, resume, archive, and fork

Examples:

- "Guangzhou April hunt"
- "Cheapest China trip with 1-2 stopovers"

### 2. Search Profile

A structured definition of the current search parameters inside a session.

It represents:

- origin
- destination
- departure window
- return rule
- stop rules
- booking mode
- city preferences
- monitoring settings

A session has one active search profile at a time, but may preserve prior profile snapshots through run history.

### 3. Run

One execution of the session's current search profile.

A run is operational, not primary.

It represents:

- one launched search cycle
- one set of strategies executed
- one batch of candidates found and verified

### 4. Strategy Execution

One concrete strategy instance run during a run.

This is internal and should only surface in translated form in the UI.

### 5. Candidate

One itinerary option surfaced by a run.

A candidate is run-scoped in storage, but it may belong to a stable cross-run route pattern or candidate family used for monitoring and change tracking over time.

### 6. Verification Attempt

One deep Trip.com validation pass on a candidate.

This is how the product turns a candidate from "found" into "trusted enough to compare."

### 7. Watchlist State

A session-level UX state, not a separate product object.

This controls whether a session is:

- live
- not live
- archived

## Canonical Naming Rules

These names should be used consistently across product, code, schema, and UI copy.

### User-Facing Language

Use:

- `Session`
- `Trip hunt`
- `Run`
- `Candidate`
- `Verification`
- `Monitoring`

Avoid in user-facing copy:

- `strategy execution`
- `search snapshot`
- `artifact`

### Internal/Product Spec Language

Use:

- `session`
- `search definition`
- `search_run`
- `strategy_execution`
- `itinerary_candidate`
- `verification_attempt`

### Translation Rule

If something is primarily operational or technical, it should be translated before it reaches the UI.

Example:

- internal: `strategy_execution`
- UI: "Testing one-stop routes through Shanghai"

## Relationships

The canonical relationship model should be:

- one `session` stores one active search definition
- one `session` has many `search_run`
- one `search_run` has many `strategy_execution`
- one `search_run` has many surfaced `itinerary_candidate`
- one `itinerary_candidate` has many `verification_attempt`
- one `itinerary_candidate` has many `price_observation`

## Lifecycle Model

### Session Lifecycle

States:

- `draft`
- `live_running`
- `live_idle`
- `not_live`
- `needs_attention`
- `completed`
- `archived`

Rules:

- `draft` exists before the first meaningful run
- `live_running` means a run is actively executing
- `live_idle` means the session is live in intent but not currently executing
- `not_live` means still active as a hunt, but not currently live
- `needs_attention` means blocked or intervention-required
- `completed` means the user considers the hunt fulfilled but still reviewable
- `archived` means retired from active use but still viewable

### Run Lifecycle

States:

- `queued`
- `running`
- `blocked`
- `paused`
- `completed`
- `failed`
- `cancelled`

Run state should not replace session state. A session may stay live even while one specific run completes.

## Evolution Vs Forking

Sessions evolve by default.

Fork only when travel intent changes materially.

That means:

- session = continuity of the same hunt
- run = one execution inside that hunt
- fork = start of a new hunt

## Implications For Existing Artefacts

### Product and UX

The UX language is already mostly correct and should continue using `session` as the primary object.

### Data Model

The data model should use `session` directly as the primary container.

Recommended structure:

- `session`
- `search_run`
- `search_snapshot_json` on `search_run`
- city pool preferences attached to `session`
- stable cross-run candidate family identity layered above run-scoped candidate rows

### Monitoring

Monitoring is not a separate top-level object.

It is a mode or capability of a session.

### Dashboard

The home screen is a session dashboard, not a generic search home.

## Recommended Schema Direction

For the next revision of the data model, use:

- `session`
- `session_city_preference`
- `search_run`
- `strategy_execution`
- `itinerary_candidate`
- `candidate_leg`
- `candidate_stopover`
- `verification_attempt`
- `price_observation`
- `ai_strategy_proposal`
- `run_artifact`

If backward compatibility with earlier planning terms is needed, preserve an alias note but do not keep dual naming active in the spec.

## Current Recommendation

Lock `session` as the primary canonical object for FlyEasy.

Treat `search profile` as the structured parameters inside a session, and `run` as one execution of that session.

This keeps the UX, product language, and future schema aligned around the same mental model.

