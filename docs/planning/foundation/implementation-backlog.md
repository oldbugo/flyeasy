# Implementation Backlog

This backlog turns the planning set into an ordered MVP build sequence.

It is designed to be:

- implementation-oriented
- sequential enough for one developer to execute
- scoped to produce usable checkpoints early

## Live Status

Last updated: 2026-03-15

Status legend:

- `not_started`
- `in_progress`
- `completed`
- `blocked`

Task marker legend:

- `[ ]` not started
- `[~]` in progress / partially complete
- `[x]` completed

Current focus:

- `Cross-Cutting Engineering Tasks`

Current implementation snapshot:

- desktop bootstrap is in place
- local Next.js app shell and planned route stubs exist
- Electron runtime has been verified against the local dev server
- dependency audit is clean
- proof harness is in place and the baseline Trip.com session probe has been executed
- authenticated Trip.com session reuse, forced session-expiry detection, and manual recovery have been demonstrated locally
- baseline packaged search has been demonstrated against live Trip.com flows
- blocked-state recovery and checkpoint resume have been demonstrated in the same persistent browser context
- safe deep verification has been explored as post-MVP technical evidence, not as an MVP requirement
- the core SQLite schema, migration, bootstrap, seed path, and query helpers are now in place
- the session dashboard, session editor, monitoring toggle, duplicate, archive/restore, and review flow are now backed by SQLite
- the main session routes now share a real session-aware shell instead of isolated placeholder pages
- session authoring now includes Zod-backed server actions, a fork recommendation, and explicit AI placeholder modules
- a baseline review-to-run handoff now creates real `search_run` and `strategy_execution` rows
- session detail now supports saving edited hunts as forked sessions, and dashboard cards use live/not-live/archived variants
- deterministic baseline runs now transition through queued, running, completed, and cancelled states with live polling and persisted placeholder candidates
- results, compare, candidate detail, and history screens now read persisted candidate/run data and support shortlist plus rerun actions
- settings now reflects app-facing Trip.com connection state and local automation worker state
- baseline run creation now spawns a real Trip.com packaged-search worker that persists candidate rows, legs, stopovers, price observations, and artifacts
- blocked Trip.com runs now persist recovery metadata, expose resume affordances, and can complete through a user-mediated partial restart
- live run planning now expands beyond the baseline into stitched follow-up, alternate stopover, and alternate return-city strategy execution
- results, compare, candidate detail, and history now surface booking-type differentiation and stitched-risk context from persisted candidates
- persisted AI strategy proposals can now be generated, accepted, injected into run queues, and explained across session setup, run progress, and results

## Backlog Rules

- Build vertical slices where possible, not isolated technical layers with no UI value.
- Favor thin end-to-end flows early, then deepen them.
- Defer AI-heavy behavior until the session, run, result, and recovery foundations are stable.
- Keep the first automation flow narrow and reliable before expanding search breadth.

## MVP Scope Lock

The implementation backlog should treat the true MVP as:

- session-first UI and persistence
- deterministic run orchestration
- one reliable packaged Trip.com search flow
- manual booking handoff from extracted Trip.com results
- recovery for public-flow automation interruptions

The MVP should not depend on stitched search, authenticated Trip.com automation, deep verification, broad return-city optimization, or AI-generated strategy proposals.

## Phase 0. Project Setup

Status: `completed`

Goal:

- create the working app foundation

Tasks:

- [x] initialize the Next.js app with TypeScript and App Router
- [x] initialize the Electron shell and local desktop bootstrap
- [x] package a local Next.js standalone server path for desktop startup
- [x] add Tailwind CSS
- [x] add Drizzle-compatible database tooling, better-sqlite3, and Zod
- [x] create the base `src/` structure from the implementation map
- [x] set up linting, formatting, and environment variable handling
- [x] add a basic app shell layout
- [x] define app-data, artifact, and secure-storage service boundaries

Definition of done:

- app runs locally
- desktop shell starts and loads the app locally
- local Next.js server starts correctly inside the desktop runtime
- database tooling runs locally
- base folders and conventions are established

Implementation notes:

- local DB tooling currently uses project scripts instead of `drizzle-kit` so the dependency audit stays clean
- app-data and artifact paths are implemented in runtime path helpers
- secret storage currently has a planned interface and status boundary, but not an OS-backed adapter yet

## Phase 0.5. Technical Proofs

Status: `completed`

Goal:

- de-risk the Trip.com automation boundary before broader MVP implementation effort

Tasks:

- [x] prove persistent browser-context reuse and blocked-state detection
- [x] prove packaged-search extraction for the baseline route
- [x] prove blocked-state recovery and resume in the same session story
- [x] explore a safe deep-verification boundary as post-MVP technical evidence

