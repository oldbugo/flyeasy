# FlyEasy Session Card Models

## Purpose

Define candidate card patterns for the session-first home screen so the primary dashboard object is useful, scannable, and not overloaded.

In FlyEasy, a session card needs to represent a long-lived trip hunt, not just a single reusable search definition.

## What A Session Card Must Communicate

Every session card needs to answer these questions at a glance:

- what trip is this
- what is the best current outcome
- is monitoring active
- does this session need attention
- what should I do next

## Shared Content Requirements

Regardless of card model, each session card should include:

- trip identity: origin, destination, and return behavior
- date context: departure window and duration or return rule
- best current verified fare
- verification freshness
- monitoring state
- session state
- primary next action

Optional secondary content:

- best stopover city pattern
- cheapest single-booking price
- cheapest stitched price
- last meaningful change
- issue or blocked-state badge

## Model A: Balanced Summary Card

### Structure

Top:

- session title or user label
- trip summary
- session state badge

Middle:

- best verified fare as dominant value
- verification freshness
- one-line "best current option" summary

Bottom:

- monitoring state
- last change summary
- primary action button

### Example Information Shape

```text
Melbourne -> Guangzhou
Return from any mainland China city | Apr 5-15 | 3-5 weeks
[Monitoring Active]

$612 verified
Checked 18m ago
Best option: 1 stop via Chengdu, single booking

Changed: down $34 since yesterday
[Open Session]
```

### Strengths

- good balance between identity, outcome, and state
- easy to scan across several sessions
- preserves room for a strong visual hierarchy
- best fit for dashboard-first browsing

### Risks

- may hide useful secondary detail for power users
- can feel too similar across sessions if visual design is weak

### Best Use

Recommended default card model for v1.

## Model B: Outcome-First Market Card

### Structure

Top:

- dominant price and freshness

Middle:

- trip identity
- best route summary
- booking type and risk

Bottom:

- monitoring and attention state
- next action

### Example Information Shape

```text
$612 verified
Checked 18m ago

Melbourne -> Guangzhou
Return from any mainland China city
Best route: Chengdu stopover | single booking | low risk

Monitoring Active
No issues
[Open Session]
```

### Strengths

- highly outcome-driven
- strong for a user who mainly cares about the current cheapest good option
- visually compelling if price is the main dashboard signal

### Risks

- trip context becomes secondary
- harder to distinguish sessions when multiple hunts have similar prices
- less suitable if sessions evolve heavily over time

### Best Use

Good if the dashboard should feel like a market board or watchlist of opportunities.

## Model C: State-First Control Card

### Structure

Top:

- trip identity
- monitoring or blocked status

Middle:

- current phase or session state
- best available outcome

Bottom:

- last change
- explicit action cluster

### Example Information Shape

```text
Melbourne -> Guangzhou
Apr 5-15 | 3-5 weeks
[Needs Attention]

Monitoring paused: Trip.com session expired
Best verified fare before pause: $612

Last change: repriced candidate removed
[Resume] [Open Session]
```

### Strengths

- very strong when the product must surface interventions
- makes operational state obvious
- suitable for volatile automation-heavy products

### Risks

- less elegant as the default if most sessions are healthy
- can make the dashboard feel more operational than aspirational

### Best Use

Best as a variant for blocked, paused, or stale sessions rather than the default card.

## Recommended Hybrid Approach

Use a hybrid system with a state-first default.

### Default Session

Use Model C:

- trip context first
- session or monitoring state second
- best available outcome third

### High-Opportunity Session

Use Model C with a stronger outcome band:

- keep the state-first structure
- visually emphasize a newly improved fare or notable change
- avoid letting price overwhelm session state

### Healthy Session

Keep the state treatment quiet:

- monitoring active
- no issues
- freshness and last change visible but secondary

### Needs-Attention Session

Use the same Model C structure with elevated intervention cues:

- blocked, paused, or stale state becomes dominant
- recovery action becomes the primary CTA

This keeps the dashboard consistent while optimizing for fast state awareness across multiple concurrent trip hunts.

## Recommended Information Hierarchy

For the default session card, use this content order:

1. Trip identity
2. Monitoring or session state
3. Best verified outcome
4. Verification freshness
5. Last meaningful change
6. Primary next action

This order matches the mental flow:

- identify the hunt
- assess whether it needs attention
- assess the best known outcome
- assess whether the information is fresh
- decide whether to open it now

## Recommended Primary Actions

Default healthy session:

- `Open Session`

Secondary actions:

- pause monitoring
- rerun now
- more actions menu

Needs-attention session:

- `Resume`

Secondary actions:

- open session
- fix Trip.com connection

## What To Avoid

- showing too many prices on the card
- mixing displayed and verified prices without hierarchy
- exposing raw strategy names or technical internals on the dashboard
- overusing warning colors for normal stitched itineraries
- turning every card into a mini analytics panel

## Current Recommendation

Use Model C as the default session card.

Why:

- it optimizes for fast state awareness across multiple concurrent sessions
- it matches the dashboard's role as a control surface for evolving trip hunts
- it keeps intervention and monitoring status easy to scan
- it still allows one more level down for richer price and route detail

Use stronger outcome emphasis only as a variant when a session has a meaningful new opportunity.

## Next Design Step

Once the model is chosen, the next artefact should define the exact fields, hierarchy, and behavior for:

- default session card
- high-opportunity session card
- needs-attention session card
- session card list/grid layout behavior
