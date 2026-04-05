# FlyEasy UX Requirements

## Purpose

Define the UX requirements for FlyEasy v1 so the product is driven by trust, clarity, and decision support rather than by backend capability alone.

This document expands the UI flow into concrete experience requirements across the product's critical UX areas.

## Product UX Position

FlyEasy should feel like a high-trust travel decision workspace, not a generic search form and not a raw automation console.

The product needs to balance four competing realities:

- the search space is broad and exploratory
- Trip.com automation is volatile and sometimes blocked
- AI assistance should feel helpful but not opaque
- booking decisions depend on trust in verification, not just raw price

The primary UX object is a long-lived `session` or `trip hunt`, not a one-off search form submission.

## Global UX Requirements

These apply across the entire product.

### Trust

- Verified price must always be visually distinguishable from displayed search price.
- Single-booking itineraries and stitched itineraries must never share the same visual treatment.
- Every recommended itinerary must carry verification freshness and risk context.
- Blocked, repriced, and unavailable states must be shown as legitimate product outcomes, not generic errors.

### Legibility

- The user must always be able to identify the current trip definition without drilling into settings.
- Search complexity should be progressively disclosed, not front-loaded.
- AI reasoning should be available in plain language near the relevant feature, not hidden in a detached diagnostics screen.

### Continuity

- Long-running searches must surface useful partial value before completion.
- Background monitoring must feel like a continuation of the same search story, not a separate subsystem.
- If the user leaves and comes back, the app should clearly show what changed since the last interaction.
- Major search refinements should usually evolve the same session unless the user explicitly chooses to fork it.

### Intervention

- When automation needs human help, the UI must explain exactly what action is required.
- Recovery actions should be explicit, minimal, and resume-oriented.
- The app must distinguish between "needs your help", "search still running", and "search failed".

## Area 1: Session And Account UX

### Goal

Make Trip.com connection status understandable and recoverable without making the product feel like an account-management app.

### Required UX Functions

- Connect Trip.com account or session from within FlyEasy.
- Show current connection health at all times in lightweight form.
- Detect expired session, challenge, and blocked login states.
- Allow the user to re-authenticate and resume the paused search.
- Show when credentials are stored locally and how they are being used.

### Required Screens Or Modules

- settings-level `Trip.com connection` screen
- reusable session-status badge in the global shell
- inline blocked-state recovery panel during active runs
- first-run connect flow before automation begins

### Required States

- not connected
- connected and healthy
- session expired
- challenge required
- blocked pending user action

### Interaction Rules

- The user should not need to visit Settings to understand connection state; summary state belongs in the shell.
- Initial connection should be presented as a guided step with plain-language explanation of why it is needed.
- If a challenge occurs mid-run, the UI should preserve run context and shift into a recoverable blocked state instead of ejecting the user.
- Resume should continue the interrupted run where feasible, not silently restart from scratch.

### Content Requirements

The UI must explain:

- why FlyEasy needs Trip.com access
- whether credentials are stored locally
- that payment will never be submitted automatically
- what the user needs to do when a CAPTCHA or challenge appears

### Current Design Recommendation

Use a lightweight connected-state indicator in the header, but keep the full connection management in Settings plus inline recovery surfaces. This keeps the product focused on trip search while still treating session health as first-class.

## Area 2: Search Authoring UX

### Goal

Let the user define a complex flexible trip without making the form feel like an expert-only planning console.

### Required UX Functions

- Create and evolve a long-lived search session.
- Create a new session from simple core inputs.
- Save a session for later monitoring and reruns.
- Switch between duration-based and return-window-based trip logic.
- Control stop count, stop duration, and booking mode.
- Specify preferred and excluded stopover cities.
- Configure return-origin flexibility.
- Tune search intensity without exposing raw strategy internals.

### Required Input Hierarchy

Primary inputs:

- origin
- destination
- departure window
- return rule
- return origin mode

Secondary inputs:

- max stops
- stop duration range
- booking mode
- monitoring enabled

Advanced inputs:

- preferred stopover cities
- excluded stopover cities
- preferred return cities
- search intensity

### Interaction Rules

- The form should default to a simple mode and progressively reveal advanced controls.
- Each advanced choice should immediately update a plain-language trip summary.
- The user must never need to understand strategy types such as `one_stop_city_sweep` to create a search.
- If the user makes the search unusually broad, the app should warn about time and volatility rather than blocking the action.

### AI Support Requirements

- The search form may recommend stopover cities, date ranges, or flexibility tweaks.
- AI suggestions must always be optional and editable.
- Suggested inputs must clearly read as recommendations, not automatic overrides.

### Current Design Recommendation

