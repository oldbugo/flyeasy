# Baseline Round-Trip Insights Board

## Status

`Complete`

## Why this slice mattered

The round-trip baseline was already recording useful analysis snapshots, but
the session and run UI were still rendering that evidence as short text lists.

That made it hard to answer the most basic questions:

- which departure dates are actually cheapest
- which airlines are actually cheapest
- which specific date and airline combinations are driving the price
- whether the baseline scan was broad enough to trust

## What changed

The session workspace now uses a dedicated baseline-insights board for the
round-trip baseline.

It is currently surfaced:

- as a concise summary in `Overview`
- as a detailed board in `Results`

The board surfaces:

- cheapest observed fare
- analysed query count
- analysed candidate count
- promoted departure anchors
- cheapest departure dates
- cheapest outbound airlines
- cheap date and airline combinations
- stopover-city clues

## Why the extra metric matters

The most useful additional metric beyond dates and airlines is usually the
combined `date + airline` view.

Looking at dates alone can make one departure day look strong when the low fare
only exists on one carrier. Looking at airlines alone can make one carrier look
consistently cheap when the low fare only appears on one date cluster.

The combined view is the clearer handoff signal for later strategy work.

## Implementation notes

- reused the existing pass-1 market-scan snapshot shape instead of creating a
  new backend payload
- introduced one shared rendering component so overview and results do not
  drift apart
- kept the baseline board focused on explainable evidence rather than dense
  analytics jargon

## Remaining gap

This improves visibility, but it does not yet create cross-run baseline trend
history or confidence scoring. Those still belong to the broader shared
evidence and scoring roadmap.
