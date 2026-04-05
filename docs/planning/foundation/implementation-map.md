# Implementation Map

This document translates the planning set into an implementation-ready structure for the FlyEasy MVP.

It is not a detailed build ticket list. Its purpose is to lock:

- the app architecture
- the route map
- the frontend module boundaries
- the backend and automation interfaces
- the initial delivery sequence

## Implementation Goal

Build a local-first desktop app that lets a user create and evolve long-lived trip-hunt sessions, run Trip.com searches through browser automation, inspect extracted results, and monitor sessions over time.

The MVP should prioritize:

- session-first navigation
- trustworthy live run feedback
- trustworthy displayed-price result presentation
- clear recovery when automation is blocked
- a structure that supports later AI-assisted search evolution without rewriting the app shell

The MVP should explicitly avoid depending on stitched-search breadth, authenticated Trip.com automation, or AI strategy generation before the packaged-search extraction loop is stable.

## Recommended Stack

- `Electron` for MVP desktop packaging
- `Next.js` with App Router for the local web app
- `TypeScript` across UI, orchestration, and automation boundaries
- `SQLite` for local structured persistence
- `Drizzle ORM` for schema and migrations
- `Playwright` for Trip.com automation
- `Zod` for request, response, and job payload validation
- `Tailwind CSS` for MVP UI styling

## Runtime Recommendation

Follow `runtime-architecture.md` as the concrete MVP runtime decision.

In short:

- Electron owns desktop startup and process orchestration
- a packaged local Next.js server renders the local UI and hosts app routes
- the application layer runs locally in that Node server process
- Playwright runs in a sibling worker process behind an internal automation boundary
- SQLite and artifacts live in app-controlled local storage
- secrets use OS-backed secure storage

## Top-Level Architecture

Use a single local app with a clear split between UI, orchestration, and automation.

### 1. Web App

Responsible for:

- rendering the session-first UI
- editing session search definition
- showing runs, results, monitoring, shortlist, and recovery state
- triggering actions such as create session, start run, pause monitoring, resume after recovery

### 2. Application Layer

Responsible for:

- validating user input
- reading and writing session state
- selecting and scheduling search strategies
- translating automation events into UI-safe state
- enforcing policies from monitoring, currency, and lifecycle specs

### 3. Automation Layer

Responsible for:

- managing Playwright browser context and Trip.com session state
- executing packaged and stitched search flows
- supporting optional post-MVP deep verification only behind a separate safety boundary
- collecting traces, screenshots, and structured automation outcomes

### 4. Persistence Layer

Responsible for:

- storing sessions, runs, candidates, shortlist state, price observations, and later optional verification attempts
- storing normalized search and run outputs for later learning
- keeping artifact pointers, not binary blobs, in the database

## App Route Map

The app should follow the product IA, but routes should be implementation-friendly.

The route map does not need to imply top-level navigation. For MVP, prefer a session-first shell where Search, Results, Compare, and History are session-level views after entering a session.

### Primary Routes

- `/`
  - Session dashboard
  - Groups: `Live hunts`, `Not live`, `Archived`
- `/sessions/new`
  - New session creation flow
- `/sessions/[sessionId]`
  - Session detail and search setup
- `/sessions/[sessionId]/review`
  - Pre-run review
- `/sessions/[sessionId]/runs/[runId]`
  - Live run progress
- `/sessions/[sessionId]/results`
  - Results overview for the current or selected run
- `/sessions/[sessionId]/candidates/[candidateId]`
  - Candidate detail and booking handoff
- `/sessions/[sessionId]/compare`
  - Side-by-side compare view
- `/sessions/[sessionId]/history`
  - Monitoring and run history
- `/settings`
  - Trip.com connection status, app behavior defaults, artifact retention, AI provider config

### Route Notes

- Keep monitoring/history inside a session route rather than as a standalone top-level page in code.
- Results should always be scoped to a session, and usually to a current run context.
- Recovery should usually appear inline in the relevant route rather than as a separate standalone route.

## Frontend Screen Modules

Each screen should be built from stable modules rather than page-specific one-offs.

### Dashboard

Modules:

- app shell
- dashboard header
- grouped session list
- session card
- connection status banner
- empty state / blocked state banner

### Session Detail

Modules:

- trip summary header
- search definition form
- AI inline suggestions
- monitoring controls
- fork recommendation block
- recent outcomes strip

### Pre-Run Review

Modules:

- plain-language search summary
- strategy summary block
- breadth/time expectation block
- policy reminders
- primary action cluster

### Live Run Progress

Modules:

- run status header
- progress metrics strip
- strategy queue panel
- live event stream
- attention / recovery banner
- partial results preview

### Results Overview

Modules:

- results header with run selector
- recommendation cards
- comparison table or dense list
- filter and sort bar
- shortlist tray

### Candidate Detail

Modules:

- candidate summary block
- price and extraction trust block
- itinerary timeline
- risk and booking structure block
- change history summary
- handoff action block

### Monitoring / History

Modules:

- monitoring status header
- run history list
- price movement timeline
- change summaries
- rerun and monitoring action cluster

## Shared UI Components

The implementation should reuse the component rules already defined in the UX docs.

Priority shared components:

- session card
- candidate card
- badge system
- trust block
- summary block
- AI explanation snippet
- recovery banner and recovery panel
- action cluster
- metric strip

## Frontend State Model

Use a small number of clear state domains.

### Session State

Represents:

- session identity
- active search definition
- lifecycle state
- monitoring state
- current best summary

This should be server-backed and loaded per route.