Definition of done:

- the MVP-critical proof goals from `technical-proof-plan.md` have acceptable outcomes
- any required scope or architecture corrections are applied before deeper build phases continue

Implementation notes:

- Playwright proof harness is in place
- `proof:install-browser` provisions the required Playwright Chromium runtime
- `proof:session-probe` is the first concrete proof script
- `proof:packaged-search` now executes the baseline Melbourne-to-Guangzhou packaged-search flow and parses both outbound and return result stages
- `proof:recovery-resume` now forces session invalidation, waits for manual recovery, and proves checkpoint resume through an explicit partial restart
- `proof:deep-verification` remains as an exploratory post-MVP proof script rather than an MVP gate
- the first baseline unauthenticated session probe has been recorded in `proof-run-log.md`
- a headed manual-login run established a reusable authenticated marker and a follow-up probe reused it successfully
- forced session invalidation now proves both expired-session detection and manual recovery in the same persistent browser context
- proof outputs should be recorded in `proof-run-log.md`

## Phase 1. Database Foundation

Status: `completed`

Goal:

- create the first usable SQLite schema and persistence layer

Tasks:

- [x] implement Drizzle schema files for:
  - `session`
  - `session_city_preference`
  - `candidate_family`
  - `search_run`
  - `strategy_execution`
  - `itinerary_candidate`
  - `candidate_leg`
  - `candidate_stopover`
  - `price_observation`
  - `session_shortlist_entry`
  - `run_artifact`
- [x] generate and apply the initial migration
- [x] add database connection bootstrap
- [x] add seed helpers for local UI development
- [x] add query helpers for sessions, runs, and candidates
- [x] add query helpers for cross-run candidate-family summaries

Definition of done:

- schema exists and migrates cleanly
- app can read and write core MVP entities

Implementation notes:

- the app now auto-applies local SQL migrations on first DB access
- the dashboard reads seeded session data from the local SQLite file
- database tooling scripts in `package.json` are intentionally dormant until the Drizzle toolchain is reintroduced safely

## Phase 2. Session Foundation

Status: `completed`

Goal:

- make the session-first product model real

Tasks:

- [x] implement session creation
- [x] implement session editing
- [x] implement session duplication
- [x] implement archive and restore actions
- [x] implement monitoring enable and disable actions
- [x] persist preferred and excluded city preferences plus search intensity
- [x] implement dashboard session grouping:
  - `Live hunts`
  - `Not live`
  - `Archived`
- [x] implement session detail loading

Definition of done:

- user can create and manage sessions from the real UI
- dashboard is backed by SQLite, not mock data

## Phase 3. App Routes And Screen Shells

Status: `completed`

Goal:

- establish the main route structure and screen scaffolding

Tasks:

- [x] create routes for:
  - `/`
  - `/sessions/new`
  - `/sessions/[sessionId]`
  - `/sessions/[sessionId]/review`
  - `/sessions/[sessionId]/runs/[runId]`
  - `/sessions/[sessionId]/results`
  - `/sessions/[sessionId]/candidates/[candidateId]`
  - `/sessions/[sessionId]/compare`
  - `/sessions/[sessionId]/history`
  - `/settings`
- [x] implement the shared app shell
- [x] implement placeholder empty states and loading states
- [x] map screen regions according to the wireframe specs

Definition of done:

- all core routes render with real server-loaded shells
- route structure matches the planning docs

Implementation notes:

- all planned MVP routes exist and build successfully
- current session routes now share a consistent workspace shell with session-aware tabs, badges, and screen regions
- results, compare, history, run, and candidate routes still need real data modules, but no longer start from blank placeholders

## Phase 4. Session UI And Server Actions

Status: `completed`

Goal:

- complete the session setup flow end to end

Tasks:

- [x] implement the session detail / search setup form
- [x] add validation using Zod
- [x] implement pre-run review generation from a session definition
- [x] implement fork recommendation behavior on session updates
- [x] implement inline AI placeholder and explanation blocks as static product modules
- [x] implement session card component and variants

Definition of done:

- user can define a trip hunt, review the search plan, and prepare to run it

Implementation notes:

- session creation, editing, duplication, archive/restore, and monitoring toggles are implemented as server actions
- Zod validation is enforced at the server-action boundary for session create/update flows
- pre-run review is generated from persisted session fields and city preferences
- sessions with history or a current best candidate now expose an explicit `Save as forked session` path that preserves the original session history while creating a new editable session
- the dashboard session card now supports state-based variants for live, standard, and archived groups

## Phase 5. Run Orchestration Skeleton

Status: `completed`

Goal:

- make runs real before automation is real

Tasks:

