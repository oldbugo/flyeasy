# Stopover Follow-up Card Matching

## Context

The `packaged_stopover_followup` branch was consistently failing because it depended on Trip.com's stopover sidebar filter becoming interactable. In practice, the filter items often stayed in a hidden/non-interactive state even when the result page itself was valid.

## Goal

Make stopover follow-up queries resilient enough to produce real candidates when the target stopover city is already visible in the result cards, without depending on the brittle sidebar checkbox interaction.

## Change

- Keep using stopover evidence discovered during the direct sweep.
- Stop trying to activate the Trip.com sidebar checkbox for follow-up scans.
- Instead:
  - sort the result stage by cheapest
  - scan a wider slice of visible cards
  - keep only cards whose stop text/accessibility summary mentions the target stopover city
  - select the cheapest matching outbound card
  - rank matching return cards the same way

## Outcome

Verified against the previously failing run `run_301ebaeb39914c72900facc8ef33503b`:

- Chengdu (`CTU`) follow-up now completed with candidates.
- Shanghai (`SHA`) follow-up now completed with candidates.
- Nanjing (`NKG`) still failed, but for a real reason: no visible return cards mentioned Nanjing after the outbound was anchored.

This is the correct behavior for now:

- selector brittleness is removed from the stopover branch
- genuine lack of matching return combinations is reported honestly at query level