### Run State

Represents:

- current run status
- phase
- active strategy queue
- recent events
- candidate and extraction counts
- recovery status

This should support polling in MVP.

Session state should also carry:

- search intensity
- preferred city pools
- excluded stopover cities

### Candidate State

Represents:

- current run candidates
- filters and sort selection
- shortlist state
- selected compare set

### Settings State

Represents:

- Trip.com connection status
- app defaults
- AI provider config
- artifact retention preferences

### Recommendation

For MVP, prefer:

- server components for read-heavy route loading
- client components for form interactions, polling, compare selection, and local filter state
- polling instead of websockets

## Backend / API Boundary

Even if implemented with server actions or route handlers, define stable application operations.

### Session Operations

- create session
- update session definition
- duplicate session
- archive session
- restore session
- change monitoring state

### Run Operations

- create run from session
- fetch current run state
- fetch run history
- stop run
- resume blocked run after recovery

### Candidate Operations

- list candidates for session and run
- get candidate detail
- shortlist candidate
- unshortlist candidate
- compare candidate set
- trigger re-verification

### Settings / Connection Operations

- get Trip.com connection state
- start Trip.com login flow
- confirm connection recovery
- get app settings
- update app settings

### API Design Rule

All payloads crossing the boundary should use explicit schemas. Do not pass raw automation payloads directly into the UI.

## Automation Interface

The automation layer should expose an application-safe contract instead of leaking Playwright details.

### Core Automation Commands

- initialize browser context
- ensure authenticated Trip.com session
- execute packaged search strategy
- execute stitched search strategy
- deep-verify candidate
- capture artifacts
- pause for recovery
- resume after recovery

### Automation Event Types

The application layer should receive normalized events such as:

- run started
- strategy queued
- strategy started
- strategy completed
- candidate surfaced
- candidate repriced
- candidate unavailable
- verification started
- verification completed
- recovery required
- run completed
- run failed

## Persistence Mapping

The persistence layer should follow the data model spec, with a few implementation notes.

Recovery should be persisted as part of run state rather than treated as transient UI-only state.

### Core Tables Needed For MVP

- `session`
- `session_city_preference`
- `candidate_family`
- `search_run`
- `strategy_execution`
- `itinerary_candidate`
- `candidate_leg`
- `candidate_stopover`
- `verification_attempt`
- `price_observation`
- `session_shortlist_entry`
- `run_artifact`

### Tables That Can Wait

- `ai_strategy_proposal`

This table can be stubbed or deferred if the first implementation uses deterministic strategy expansion only.

## Suggested Source Layout

One pragmatic structure for MVP:

```text
src/
  desktop/
    main/
    preload/
    bootstrap/
  app/
    page.tsx
    sessions/
      new/
      [sessionId]/
        page.tsx
        review/
        runs/[runId]/
        results/
        candidates/[candidateId]/
        compare/
        history/
    settings/
  components/
    sessions/
    candidates/
    progress/
    shared/
  lib/
    db/
    sessions/
    runs/
    candidates/
    monitoring/
    policies/
    automation/
    currency/
    validation/
  workers/
    automation/
  server/
    actions/
    queries/
  styles/
```

Desktop-specific notes:

- `src/desktop/main/` should own Electron main-process startup and window lifecycle
- `src/desktop/preload/` should own any narrowly scoped preload bridges if needed
- `src/desktop/bootstrap/` should own local server and worker process startup helpers
- `src/workers/automation/` should own the Playwright worker entrypoint and worker-facing runtime glue

## Delivery Phases

Implement in a sequence that gets the product usable early.

### Phase 1. App Shell And Session CRUD

Build:

- route shell
- session dashboard
- create/edit session flow
- session grouping and lifecycle actions
- SQLite schema and persistence for sessions

Outcome:

- the user can create and manage trip hunts

### Phase 2. Run Orchestration Skeleton

Build:

- pre-run review
- search run creation
- placeholder run state model
- live progress screen with mock or deterministic events

Outcome:

- the product flow exists end to end without full automation

### Phase 3. Candidate And Results Layer

Build:

- candidate schema
- results overview
- candidate detail
- shortlist behavior
- compare flow

Outcome:

- the UI can display realistic results from stored data

### Phase 4. Trip.com Automation Integration

Build:

- Playwright context management
- Trip.com page-state detection
- one baseline search flow
- candidate extraction
- manual handoff links and safety messaging

Outcome:

- the product performs real searches

Scope note:

- this phase should prove one reliable packaged-search flow first
- stitched search and broader route-shape exploration are intentionally deferred

### Phase 5. Monitoring And Recovery

Build:

- monitoring history
- rerun behavior
- blocked-state takeover and resume
- price observation tracking

Outcome:

- the app becomes useful over time rather than one run at a time

### Phase 6. Advanced Search Expansion

Build:

- stitched search flow
- broader stopover and return-city expansion
- optional authenticated deep verification with explicit manual opt-in and hard safety boundaries
- richer strategy budgeting and candidate-family comparison

Outcome:

- the search engine expands beyond the narrow MVP baseline after the trust loop is proven

### Phase 7. AI Strategy Layer

Build:

- AI strategy proposal generation
- guarded proposal acceptance
- inline explanation enrichment

Outcome:

- the search engine becomes adaptive without destabilizing the product

## Immediate Next Build Artefacts

Before scaffolding the codebase, define these implementation-level artefacts:

1. route and page contract spec
2. database schema draft
3. API and action contract spec
4. automation event schema
5. initial build backlog

These should be the final planning bridge before implementation begins.
