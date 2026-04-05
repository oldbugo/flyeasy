# FlyEasy Automation Spec

## Purpose

Define how FlyEasy automates Trip.com safely and reliably for search, candidate extraction, stitched-itinerary validation, and deep verification without ever crossing into payment execution.

## Scope

This spec covers:

- browser lifecycle and session handling
- Trip.com login automation
- packaged itinerary search automation
- stitched itinerary validation automation
- deep verification flow
- retry, recovery, and anti-breakage rules
- artefact capture and persistence boundaries

This spec does not cover:

- payment submission
- mobile automation
- non-Trip.com providers

## Automation Principles

- Use `Playwright` with a persistent browser context so Trip.com login/session state can survive across runs.
- Prefer resilient page-object flows over brittle one-off scripts.
- Treat Trip.com UI as unstable; every critical step must verify page state before proceeding.
- Persist structured outputs only after parser validation succeeds.
- Never trust result-list prices alone when ranking final recommendations.
- Never click the final purchase/submit action.

## Runtime Architecture

The automation layer should be a long-lived local worker invoked by the app.

Main modules:

- `browser-manager`: starts and owns the Playwright browser context
- `session-manager`: handles Trip.com login state and session refresh
- `search-runner`: executes packaged search strategies
- `stitch-runner`: executes separate-leg searches and composes stitched candidates
- `verification-runner`: drives shortlisted candidates through deeper Trip.com stages
- `parser`: extracts normalized result and verification data
- `artifact-recorder`: saves screenshots, traces, and HTML snapshots when needed
- `automation-guard`: central safety checks and stop conditions

Recommended process model:

- one browser context per active run group
- one page per strategy execution by default
- separate isolated page instances for deep verification attempts

This avoids state bleed between search passes and verification flows.

## Browser And Session Model

### Browser Context

Use a persistent Chromium context stored in an app-controlled local directory.

The persistent context should contain:

- cookies
- local storage
- session storage if available through persisted browser state
- Trip.com language and region preferences when possible

Do not store this state in SQLite.

### Session States

The automation worker should treat its own session state explicitly.

These values are automation-internal and must be normalized into the app-facing connection states from `canonical-state-model.md` before they cross the application boundary.

- `unknown`
- `authenticated`
- `unauthenticated`
- `challenge_required`
- `expired`

Each run should begin with a lightweight session probe rather than assuming prior state is still valid.

Recommended normalization:

- `authenticated` -> `connected`
- `unauthenticated` -> `session_expired`
- `expired` -> `session_expired`
- `challenge_required` -> `challenge_required`
- `unknown` -> `unknown` or `blocked`, depending on whether the state is safely recoverable

### Login Flow

Login should support:

1. existing authenticated session reuse
2. app-managed login using locally encrypted credentials
3. challenge detection with pause-and-resume support

If Trip.com presents a CAPTCHA, device verification, or unusual challenge:

- stop the affected automation branch
- record the challenge state
- preserve artifacts
- mark the run as blocked rather than failed

## Core Automation Flows

### 1. Session Probe

Goal:

- confirm whether Trip.com is already logged in
- confirm the search surface is reachable
- detect interstitials such as region popups, consent banners, or bot friction

Outputs:

- normalized session status
- normalized page readiness status

### 2. Packaged Search Flow

Goal:

- execute Trip.com searches that rely on Trip.com's own bundled itinerary results

Inputs:

- normalized search request
- one normalized search strategy

Flow:

1. open Trip.com flight search surface
2. normalize locale, currency, and any dismissible overlays
3. choose trip shape needed by the strategy
4. fill origin, destination, and dates
5. apply stop-related filters where Trip.com exposes them
6. submit search
7. wait for results readiness markers
8. parse visible result cards
9. apply pagination or lazy-load scrolling only within bounded limits
10. normalize and persist extracted candidates

Result extraction must capture:

- displayed price
- airlines and flight numbers where visible
- stop count
- stop cities and layover durations if exposed
- departure and arrival times
- fare branding and baggage info if visible
- deep-link or resume token if obtainable

### 3. Stitched Search Flow

Goal:

- search route legs separately when Trip.com packaged results hide cheaper combinations

Flow:

1. decompose the strategy into leg-search tasks
2. search each required leg independently
3. parse top viable leg options per task
4. combine compatible legs into stitched candidates
5. reject combinations that violate hard constraints
6. rank provisional stitched combinations by displayed total
7. send shortlisted stitched candidates into deeper validation

Compatibility rules must include:

- airport continuity
- valid chronological order
- stopover duration within requested bounds
- mainland-China-only stopovers
- booking-risk annotation

The stitch runner should not explode combinatorially. It must cap retained options per leg search and per combination stage.

### 4. Deep Verification Flow

Goal:

- verify whether the shortlisted itinerary still exists and what the final payable price is before payment

Flow:

1. open candidate via resume URL, replay token, or reconstructed search path
2. confirm candidate identity matches the expected route pattern
3. advance through Trip.com detail and traveler stages as far as safely possible
4. extract updated price, fare details, and availability signals
5. stop before any irreversible purchase action
6. record a `verification_attempt`

