# Uplifts

This folder keeps a paper trail for post-foundation product uplifts.

Use it when a change is larger than a one-line backlog note and deserves context,
decision history, and an implementation outcome that other developers or AI
agents can follow later without re-reading the full chat history.

## Structure

- one subfolder per uplift when the change has multiple moving parts
- if several related uplifts belong to the same theme, create a parent folder
  for the theme and keep numbered review/plan/phase docs inside it
- a single markdown file may be enough for tiny changes, but folders are preferred
  once implementation, tradeoffs, or follow-up notes are involved
- each uplift record should cover:
  - context
  - goal
  - scope
  - implementation strategy
  - outcome
  - follow-up notes, if any

## Workflow

1. Create a new uplift folder before implementation starts.
2. Record the request and the intended approach.
3. Update the same file with the implementation outcome once the work lands.
4. Link the uplift from future related changes when the work builds on it.

## Glossary

- `uplift`: a product or UX improvement added after the initial phase plan
- `context`: why the change is being requested now
- `goal`: the user-facing behavior we want to achieve
- `scope`: what is included and excluded in the current change
- `outcome`: what was actually implemented and verified
- `location catalog`: the local canonical dataset used to validate and suggest airports or cities
- `canonical value`: the normalized stored value the app persists after accepting user input
- `verification`: checking that a typed location resolves to a known catalog entry before it is saved
- `query execution`: one concrete search attempt inside a run, with explicit inputs, status, and result summary
- `direct sweep`: the first-pass search that samples valid outbound/return date pairs before any derived expansion
- `evidence-driven follow-up`: a second-pass search that only exists because a prior direct query exposed a promising stopover city
