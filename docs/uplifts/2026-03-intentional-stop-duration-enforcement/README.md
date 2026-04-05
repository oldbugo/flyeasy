# Intentional Stop Duration Enforcement

## Context

Stopover-focused follow-up candidates were being marked as intentional even when the extracted stop duration was only a few hours. That broke the product meaning of an intentional stop and produced misleading itinerary presentation.

## Goal

- only mark a stop as intentional when it satisfies the session's minimum stop-duration days
- stop showing short layovers as intentional in the UI
- if an intentional stop exists, reflect that shape in the itinerary summary

## Change

- the automation worker now parses stopover duration from the Trip.com stop text instead of hardcoding a 3-hour intentional stop
- intentionality is now gated by `session.stop_duration_min_days` and `session.stop_duration_max_days`
- the UI now recomputes displayed intentional-stop state using the session threshold so older bad records no longer show short layovers as intentional
- itinerary summaries now show the stop city inline when a stop is genuinely intentional

## Outcome

Intentional stops now mean "multi-day stop worth exploring", not "any stopover-focused query". Short layovers remain visible as stop details but are treated as incidental unless they satisfy the session's duration threshold.