Permitted terminal stages:

- result details page
- traveler details form
- final review page before submit/payment

Forbidden actions:

- submitting payment
- confirming purchase
- committing traveler information that triggers irreversible purchase intent

## State Machine

Each automation attempt should follow an explicit state machine.

Suggested top-level states:

- `booting`
- `session_probe`
- `login`
- `search_form`
- `results_loading`
- `results_ready`
- `candidate_parsed`
- `verification_loading`
- `verification_ready`
- `blocked`
- `completed`
- `failed`

Each state transition must be gated by one of:

- required selector present
- required text marker present
- parser-ready DOM shape confirmed
- bounded timeout reached

## Page Objects

The automation code should use page-object abstractions instead of direct selector sprawl.

Recommended objects:

- `TripHomePage`
- `TripLoginPage`
- `TripFlightSearchForm`
- `TripSearchResultsPage`
- `TripCandidateDetailsPage`
- `TripTravelerPage`
- `TripFinalReviewPage`
- `TripInterstitialHandler`

Each page object should expose:

- readiness checks
- high-level actions
- structured extraction helpers
- challenge and error detection

Selectors should be centralized and versioned by page object so breakages are localized.

## Parser Rules

Parsers should produce normalized objects only after passing minimum completeness checks.

Minimum candidate extraction requirements:

- route endpoints present
- displayed total price present
- stop count or leg structure present
- at least one timing marker present

If a card cannot be parsed completely enough to compare or verify later, discard it and log a parse warning.

Keep raw payload fragments only as bounded JSON for debugging. Do not dump full pages into the database.

## Search Budget Controls

Automation must respect bounded cost controls so the agent does not create runaway browser activity.

Per strategy execution define:

- max page navigations
- max result-scroll cycles
- max candidate cards parsed
- max stitched combinations retained
- max verification attempts launched
- max wall-clock duration

When a strategy hits budget limits:

- mark it as `completed` if it yielded usable results
- mark it as `skipped` or `failed` only if the limit prevented meaningful output

## Retry And Recovery Rules

Use targeted retries, not blind loops.

Allowed retry cases:

- page navigation timeout
- transient overlay interruption
- recoverable parser miss after reload
- session expired and re-login succeeds

Do not retry aggressively for:

- CAPTCHA or anti-bot challenge
- repeated selector mismatch after refresh
- repeated repricing of the same candidate
- irreversible flow ambiguity near payment

Suggested retry caps:

- navigation retry: 2
- parser retry after refresh: 1
- login retry after session expiry: 1
- candidate deep verification replay: 1

## Failure Taxonomy

Every failure or block should map to a normalized code.

Suggested codes:

- `session_expired`
- `challenge_detected`
- `selector_breakage`
- `results_timeout`
- `parse_incomplete`
- `candidate_missing`
- `candidate_repriced`
- `candidate_unavailable`
- `final_stage_unreachable`
- `unexpected_checkout_shape`

These codes should feed both monitoring and future AI strategy decisions.

## Artefact Capture Rules

Capture artefacts selectively:

- screenshot on challenge detection
- screenshot on parser failure after retry
- screenshot plus HTML snapshot on unexpected page shape
- Playwright trace for deep verification failures and critical blocked runs

Normal successful result extraction should not capture full traces by default. Keep artefacts bounded so local storage remains manageable.

## Safety Boundary

The automation layer must stop at the latest safe pre-purchase stage.

Safe boundary definition:

- candidate still reviewable
- payable price visible
- booking still not committed
- no final confirmation or payment action triggered

If the automation cannot distinguish a safe stage from a purchase-triggering stage, it must stop and record `unexpected_checkout_shape`.

## Monitoring Interaction

For background reruns:

- reuse existing authenticated session when valid
- prioritize proven strategies first
- deep-verify only the top few changed or newly promising candidates
- avoid deep-verifying unchanged low-priority candidates on every run

This keeps monitoring cost bounded while still catching repricing.

## API Boundary Between App And Automation

The app should pass the automation worker:

- search request snapshot
- resolved strategy payload
- optional candidate id for deep verification
- budget settings

The automation worker should return:

- normalized status
- candidate records
- verification attempt records
- price observations
- artifact metadata
- failure codes

The app should never depend on raw Playwright objects or selectors.

## First Implementation Cut

Implement in this order:

1. browser manager and session probe
2. Trip.com login flow with challenge detection
3. packaged search flow for baseline strategies
4. result parser and normalized candidate extraction
5. deep verification for packaged candidates
6. stitched search flow
7. artefact capture and richer recovery logic

## Acceptance Bar

The automation layer is good enough for v1 when it can:

- reuse or establish a Trip.com session
- run a packaged Melbourne to Guangzhou search
- extract normalized candidate data from results
- validate stop counts and mainland-China-only stopovers
- deeply verify shortlisted candidates without crossing into payment
- detect blocked, repriced, and unavailable outcomes
- provide enough structured output for ranking, monitoring, and AI learning
