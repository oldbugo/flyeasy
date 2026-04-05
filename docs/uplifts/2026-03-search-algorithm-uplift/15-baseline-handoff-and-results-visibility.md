# Baseline Handoff And Results Visibility

## Status

`Complete`

## Problem

The baseline was learning more, but the handoff was still implicit.

That created two gaps:

- results and overview did not clearly show how much family coverage the
  baseline expansion achieved
- later strategies still had to infer their starting point from raw candidates
  and snapshots instead of consuming a structured baseline handoff set

## Decision

The baseline now records and surfaces two explicit artifacts:

- `baseline_return_option_expansion`
  - how many families were expanded
  - which families saturated
  - which stopover cities were surfaced by deeper return-option inspection
- `baseline_followup_handoff`
  - a structured family-level shortlist from the baseline
  - airlines, dates, stopover clues, discovery sources, and recommended next
    strategy directions

## Result

Overview and Results now have a clearer baseline story:

- what the baseline scanned
- what deeper expansion learned
- which candidate families are ready for follow-on strategy work

This also gives the system a cleaner foundation for future planner work,
because later strategies can consume a baseline handoff artifact instead of
reconstructing meaning from raw candidate rows every time.