Design the search form as a layered workspace:

- top section for trip definition
- middle section for flexibility and stopover logic
- expandable advanced section for city pools and intensity
- side summary panel that rewrites the current search in human terms

Session behavior recommendation:

- edits evolve the current trip hunt by default
- `Duplicate / Fork session` exists as an explicit action for branching
- monitoring stays attached to the session rather than to an isolated run
- the product should recommend forking only when the travel intent materially changes

## Area 3: Live Run Transparency UX

### Goal

Make long-running search and verification activity understandable enough that the user trusts the process and knows when to intervene.

### Required UX Functions

- Show search progress in real time.
- Communicate current phase: seed, expand, verify.
- Show active strategy in human language.
- Show when new best candidates appear before the run completes.
- Surface blocks, retries, and recovery needs.
- Allow pause, stop, and resume behaviors.

### Required UI Modules

- progress header
- phase tracker
- live event log
- current focus panel
- emerging best-candidate shelf
- intervention banner when blocked

### Interaction Rules

- Progress should not be a generic spinner. It needs narrative structure.
- Technical detail should be layered: calm summary by default, deeper diagnostics on demand.
- If the search is still useful but incomplete, the interface must clearly show which candidates are provisional and which are deeply verified.
- Pause and stop actions should explain their impact on the current run.

### Content Requirements

Translate internal strategy behavior into human language, for example:

- "Testing one-stop routes through Shanghai"
- "Comparing packaged Trip.com options with separate-ticket combinations"
- "Rechecking top results because prices changed during checkout"

### Current Design Recommendation

Use a structured, technical progress layout with timely feedback:

- clear current-phase header
- visible strategy queue with statuses
- current city or route focus
- candidate and verification counts
- meaningful events as they happen

Avoid raw logs and engineering-only diagnostics by default, but make the system feel inspectable and responsive.

Default visible progress should include:

- run status
- current phase
- current focus
- best verified fare so far
- candidates found
- candidates verified
- strategy queue summary
- latest meaningful event
- Trip.com session state
- attention banner if blocked

Expanded progress should add:

- recent strategy history
- verification outcome breakdown
- current route or city under test
- booking mode under evaluation
- stitched-search activity
- elapsed time
- strategies completed versus planned
- recent retries and interruptions

## Area 4: Results Trust And Verification UX

### Goal

Help the user choose a cheap option confidently by making price validity, risk, and tradeoffs explicit.

### Required UX Functions

- Compare candidates by verified price first.
- Distinguish displayed price from verified price.
- Surface risk and booking type clearly.
- Explain why a candidate was recommended.
- Show verification history and freshness.
- Support re-verification of individual candidates.
- Support shortlist and compare actions.

### Required Candidate Attributes In UI

- verified price
- displayed price if different
- verification freshness
- booking type
- stopover cities
- stop durations
- total travel time
- return origin city
- risk level
- route summary

### Required Detail-Level Explanations

Every candidate detail view should be able to answer:

- why this option is cheap
- whether it stayed stable during verification
- whether it is a single booking or separate tickets
- how risky the connection pattern is
- how stale the current verification is

### Verification States The UX Must Support

- not checked
- verified
- repriced
- unavailable
- partial verification
- stale verification

### Interaction Rules

- Verified price must be the dominant price on card and detail views.
- A repriced candidate should stay visible but lose recommendation priority.
- Unavailable candidates should remain visible in history contexts but not in primary recommendation areas.
- Re-verification should be callable from the candidate detail view and from stale candidate states.

### Current Design Recommendation

Use recommendation-style cards for first-pass browsing, but ensure every card exposes enough metadata to prevent a false sense of certainty. Then use a denser comparison view for serious decision-making.

Stitched-itinerary treatment recommendation:

- clearly differentiated from single bookings
- neutral, factual risk communication
- stronger warning treatment only when the actual risk is unusually high

## Area 5: Monitoring Lifecycle UX

### Goal

Make long-lived sessions and recurring reruns feel like an evolving travel hunt rather than a hidden background task.

### Required UX Functions

- save a session
- enable or disable monitoring
- rerun immediately
- edit an existing session
- pause monitoring without deleting the session
- inspect run history and price movement
- understand what changed since the last run

### Required Monitoring Views

- session list
- search detail with current status
- run history timeline
- price change summary
- recurring winning city patterns
- blocked and failed run history

### Interaction Rules

- Monitoring state should be visible from both the dashboard and the session detail view.
- Price changes should be expressed relative to prior verified observations, not just raw current numbers.
- "What changed" should be a first-class summary, not a secondary analytics panel.
- A blocked monitored search should surface an action to recover, not just a failed badge.

