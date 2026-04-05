# Multi-City Seed-Based Verification

## Status

`Complete`

## Why This Uplift Was Needed

The earlier `Multi-city verification` cluster still started from the cheapest
raw stopover candidates.

That approach became increasingly misaligned once the baseline was upgraded to
produce:

- bounded return-option expansion coverage
- family-level follow-up candidates
- stronger stopover-city discovery

The baseline had become richer, but multi-city verification was still behaving
like a thin city-ranking layer over the cheapest raw stopover rows.

That created four practical problems:

- repeated cheap variants from one family could still crowd out later families
- a city was usually deepened from only one cheapest baseline page
- the ranking favored repeated signals more than cheap, viable city-entry paths
- the UI did not clearly report the cheapest verified multi-city trip

## What Changed

### 1. Baseline handoff now carries city-entry planning data

The baseline handoff now includes:

- cheapest city-entry findings
- a compact city x date x airline matrix
- stronger per-family stopover pricing deltas

This gives later strategies a reusable bridge from baseline discovery into
follow-on planning without forcing them to reconstruct everything from raw
candidates again.

### 2. Multi-city verification now reviews baseline seed contexts

The first multi-city pass no longer reviews only the cheapest raw stopover
candidates.

Instead, it now reviews bounded baseline seed contexts built from:

- candidate family
- stopover city
- departure date
- return date
- outbound airline
- return airline
- discovery source
- relative price delta from the cheapest baseline fare

The review queue is coverage-oriented rather than purely top-to-bottom. It
round-robins across family-city groups and uses deterministic randomness inside
cheap bands so one family does not monopolize the review budget.

### 3. Multi-city verification now probes multiple contexts per city

Cities are still bounded by a city limit, but each selected city can now be
tested with more than one baseline seed context.

This makes the strategy much less likely to conclude:

- “city X is not good”

when in reality only one family/date context for city X was weak.

### 4. “Still cheap” is now a ranking signal, not a hard gate

The multi-city ranking now treats cheapness relative to the baseline as a
signal:

- lower baseline delta helps a city/context rank higher
- higher delta does not hard-exclude it

This preserves valuable candidates that are not the absolute cheapest packaged
option, but are still attractive as intentional stopover opportunities.

### 5. Multi-city now records a concrete verification-results board

The cluster now writes a dedicated `multi_city_verification_results` snapshot.

That summary records:

- cheapest verified multi-city trip overall
- cheapest verified trip per city
- delta versus baseline cheapest fare
- how many seed contexts were tested
- which family/date/airline context produced the best result

That board is now surfaced in results and live run progress.

### 6. Long-stop follow-up now prefers verified city contexts

When available, long-stop follow-up now reuses the best verified city context
from multi-city verification instead of always falling back to the baseline’s
single cheapest city page.

This keeps the longer-stop work closer to the stronger verified seed path that
already proved productive.

## Product Impact

After this uplift, `Multi-city verification` is materially closer to its
intended role:

- start from the strongest baseline clues
- verify whether the same origin/destination can still expose a useful layover
  city
- preserve promising candidates even when they are not the absolute cheapest
  baseline fare
- make the cheapest verified multi-city outcome visible

## Remaining Limits

This uplift improves strategy quality and data flow, but it does not change the
underlying adapter limitation that candidate leg timings are still synthetic in
the current Trip.com worker.

That means the ranking and result boards are now better grounded in baseline
evidence, but they are still bounded by the fidelity of the packaged-search
adapter itself.
