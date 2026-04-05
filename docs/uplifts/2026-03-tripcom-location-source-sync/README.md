# Trip.com Location Source Sync Uplift

Status: `implemented`

## Context

The first location-input uplift introduced a local canonical catalog, but it was
still manually curated. That means coverage can drift from Trip.com's actual
searchable options, and airport-heavy cities such as Melbourne can be
incomplete.

## Goal

Make the location layer safer and more maintainable by:

- externalizing the runtime catalog into versioned data files
- improving airport disambiguation for cities with multiple airports
- adding a Trip.com-backed sync path that can refresh or audit the local catalog

## Scope

Included in this uplift:

- moving the runtime catalog from hardcoded TypeScript arrays into JSON data
- adding missing Melbourne airport coverage
- treating ambiguous airport inputs as a required disambiguation case
- adding a Trip.com-backed sync script and seed list
- documenting the intended review-and-refresh workflow

Excluded from this uplift:

- automatic background updating without review
- replacing datalist with a richer combobox UI
- full city/airport coverage for every Trip.com market

## Strategy

1. Externalize runtime catalog data into committed JSON snapshots.
2. Update runtime resolution helpers to detect ambiguity instead of guessing.
3. Add missing known airports immediately, starting with Melbourne.
4. Build a Trip.com sync script that captures suggestion data from the actual
   search UI for seeded queries.
5. Store sync artifacts for review before accepting catalog changes.

## Outcome

Implemented:

- versioned airport and city data files under the location module
- Melbourne now includes `MEL`, `AVV`, and `MEB`
- airport validation can now report ambiguity instead of silently resolving the
  first match
- a Trip.com-backed sync script and seed file were added for catalog audits

Verified:

- typecheck
- lint
- build
- Trip.com sync artifact capture

## Follow-Up Notes

- the sync script is designed as a review tool, not an unattended updater
- expanding the seed list over time will improve coverage auditing
