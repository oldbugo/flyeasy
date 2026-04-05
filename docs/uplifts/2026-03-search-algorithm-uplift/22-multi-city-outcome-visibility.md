# Multi-City Outcome Visibility

## Status

- `Complete`

## Goal

Make the results surface explicit about what the multi-city strategy actually
found.

The prior state was too easy to misread:

- if a qualifying intentional multi-city trip existed, it was still buried in a
  dense detail board
- if no qualifying trip existed, the user had to infer that from a mix of
  ranked-city and validation panels
- stitched placeholder candidates could still appear as intentional-stop
  candidates even when they had no persisted stopover rows

## What Changed

### Results interpretation

The multi-city panel in Results now resolves into one of three states:

- qualifying intentional trip found
- no qualifying trip yet, but verified stopover fallback exists
- no qualifying trip and no verified fallback yet

When no qualifying trip exists, the board now calls that out directly and shows:

- required stop window
- cheapest verified stopover fallback
- closest miss against the minimum stop requirement

This makes it much easier to understand whether the algorithm truly failed to
find anything, or whether it only found near-miss stopover options.

### Stitched placeholder honesty

The stitched placeholder no longer forces `intentionalStopCount >= 1` for
derived candidates that do not have persisted stopover rows.

That removes a misleading signal from the main results list and keeps the
intentional-stop language tied to real stopover evidence.

## Verification

Verified with:

- `node --check D:\\flyeasy\\scripts\\automation\\run-baseline-search.mjs`
- `npm run typecheck`
- `npm run lint`
- live results route rendering the new required-stop-window and closest-miss
  copy
