# Session Date Simplification

## Context

The active session form was asking for four separate date boundaries:

- departure start date
- departure end date
- return start date
- return end date

That was more complex than needed for the price-first search model. The search
logic already relies on trip duration constraints, so the user-facing model can
be simpler: earliest departure, latest return, and min/max duration.

## Goal

Reduce the active session date inputs to:

- earliest departure date
- latest return date
- minimum duration days
- maximum duration days

This should make the session model easier to understand without losing the
ability to generate valid date-pair sweeps.

## Scope

Included:

- simplify the active session form
- simplify validation rules
- update review and summary copy
- map the simplified inputs into the current stored session model without a
  schema migration
- update date-pair enumeration to reflect earliest-departure/latest-return logic

Excluded:

- deleting legacy date columns from the database schema
- backfilling or migrating all historical session rows

## Implementation Strategy

- The active form now captures `departureStartDate` and `latestReturnDate`.
- For compatibility with the current schema:
  - `departure_end_date` is set to `latestReturnDate`
  - `return_end_date` is set to `latestReturnDate`
  - `return_start_date` is set to `null`
- The live run planner treats the effective latest return date as
  `return_end_date ?? departure_end_date`.
- Date-pair enumeration stops once an outbound date can no longer satisfy the
  minimum duration before the latest return date.

## Outcome

Implemented in the active product flow.
