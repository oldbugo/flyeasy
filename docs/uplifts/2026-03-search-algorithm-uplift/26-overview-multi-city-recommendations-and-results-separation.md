# Overview Multi-City Recommendations And Results Separation

Status: `Complete`

## Goal

Separate true multi-city itineraries from normal round trips in the session UI,
so the recommendation and timeline surfaces do not blend materially different
trip shapes together.

## What changed

- Overview now has a second recommendation tab:
  - `Top recommendations`
  - `Top multi-city trips`
- Results timeline is now split into:
  - `Round-trip routes`
  - `Multi-city routes`

## Data uplift

The candidate query layer now keeps `tripShape` in the result model, and true
anchored multi-city candidates are stored with `trip_shape = 'open_jaw'`
instead of being stamped as `round_trip`.

The UI still falls back safely for older runs by treating candidates with more
than two legs as multi-city when the stored trip shape is missing or stale.

## Why this matters

Round-trip and multi-city candidates are not interchangeable:

- they have different route structures
- they answer different user intents
- they should not compete for the same recommendation surface without clear
  separation

This change keeps the baseline round-trip signal readable while still exposing
the best true multi-city outcomes when they exist.
