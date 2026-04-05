# Direct Sweep Distinct Card Selection

## Status

`Complete`

## Problem

The round-trip baseline direct sweep was previously taking the first `N`
cheapest outbound cards and the first `N` cheapest return cards after sorting.

That created a blind spot:

- if the cheapest block was filled with near-duplicate cards from the same
  provider pattern
- then the sweep could miss the second or third meaningful candidate family
- which means later stopover and intentional-stop work started from incomplete
  evidence

## Decision

The direct sweep now follows a different rule:

- scan a broader sorted card set first
- collapse only near-duplicate cards that share:
  - same price
  - same airline
  - same stopover location
  - same query date window
  - similar schedule bucket
- then keep the cheapest distinct representatives until the configured
  outbound/return branch budget is filled

## Why this is better

This keeps search breadth without exploding the live-query count.

It also means `max outbound options` and `max return options` now refer to
distinct kept options rather than the first raw cards in the sorted list.

## Result

The baseline sweep is now less likely to miss the next-best provider family
when the cheapest visible cards are clustered duplicates.
