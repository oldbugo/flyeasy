# Location Input Verification Uplift

Status: `implemented`

## Context

The session form currently accepts free-text location values for airports and
cities. That creates two product risks:

- users can make spelling mistakes and still save invalid session data
- users who do not know the exact spelling or code do not get guided input

This uplift introduces a first structured location-input layer so session setup
can suggest valid options and reject values the app does not recognize.

## Goal

Improve the session setup experience so:

- airport and city inputs provide autocomplete-style suggestions
- invalid locations show an explicit error state before save
- server-side validation rejects unknown locations as a safety backstop
- saved values are normalized into canonical forms rather than arbitrary text

## Scope

Included in this uplift:

- local location catalog for airports and cities
- autocomplete suggestions for primary airport and city fields
- client-side invalid-location error states in the session form
- server-side location normalization and validation for session create/update
- validation of city preference lists against the same catalog

Excluded from this uplift:

- remote location APIs
- fuzzy ranking backed by external search services
- tokenized multi-select inputs for preference lists
- database schema changes for a dedicated location table

## Strategy

1. Create a local canonical location catalog shared by client and server.
2. Add reusable resolution helpers for airports, single-city inputs, and city lists.
3. Upgrade the session form to surface datalist-based suggestions and inline validation states.
4. Normalize saved values through the existing Zod parsing boundary.
5. Keep the implementation local-first and deterministic.

## Outcome

Implemented:

- a shared local airport and city catalog
- autocomplete suggestions for:
  - origin airport
  - outbound destination city
  - return destination airport
  - fixed return origin city
- inline client-side error states for unknown locations
- server-side normalization so airports save as canonical codes and cities save as canonical names or codes as appropriate
- catalog-backed validation for preferred/excluded city preference lists

Verified:

- typecheck
- lint
- build

## Follow-Up Notes

- preference lists still use textarea input; a later uplift can replace them with tokenized multi-select controls
- if search coverage expands meaningfully, the local location catalog should move to a richer maintained dataset
