# Shared Evidence Layer

Status: `In progress`

## Context

By this point the multi-city cluster had become more capable, but the worker was
still carrying the ranking and validation logic inline.

That created two problems:

- future strategy clusters would be tempted to copy the same evidence logic
- the worker would get harder to change every time a new cluster was added

The next milestone was therefore architectural rather than user-facing:

- extract the multi-city evidence logic into a reusable module
- keep the current behavior stable
- prepare the codebase for additional strategy families

## Implemented Shape

A new shared evidence module now exists at:

- `scripts/automation/lib/search-evidence.mjs`

The worker now calls into that module for:

- recorded stopover evidence collection
- preferred departure-date and airline signal selection
- top round-trip winner evidence collection
- multi-city city-ranking construction
- long-stop validation summary building
- long-stop follow-up city selection

The worker still owns query execution and snapshot writes, but it no longer owns
all of the scoring and aggregation logic inline.

## Why This Matters

This is the first concrete slice of the broader evidence-layer plan.

It does not yet solve the entire planner redesign, but it creates a better seam
between:

- evidence extraction and scoring
- execution branching in the worker

That means the next strategy cluster can reuse the same evidence helpers instead
of adding more one-off SQL-and-ranking blocks to `run-baseline-search.mjs`.

## Current Status

`Complete`:

- extracted shared evidence helpers into `scripts/automation/lib/search-evidence.mjs`
- multi-city ranking now uses the shared evidence module
- long-stop validation now uses the shared evidence module
- long-stop follow-up city targeting now uses the shared evidence module
- worker behavior stayed stable while the evidence logic was moved

`In progress`:

- expanding the shared layer beyond the current multi-city family
- moving more planner-facing evidence logic out of the worker
- shaping the extracted helpers into a broader planner-ready scoring layer

`Not started`:

- alternate return-city evidence extraction
- cross-run historical winner scoring
- exploration-versus-exploitation budget scoring

## Verification

- `npm run typecheck`
- `npm run lint`
