# FlyEasy Runtime Architecture

## Purpose

Define the concrete local runtime shape for the FlyEasy MVP so implementation can proceed without ambiguity about packaging, process boundaries, storage, or secret handling.

## Recommendation

For MVP, FlyEasy should be built as a desktop-first local application with:

- an `Electron` shell
- a packaged local `Next.js` server process
- a local Node-based application layer hosted inside that server process
- a sibling-process Playwright automation worker
- a local SQLite database file
- OS-backed secure storage for secrets

This is the most pragmatic shape for a product that depends on:

- long-lived browser automation
- local file and database access
- persistent authenticated browser state
- secure credential storage
- honest local-first monitoring behavior

## Why This Over A Browser-Only App

A browser-only local web app leaves too many MVP-critical concerns underspecified:

- how the local worker starts and survives navigation
- how Playwright lifecycle is managed
- how secure local secrets are stored
- how desktop recovery flows share the same browser context
- how the product is packaged into a repeatable end-user install

## Runtime Shape

### 1. Desktop Shell

Electron should own:

- application startup
- window lifecycle
- local menu / app controls
- bootstrapping the local UI runtime
- wiring secure IPC between UI and backend services

### 2. UI Runtime

Next.js should still be used for:

- route structure
- React UI
- server-side data loading patterns where helpful
- shared TypeScript validation and DTO definitions

In packaged desktop mode, the UI should be treated as local application UI, not as a networked multi-user web deployment.

Recommended MVP hosting model:

- Electron main starts a packaged local Next.js standalone server on app launch
- the Electron renderer opens the loopback local URL served by that process
- App Router, server actions, and route handlers run inside that local server process

This is the concrete way to preserve the current Next.js-first implementation model inside a desktop package.

### 3. Application Layer

The application layer should run locally in the same Node process as the packaged Next.js server and own:

- session and run orchestration
- database access
- policy enforcement
- validation
- action and query contracts
- automation task submission

### 4. Automation Worker

The automation worker should be isolated enough that browser automation failures do not corrupt UI state.

For MVP, use a sibling worker process managed by the desktop shell.

Reason:

- it keeps Playwright crashes and hangs out of the local UI/server process
- it gives recovery and restart behavior a cleaner boundary
- it matches the product's long-running automation requirements better than an in-process worker

### 5. Browser State

Playwright should use a persistent local browser profile directory managed by the app.

This should store:

- cookies
- browser session state
- Trip.com local preferences

This should not be stored in SQLite.

### 6. Database

SQLite should live in an app-controlled per-user data directory.

The app should own:

- migration execution on startup
- backup or reset utilities later
- artifact path management relative to app data storage

### 7. Secret Storage

Secrets should use OS-backed secure storage, such as:

- Windows Credential Manager
- macOS Keychain
- Linux Secret Service where supported

Secrets should include:

- Trip.com credentials if stored
- AI provider API keys
- any durable auth material that should not live in SQLite

## Process Boundary Recommendation

For MVP, use three clear boundaries:

### Boundary A. UI

Responsible for:

- rendering views
- collecting user input
- polling and displaying run state

### Boundary B. Local App Service

Responsible for:

- business logic
- persistence
- validation
- policy decisions
- mapping automation outcomes into app state

### Boundary C. Automation Worker

Responsible for:

- Playwright lifecycle
- Trip.com interaction
- normalized automation outputs

The UI should never talk to Playwright directly.

## IPC Recommendation

Use a narrow typed IPC boundary between Electron and the local app service.

Rules:

- the Electron renderer should use the local Next.js routes and actions as its normal app interface
- Electron main should manage process startup and privileged OS integrations
- the local Next.js server should talk to the automation worker through a typed internal IPC or RPC boundary
- automation internals never cross directly into renderer state
- long-running run progress should be exposed through polling-friendly query contracts first
- event streaming can be added later if needed

## Development Mode

During development, it is acceptable to run:

- Next.js dev server
- Electron shell
- local automation worker

as separate local processes.

The contracts should still mirror packaged behavior so dev mode does not invent a different architecture.

## Packaging Implications

This runtime choice means the implementation should plan for:

- desktop packaging and installer creation
- app-data directory conventions
- Playwright browser asset installation
- migration execution on packaged startup
- crash-safe restart behavior for blocked or paused runs

## What To Avoid In MVP

- browser-only deployment as the primary runtime target
- cloud worker assumptions
- hidden background monitoring behavior the desktop app cannot actually provide
- direct renderer access to filesystem or automation internals

## Current Recommendation

Lock the MVP runtime as:

- Electron desktop shell
- packaged local Next.js server
- local Node application layer hosted in that server process
- sibling local Playwright automation worker
- SQLite in app data
- OS keychain-backed secret storage

This removes a major planning ambiguity and matches the product's true operational needs.
