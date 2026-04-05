# FlyEasy Cross-Screen Component Spec

## Purpose

Define the shared UI components that must behave consistently across FlyEasy screens so the product feels coherent and trustworthy.

This spec covers structural components, not final visual styling.

## Why This Exists

FlyEasy depends on repeated trust signals:

- session state
- monitoring state
- verification freshness
- booking type
- risk
- recovery status

If these are designed inconsistently across screens, the product will feel unreliable even if the data is correct.

## Component Principles

- State meaning must stay consistent across screens.
- Labels should be short, factual, and repeatable.
- Verified price and freshness must always follow the same hierarchy logic.
- Recovery UI must feel like one system, not multiple ad hoc banners.
- AI explanation modules must remain contextual and non-chat-like.

## Component Set

Define these shared components first:

1. Trip.com connection badge
2. Session state badge
3. Monitoring state label
4. Verification freshness badge
5. Booking type badge
6. Risk label
7. Session card
8. Candidate card
9. Price and trust block
10. Plain-language summary block
11. AI explanation snippet
12. Recovery banner / panel
13. Change summary item
14. Action cluster

## 1. Trip.com Connection Badge

### Purpose

Show global connection health in the shell and in relevant screens.

### Allowed States

- connected
- expired
- challenge required
- blocked

### Required Behavior

- compact when healthy
- more prominent when attention is needed
- may open settings or recovery flow when clicked

### Usage

- app shell
- session dashboard global status strip
- live run progress
- settings

## 2. Session State Badge

### Purpose

Show the overall lifecycle state of a session.

### Allowed States

- `Live`
- `Needs attention`
- `Not live`
- `Completed`
- `Archived`

### Rules

- this is a lifecycle/status marker, not a call to action
- wording must remain stable across dashboard, detail, and monitoring surfaces

## 3. Monitoring State Label

### Purpose

Show the operational monitoring state of a session.

### Allowed States

- `Monitoring active`
- `Monitoring idle`
- `Monitoring paused`
- `Monitoring blocked`

### Rules

- separate from the session state badge when both are shown
- useful on session detail, dashboard cards, and monitoring screen

## 4. Verification Freshness Badge

### Purpose

Communicate whether a candidate's verified price is fresh enough to trust strongly.

### Allowed States

- `Verified just now`
- `Verified 18m ago`
- `Verified earlier today`
- `Needs fresh re-check`

### Rules

- should always pair with verified price
- freshness meaning should align with the verification policy
- stale language should trigger re-verification affordances where relevant

## 5. Booking Type Badge

### Purpose

Differentiate single booking from stitched itineraries.

### Allowed Values

- `Single booking`
- `Separate tickets`

### Rules

- always visible on candidate list and detail contexts
- must be calm and factual
- must not imply stitched itineraries are invalid by default

## 6. Risk Label

### Purpose

Communicate practical booking or itinerary risk.

### Allowed Levels

- `Low risk`
- `Medium risk`
- `High risk`

### Rules

- risk label must be paired with explanatory context somewhere nearby
- label alone is not enough in detail views
- high risk should be stronger, but not automatically alarming in list contexts

## 7. Session Card

### Purpose

Primary unit of the dashboard.

### Spec Source

See:

- `session-card-spec.md`

### Shared Rules

- state-first hierarchy
- best verified fare only
- one primary CTA
- optional secondary actions

## 8. Candidate Card

### Purpose

Primary unit of the results list.

### Required Content

- verified price
- displayed price if different
- freshness
- booking type
- risk
- route summary
- stopover chips
- short explanation

### Rules

- verified price dominates
- explanation remains one short line
- stale/provisional states must be visible without taking over the card

## 9. Price And Trust Block

### Purpose

Core trust module for candidate detail and possibly preview contexts.

### Required Content

- verified price
- displayed price if different
- freshness
- handoff confidence state
- optional source currency note in detail contexts

### Rules

- this block should always be the strongest hierarchy after page title on candidate detail
- `Open in Trip.com` should visually depend on this block's trust state

## 10. Plain-Language Summary Block

### Purpose

Translate structured search/session configuration into natural language.

### Usage

- session detail / search setup
- pre-run review
- possibly dashboard mini-summary in later refinement

### Rules

- one concise paragraph or grouped lines
- must read like a trip brief, not a field dump
- should update when key form values change

## 11. AI Explanation Snippet

### Purpose

Surface AI reasoning inline without creating a chat surface.

### Usage

- session detail suggestions
- results list explanations
- candidate detail explanation blocks
- monitoring pattern notes

### Rules

- always attached to a concrete object or recommendation
- short and editable/dismissible where appropriate
- never positioned as a conversational feed

## 12. Recovery Banner / Panel

### Purpose

Guide the user through recoverable interruptions.

### Required Content

- what happened
- what the user needs to do
- what happens next
- recovery CTA

### Variants

- compact inline banner
- expanded recovery panel

### Usage

- live run progress
- session detail
- session dashboard
- settings connection area

## 13. Change Summary Item

### Purpose

Communicate meaningful change in compact form.

### Example Content

- `New low found: down AUD 34`
- `Candidate repriced during verification`
- `Best route now via Chengdu`
- `No major change since last run`

### Usage

- session cards
- results summary row
- monitoring screen

## 14. Action Cluster

### Purpose

Group the user's next meaningful actions without clutter.

### Rules

- only one primary CTA at a time
- secondary actions should remain clearly secondary
- CTA priority must respond to trust and recovery state

Examples:

- candidate detail: `Open in Trip.com` vs `Re-verify`
- session card: `Open Session` vs `Resume`

## Shared State Mapping Rules

These meanings must remain consistent across components:

### Freshness

- fresh = strong confidence
- aging = usable but softer confidence
- stale = re-check needed

### Booking Type

- single booking = default lower-friction label
- separate tickets = distinct but calm label

### Session State

- needs attention always outranks otherwise healthy status
- archived always feels quieter than other states

## Component Priority By Screen

### Session Dashboard

- Trip.com connection badge
- session state badge
- monitoring state label
- session card
- change summary item

### Session Detail

- plain-language summary block
- AI explanation snippet
- recovery banner
- action cluster

### Pre-Run Review

- plain-language summary block
- change/fork guidance
- action cluster

### Live Run Progress

- Trip.com connection badge
- recovery panel
- change summary item
- compact candidate cards

### Results Overview

- candidate card
- freshness badge
- booking type badge
- risk label
- AI explanation snippet

### Candidate Detail

- price and trust block
- booking type badge
- risk label
- verification freshness badge
- action cluster

### Monitoring / History

- monitoring state label
- change summary item
- recovery banner where needed

## Wireframe Consistency Rules

- use the same wording for the same state everywhere
- do not invent alternate labels screen by screen
- preserve CTA hierarchy logic across screens
- keep component complexity appropriate to context

Example:

- `Needs attention` should not become `Action required` on one screen and `Blocked` on another unless the distinction is intentionally meaningful

## What To Define Next

After this component spec, the next useful design artefacts are:

- Compare View wireframe spec
- state matrix for shared badges and labels
- visual design direction for hierarchy and tone