- [x] implement `createRunFromSession`
- [x] implement `search_run` persistence
- [x] implement `strategy_execution` creation for deterministic baseline strategies
- [x] implement run status transitions
- [x] implement live progress polling endpoint
- [x] implement recent-event synthesis from run state
- [x] implement stop run behavior

Definition of done:

- user can start a run and watch structured progress in the UI
- progress can be driven by deterministic placeholder execution

Implementation notes:

- baseline run creation now goes through a dedicated `createRunFromSession` helper instead of inline page-action inserts
- the deterministic run engine drives queued-to-running-to-completed transitions and persists synthesized candidates for the newest run
- the run screen polls a dedicated `/api/runs/[runId]/progress` endpoint and supports explicit user cancellation

## Phase 6. Results And Candidate Layer

Status: `completed`

Goal:

- make result viewing, trust, and comparison real

Tasks:

- [x] implement candidate list queries
- [x] implement results overview screen
- [x] implement candidate detail screen
- [x] implement compare view
- [x] implement shortlist create/update behavior
- [x] implement verification freshness display from persisted fields
- [x] implement trust blocks, badges, and risk presentation

Definition of done:

- results flow works end to end against persisted candidate data

Implementation notes:

- results cards now surface shortlist state, current-best badges, travel-time summaries, and manual Trip.com handoff links
- candidate detail includes persisted leg structure, price observations, stopovers, and shortlist controls
- compare now renders a real side-by-side matrix from the latest session candidates

## Phase 7. Monitoring And History

Status: `completed`

Goal:

- make sessions useful over time

Tasks:

- [x] implement monitoring/history route
- [x] implement run history queries
- [x] implement price history queries
- [x] implement change summaries
- [x] implement rerun-now action
- [x] implement monitoring state transitions in the UI
- [x] implement session-level current best summary refresh

Definition of done:

- user can inspect what changed over multiple runs for a session

Implementation notes:

- history now combines run history, recent price observations, route-family continuity, and a rerun control on one screen
- rerun-now creates a fresh live baseline run and returns the user to the run progress surface

## Phase 8. Trip.com Connection Foundation

Status: `completed`

Goal:

- establish connection and recovery state before full search automation

Tasks:

- [x] implement Trip.com connection state service
- [x] implement secure local storage interface for credentials or session material
- [x] implement settings screen connection section
- [x] implement login/recovery start flow
- [x] implement recovery confirmation flow
- [x] implement blocked-state banners and resume affordances

Definition of done:

- the app can truthfully show whether Trip.com is ready, blocked, or requires user action

Implementation notes:

- Trip.com readiness is now tracked through app-data runtime snapshots rather than hardcoded UI text
- settings can start a public readiness check or launch a manual recovery window in the FlyEasy-managed browser profile
- MVP secure storage is intentionally marked not required because baseline automation does not store Trip.com credentials
- blocked runs now surface a recovery banner that points the user back to settings

## Phase 9. Baseline Automation

Status: `completed`

Goal:

- execute one real Trip.com search flow reliably

Tasks:

- [x] implement Playwright service bootstrap
- [x] implement persistent browser context reuse
- [x] implement session check task
- [x] implement one packaged-search strategy execution
- [x] implement result extraction into normalized candidate rows
- [x] persist candidate legs and stopovers
- [x] persist automation artifacts on failure or debug

Definition of done:

- one real search flow produces candidate data visible in the app

Implementation notes:

- live baseline runs now spawn a detached Playwright worker script instead of waiting on deterministic timers
- the worker reuses a persistent browser context, executes a real Melbourne to Guangzhou packaged Trip.com search, persists candidate rows plus artifacts, and updates run/session state in SQLite
- connection and worker snapshots are written to app data so the UI can reflect automation readiness and failures

## Phase 10. Optional Deep Verification

Status: `not_started`

Goal:

- explore whether a later authenticated verification flow can be added without undermining product safety

Tasks:

- implement candidate verification task
- persist `verification_attempt`
- persist `price_observation`
- update candidate latest verified fields
- emit repriced and unavailable outcomes into run progress and candidate detail
- implement manual candidate re-verification action

Definition of done:

- post-MVP verification is available only behind explicit safety controls and does not become part of the default booking-handoff path

## Phase 11. Recovery Resume

Status: `completed`

Goal:

- recover from login and challenge interruptions without losing user trust

Tasks:

- [x] implement recovery-required event handling
- [x] persist blocked-state run updates
- [x] persist recovery metadata on runs
- [x] implement resume run after recovery
- [x] ensure run progress screen reflects blocked, resumed, and failed states
- [x] capture recovery-related artifacts when useful

Definition of done:

- blocked runs can pause and resume through a user-mediated flow

Implementation notes:

