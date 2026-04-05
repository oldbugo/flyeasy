# Program Transparency And Suggestion Wording

Status: `Complete`

## Context

Two user-facing gaps were still open:

- the strategy tab did not show the actual compiled execution program
- deterministic suggestions were still labeled as `AI` in several visible places

Both issues weakened trust in the search-planning surface.

## Implemented Shape

### Compiled search program

The strategy page now shows the compiled deterministic program produced by the
currently enabled strategy clusters.

That panel now makes visible:

- execution order
- strategy types
- per-step estimated live-query cost
- total estimated live-query cost

### Suggestion wording

The visible suggestion surfaces now use more accurate language:

- `System suggestions`
- `Deterministic suggestions`
- `Accepted suggestions`

This change was applied to the strategy tab, the new-session guidance, the run
summary copy, and the run/overview suggestion-influence surface.

## Why This Matters

Users can now see both:

- what the deterministic planner will actually run
- what extra system-generated suggestions may be added only after explicit
  acceptance

That is much closer to the product behavior than the earlier `AI` framing.

## Current Status

`Complete`:

- compiled search-program preview added to the strategy page
- estimated live-query budget surfaced before launch
- deterministic suggestion wording updated on the strategy tab
- deterministic suggestion wording updated in the run and overview surfaces
- accepted-suggestion wording updated in run summaries and run events

`In progress`:

- broad cleanup of remaining internal `ai` naming in non-user-facing code

`Not started`:

- any future real model-backed suggestion layer

## Verification

- `npm run typecheck`
- `npm run lint`