### Current Design Recommendation

Treat monitoring as the persistent memory of the product. It should feel like the user's active trip watchlist and search journal combined.

Session behavior recommendation:

- sessions should feel lightweight and watchlist-like
- they should remain long-lived and editable
- the product should avoid making session management feel like project administration

Session grouping recommendation:

- `Live hunts`
- `Not live`
- `Archived`

Grouping should be state-based rather than filter-heavy.

Within `Live hunts`, sessions needing attention should appear before healthy active hunts.

## Area 6: Settings And Recovery UX

### Goal

Provide a home for the system-level controls without forcing the user into Settings for normal trip work.

### Required UX Functions

- manage Trip.com credentials/session
- manage AI provider configuration
- configure local storage or artifact retention
- inspect automation health basics
- review blocked-state guidance
- set reasonable product defaults

### Required Settings Sections

- `Trip.com Connection`
- `AI Configuration`
- `Automation And Storage`
- `Search Defaults`

### Recovery Requirements

The product must support recoverable workflows for:

- expired Trip.com session
- challenge required
- verification blocked
- search interrupted by app close or restart
- stale best candidate requiring fresh re-check

### Interaction Rules

- Recovery entry points should exist in-context first, with Settings as a secondary destination.
- Settings should explain operational consequences in plain language.
- Sensitive actions should feel explicit and reversible where possible.

### Current Design Recommendation

Keep Settings narrow and operational, not sprawling. The main product value should stay in Search, Results, and Monitoring.

## Cross-Cutting UX Functionalities Required

These are product features from a UX perspective, not merely implementation details.

### 1. Plain-Language Search Summary

The app must continuously rewrite the user's structured search into a readable summary before and during execution.

### 2. Verification Freshness System

The UI must visually show how fresh a verified price is and prompt re-verification when it is stale.

### 3. Recommendation Explanation Layer

The UI must explain why a candidate surfaced and what strategy pattern led to it, without exposing raw internal jargon by default.

### 4. Risk Communication System

The app must encode booking-risk differences consistently across card, detail, compare, and handoff views.

### 5. Blocked-State Recovery System

The product must treat automation intervention as a designed flow with instructions, resume handling, and state preservation.

### 6. Change Detection Summary

The app must summarize what changed between runs:

- cheaper option found
- previously cheap option repriced
- option disappeared
- new city pattern emerged

### 7. Handoff Confidence Layer

Before sending the user to Trip.com, the app must restate:

- current verified price
- last checked time
- booking type
- major risk warnings

## Proposed UX Priorities For V1

If scope has to tighten, prioritize these first:

1. search authoring clarity
2. live run transparency
3. results trust and verification
4. blocked-state recovery
5. session monitoring lifecycle
6. settings depth

## Session Evolution Vs Forking Rules

### Default Rule

The default behavior should be to evolve the existing session.

FlyEasy should recommend forking only when the user makes a change that materially alters the travel intent and would make prior session history less meaningful.

### Evolve In Place

These changes should remain within the same session by default:

- widening or narrowing date windows
- changing duration range
- changing stop count
- changing stop-duration range
- adjusting preferred or excluded stopover cities
- changing return-origin flexibility
- changing monitoring state
- changing search intensity

### Major Refinement

These changes should still evolve the same session by default, but the UI may warn that results could shift significantly:

- changing booking mode from `single only` to `both`
- broadening search flexibility substantially
- changing advanced city preferences in a major way

### Recommend Fork

These changes should trigger a recommendation to fork into a new session:

- changing origin city or airport
- changing primary destination
- changing the trip objective in a meaningful way
- changing the search into a substantially different hunt the user may want to compare side by side

### UX Behavior

When the product detects a fork-worthy change:

- do not fork automatically
- present a lightweight choice
- recommend `Fork session` when the change is intent-level
- allow `Update this session` if the user deliberately wants continuity

### UX Copy Direction

The product should frame this as preserving clarity, not as administrative overhead.

Example:

- "This change will significantly alter the trip hunt. We recommend starting a new session so earlier results remain meaningful."

## Current Recommendation Summary

Best current direction:

- session-first home screen
- long-lived evolving trip hunts
- state-first session cards on the dashboard
- progressive disclosure in the form
- inline embedded AI explanations
- structured and technical live feedback
- recommendation-led results with deeper compare mode
- explicit verification freshness and risk language
- stitched itineraries clearly differentiated but not alarmist
- watchlist-style saved sessions
- default-to-evolve sessions with fork recommendations only for intent-level changes
- in-context recovery flows with Settings as backup

This direction matches the product's central UX challenge: helping a flexible traveler trust an AI-assisted automation system enough to act on the results.