- the automation worker now persists blocked Trip.com runs with recovery state, resume checkpoints, and recovery-related artifacts
- settings exposes a recovery queue and the run page exposes an inline resume action for blocked runs
- a forced blocked-state run has been resumed successfully through the real worker path, and the resumed run now emits a recovery-completed event into run progress

## Phase 12. Stitched Search Expansion

Status: `completed`

Goal:

- support the second major search mode for price optimization

Tasks:

- [x] implement stitched strategy task
- [x] persist stitched candidate structure
- [x] compute stitched risk summaries
- [x] surface stitched booking differentiation across results and compare screens
- [x] include stitched search outcomes in monitoring/history

Definition of done:

- user can compare single-booking and stitched options in the same product flow

Implementation notes:

- run planning now queues a stitched follow-up strategy when the session booking mode allows it
- stitched candidates are persisted as first-class `itinerary_candidate` rows with `booking_type = stitched` and derived stitched-risk summaries
- compare, results, candidate detail, and history surfaces now expose stitched differentiation instead of flattening everything into packaged baseline output

## Phase 13. Broader Search Expansion

Status: `completed`

Goal:

- widen search breadth after the narrow baseline is stable

Tasks:

- [x] expand deterministic stopover-city exploration
- [x] expand alternate return-city exploration
- [x] add broader strategy budgeting beyond the initial baseline
- [x] improve candidate-family comparison across repeated runs

Definition of done:

- the product can explore a meaningfully broader search space without undermining reliability

Implementation notes:

- session-driven strategy planning now adds alternate stopover and alternate return-city strategies based on booking mode and search intensity
- broader strategies currently derive additional candidates deterministically from the live packaged baseline, which keeps the expansion reliable while still widening the candidate set
- candidate-family continuity now carries these broader outcomes into history and shortlist-aware cross-run comparison

## Phase 14. AI Strategy Layer

Status: `completed`

Goal:

- add adaptive search behavior without destabilizing the product

Tasks:

- [x] implement AI strategy proposal generation
- [x] validate proposals against hard constraints
- [x] persist accepted proposals if needed
- [x] inject accepted strategies into the run queue
- [x] surface inline AI explanations in search setup, progress, and results

Definition of done:

- AI can influence search strategy safely and transparently

Implementation notes:

- AI strategy proposals are now persisted as first-class rows with explicit `proposed`, `accepted`, and `dismissed` states
- proposal freshness is tied to a session-configuration fingerprint, so run-state updates do not invalidate accepted AI input
- accepted proposals are injected into `strategy_execution` as `source_type = ai` and remain bounded by the same hard session constraints as system strategies
- session detail and review now expose explicit accept/dismiss controls, the run progress surface shows AI-sourced queue entries, and the results screen explains which accepted AI ideas influenced the latest run

## Cross-Cutting Engineering Tasks

These should run alongside the main phases.

### Testing

- add unit tests for session validation rules
- add unit tests for search strategy normalization
- add unit tests for lifecycle and monitoring transitions
- add integration tests for key query and action contracts
- add automation tests around the baseline Trip.com flow once automation exists

### Logging And Diagnostics

- add structured server-side logging
- add automation diagnostic capture behind a clear interface
- avoid leaking raw internal errors into UI responses

### Developer Experience

- add seed scenarios for realistic sessions, runs, and candidates
- add scripts for resetting local development data
- add sample fixture data for UI work before full automation exists

## Suggested Execution Order

If implementing continuously, the recommended sequence is:

1. Phase 0
2. Phase 0.5
3. Phase 1
4. Phase 2
5. Phase 3
6. Phase 4
7. Phase 5
8. Phase 6
9. Phase 7
10. Phase 8
11. Phase 9
12. Phase 10
13. Phase 11
14. Phase 12
15. Phase 13
16. Phase 14

## Best First Milestone

The first meaningful milestone should end after Phase 6.

At that point, FlyEasy would already have:

- a real session-first UI
- real persisted runs
- structured live progress
- real candidate and shortlist views

Even before full Trip.com automation, that milestone would make the product and codebase tangible.

## MVP Release Milestone

The first production-credible MVP milestone should end after Phase 11.

At that point, FlyEasy would have:

- a real session-first UI
- one real packaged Trip.com search flow
- persisted candidate extraction
- verified trust signals for top candidates
- resumable recovery for login/session interruptions

That is the point where the product proves its core value. Everything after that should be treated as expansion, not prerequisite scope.

## Immediate Next Step

The next practical move is Phase 10 execution:

1. decide whether post-MVP verification should stay exploratory or get productized behind stricter safety controls
2. tighten the live Trip.com parser so stopovers and leg metadata are less heuristic
3. build the recovery-resume loop on top of the now-real connection and baseline automation foundations
