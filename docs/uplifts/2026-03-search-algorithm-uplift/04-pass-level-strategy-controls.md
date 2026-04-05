# Pass-Level Strategy Controls

Status: `Complete`

## Context

The first strategy-tab implementation introduced bundle selection and safe
overrides, but the presentation was still too abstract:

- the UI spoke in planner and bundle language more than user language
- the pass list was visible only as static labels
- optional passes were partly configurable, but the overall shape was hard to
  understand at a glance
- deeper explanations were missing or buried in implementation wording

That made the strategy tab feel more like an internal tuning panel than a
session-facing control surface.

## Goal

Make the strategy configuration understandable and actionable without exposing
unsafe free-form pass editing.

The revised tab should:

- show every pass explicitly
- give every pass a visible toggle state
- explain each pass in plain terms
- allow expandable deeper detail where helpful
- add inline tooltips for the controls that are easy to misread

## Implemented Shape

### Pass cards

Each strategy now renders as a set of pass cards instead of a dense override
grid.

Each pass card shows:

- a visible toggle state
- whether the pass is required, optional, or unavailable
- a short plain-language summary
- expandable details and settings

### Toggle model

The revised UI distinguishes between:

- required passes
  - shown with locked read-only toggles
- optional passes
  - shown with editable toggles
- unavailable passes
  - shown with disabled toggles plus a reason

This preserves the product rule that the user can shape the search safely
without assembling arbitrary incompatible worker passes.

### Wording changes

The new copy shifts away from internal planner phrasing such as raw bundle
configuration and toward user-facing descriptions:

- what the pass looks for
- when it runs
- what evidence it uses
- what changing the numeric limit will actually do

### Tooltips and detail view

Controls that were easy to misread now have inline tooltip help, and each pass
has a built-in detail view for a deeper explanation.

This keeps the default view scannable while still making the implementation
shape legible when the user wants more context.

## Outcome

Implemented:

- pass-by-pass presentation in the strategy tab
- visible toggle state for every pass
- locked toggles for required passes
- better wording for pass summaries and settings
- inline tooltip help for pass and field explanations

Verified:

- `npm run typecheck`
- `npm run lint`
