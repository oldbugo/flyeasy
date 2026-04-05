# Alternate Return-City Exploration

Status: `Complete`

## Context

The roadmap called out an alternate return-city exploration bundle, but the live
search adapter still does not support a true open-jaw or return-origin-specific
 search.

That meant the next practical step had to be honest about current limits while
still moving the product forward.

## Implemented Shape

FlyEasy now has a new optional strategy cluster:

- `Alternate return-city exploration`

This cluster only appears as compatible when the session allows
`any_mainland_city` for return-origin planning.

Its current shape is intentionally explicit:

- it does **not** claim to be a true open-jaw search
- it selects alternate mainland-city targets from baseline and multi-city
  evidence
- it runs bounded round-trip comparison probes for those cities
- it records an `alternate_return_city_summary` analysis snapshot

## Inputs

The cluster now reuses:

- baseline stopover-city findings
- baseline departure-date anchors
- any multi-city ranking and long-stop evidence already collected

## Outputs

The cluster now produces:

- a shortlist of alternate mainland-city targets
- live round-trip comparison results for those cities
- a comparison board showing which cities looked strongest and why

## Why This Shape

This is the correct intermediate step while the execution adapter is still tied
to round-trip Trip.com mechanics.

It gives the planner and UI a real alternate-city family now, without
pretending the current adapter can do something it cannot yet do.

## Current Status

`Complete`:

- new `Alternate return-city exploration` strategy cluster
- bounded alternate-city comparison pass
- comparison-summary analysis pass
- compatibility gating based on flexible return-origin sessions
- strategy-tab controls and evidence visibility for the new cluster
- run-progress visibility for alternate-city comparison evidence

`In progress`:

- turning this comparison cluster into a true return-origin or open-jaw adapter
- reusing the new comparison board in later planner decisions

`Not started`:

- true open-jaw query generation
- alternate-city execution adapters beyond the current round-trip comparison path

## Verification

- `npm run typecheck`
- `npm run lint`
