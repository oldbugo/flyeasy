# Results Itinerary Presentation

## Context

The results screen was technically correct but too summary-heavy. Users could see the cheapest fare, but the actual route structure was buried behind the candidate detail view and raw labels.

## Goal

Make result cards readable as itineraries, not just as ranked prices, so a user can understand what each fare actually represents without opening every candidate one by one.

## Change

- Extended the session results query to include candidate legs and stopovers.
- Rebuilt the result card around itinerary rows:
  - outbound segment
  - return segment
  - airports
  - times
  - carrier/flight labels
  - stopover chips
- Upgraded the candidate detail summary to use the same itinerary-first presentation before the raw leg list.

## Outcome

The result surface now behaves more like an itinerary board than a price leaderboard. Users can scan the actual structure of each option directly from the results page and then drill into candidate detail only when they need deeper evidence.
