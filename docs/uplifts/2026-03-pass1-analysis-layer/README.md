# Pass 1 Analysis Layer

## Context

The direct sweep now records individual queries and candidate outputs, but the
system still moved too quickly from "results were found" to "run the next
mechanical pass."

For the product direction, FlyEasy needs to behave more like a local data
analyst:

- inspect the first-pass market map
- identify repeated cheap patterns
- explain those patterns to the user
- use those findings to prioritize later scans

## Goal

Add a dedicated post-pass-1 analysis layer that:

- reads the direct sweep results after they complete
- produces structured findings about dates, airlines, and observed route
  patterns
- persists those findings as a run artifact the UI can show
- drives an additional anchored follow-up pass focused on cheap departure dates

## Scope

Included:

- run analysis snapshot persistence
- a `pass1_analysis` strategy stage
- a `packaged_departure_anchor_followup` strategy stage
- user-visible analysis findings in the live run surface

Excluded:

- airline-filtered live automation, which still depends on Trip.com filter
  interactions that are not yet stable enough
- ML or external AI inference; this is still deterministic local analysis

## Core Logic

### Pass 1 analysis

The analysis layer reads completed direct round-trip queries and linked
candidates, then derives:

- cheapest departure dates
- cheapest outbound airlines
- cheapest departure-date + airline combinations
- observed stopover city frequencies and prices
- recommended departure-date anchors for later probing

### Anchored follow-up

The first actionable derived pass now focuses on departure dates because those
can be executed safely with direct Trip.com result URLs.

If the analysis shows that a particular departure date is repeatedly cheap, the
next pass anchors that departure date and tests additional return-date
combinations inside the allowed duration window.

## Outcome

Implemented in the run model and live worker.

Verified:

- pass 1 analysis snapshots are persisted in `run_analysis_snapshot`
- the run UI can show:
  - cheapest departure dates
  - cheapest outbound airlines
  - cheap date + airline combinations
  - recommended departure-date anchors
- a wider verification session proved the anchored follow-up path:
  - pass 1 found `2026-04-19` as the cheapest departure date
  - anchored return-date probes then tested additional return combinations on
    that departure date
  - those follow-up queries found lower prices than the original direct pass on
    the same departure date
