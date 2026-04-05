# Results Grouping And Dedupe

## Context

The results page was surfacing many cards that were effectively the same recommendation repeated across nearby date combinations, and in some cases exact duplicates were being shown.

## Goal

- remove exact duplicates from the displayed result set
- group highly similar recommendations together
- rank each group by the variant with the longest trip span between departure and return
- make stop details visible directly on the grouped card

## Change

- added a recommendation grouping presenter in `src/lib/candidates/result-groups.ts`
- exact duplicates are collapsed before rendering
- grouped recommendations are keyed by:
  - booking type
  - carrier pattern
  - stopover pattern
  - destination
  - stitched risk level
- each group now promotes the longest-duration date variant first
- result cards now show grouped date variants and stop details

## Outcome

The results surface behaves more like a recommendation board than a raw candidate dump. Repeated cards are collapsed, similar variants stay together, and the top card in each group favors the longest available trip duration before lower-duration alternates.
