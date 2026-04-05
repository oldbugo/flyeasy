# Session Strategy Bundles And Tab

Status: `Complete`

## Context

The earlier review established that the search engine was too fixed and that the
current planner behaved like one hard-coded recipe.

The follow-up discussion refined the desired direction:

- do not let the user assemble raw foundation passes freely
- define reusable strategy bundles as curated groups of passes
- allow sessions to choose among those bundles
- expose constrained per-bundle controls where they are safe
- keep the architecture scalable as new bundles are added later

## Goal

Implement the first vertical slice of that architecture:

- reusable strategy bundles in code
- session-level persisted bundle selection and config
- a dedicated `Search strategy` session tab
- planner compilation from the session's selected bundles

## Scope

Included:

- a new `session_strategy_selection` table
- a search-strategy catalog module
- a session strategy selection helper layer
- planner compilation from selected bundles
- a `Search strategy` session tab
- bundle configuration UI
- moving the existing proposal list onto the new strategy tab

Excluded:

- adding multiple new primary search bundles
- replacing the current AI proposal system
- live stitched-search implementation
- deeper evidence-layer refactors

## Implemented Shape

### Bundle catalog

The current catalog introduces two bundle types:

1. `price_first_market_scan`
   - required
   - compiles to:
     - `packaged_direct_sweep`
     - `pass1_analysis`
     - optional `packaged_departure_anchor_followup`
     - optional `packaged_stopover_followup`

2. `stitched_value_probe`
   - optional companion bundle
   - compiles to:
     - `stitched_followup`

This keeps the public abstraction at the bundle level while preserving the
existing executable pass types underneath.

### Session strategy tab

The session workspace now has a dedicated `Search strategy` tab.

That tab exposes:

- the required baseline market-scan bundle
- the optional stitched comparison bundle
- constrained bundle controls
- inherited defaults from `searchIntensity`
- the existing proposal list, now grouped with other strategy controls

### Constrained controls

The baseline market-scan bundle currently allows safe overrides for:

- anchored departure follow-up on or off
- stopover evidence follow-up on or off
- direct sweep query budget
- departure anchor count
- return probes per anchor
- stopover city probe count
- outbound branches per query
- return options per branch

The stitched companion bundle currently allows:

- enable or disable
- derived comparison count override
- discount rate override

## Persistence Model

`session_strategy_selection` stores:

- `session_id`
- `strategy_key`
- `enabled`
- `priority`
- `config_json`

The bundle catalog itself stays in code. Sessions persist selection state and
config, not the full strategy definition.

This keeps the system scalable:

- new bundles can be added in code later
- existing sessions can pick them up with default state
- runs still compile from a clear session-local snapshot

## Planner Behavior

The planner no longer expands a session directly into one implicit fixed queue.

It now:

1. loads the session's bundle selection state
2. validates compatibility
3. expands enabled bundles into concrete strategy plans
4. preserves ordered execution inside each bundle

This is still bounded by the existing live worker constraints, but the
architecture is now ready for additional bundles instead of more hard-coded
session recipes.

## Outcome

Implemented:

- bundle catalog architecture
- session strategy persistence
- `Search strategy` tab
- bundle-level configuration UI
- planner compilation from session strategy selection

Verified:

- `npm run typecheck`
- `npm run lint`

## Follow-Up Notes

The current implementation deliberately keeps one required baseline bundle. That
matches the reality of the live worker today, which still assumes a baseline
direct-sweep-led run shape.

The next meaningful steps are:

1. add more true bundle options on top of the new catalog
2. deepen the evidence layer so bundle selection can become more adaptive
3. keep refining the difference between deterministic system suggestions and any
   future genuine model-assisted recommendation layer
