# Automation Architecture

This document defines the role of automation inside the FlyEasy MVP and how it should interact with the rest of the app.

It sits between the higher-level automation behavior spec and the lower-level event schema.

## Purpose

Automation should be treated as a bounded execution engine.

It exists to:

- operate Trip.com through the browser
- return normalized search and verification outcomes
- pause cleanly when human intervention is required

It should not:

- own product state
- invent business rules
- shape raw browser details into UI copy
- act like an unbounded autonomous agent

## Role In The System

FlyEasy should be split into three functional layers:

### 1. UI And Product Layer

Responsible for:

- sessions
- search setup
- live progress
- results
- monitoring
- recovery guidance

### 2. Application And Orchestration Layer

Responsible for:

- validating session input
- selecting strategies
- scheduling run work
- deciding what needs deep verification
- applying monitoring, lifecycle, verification, and currency policies
- translating automation events into app state

### 3. Automation Layer

Responsible for:

- browser context management
- Trip.com session detection
- Trip.com page interaction
- packaged search execution
- stitched search execution
- candidate extraction
- deep verification
- artifact capture
- clean pause and resume behavior

## Core Design Principle

Automation is execution, not orchestration.

That means:

- the app decides what task to run
- automation executes the task
- automation emits normalized events and results
- the app decides how those outcomes affect sessions, runs, candidates, and UI state

## Execution Model

The MVP should use a local worker-style execution model inside the application.

Recommended model:

- one local automation service process or module
- one persistent Playwright browser context
- one active Trip.com session state source
- one run executor that processes strategy tasks serially in MVP

This keeps implementation simpler and reduces race conditions early on.

## Why Serial Execution First

Serial strategy execution is the right MVP default because:

- Trip.com automation will be fragile early on
- session and recovery state will be easier to reason about
- event ordering stays predictable
- rate limiting and anti-bot risk are easier to control

Parallel automation can be considered later, but it should not be a v1 assumption.

## Main Automation Responsibilities

### Browser Context Management

Automation must:

- initialize a persistent Playwright context
- reuse it across runs where safe
- restore saved browser state when possible
- expose whether the context is ready, expired, blocked, or needs login

### Session Detection

Automation must:

- detect whether Trip.com is authenticated
- detect expiry before or during a run
- classify blocked states such as login prompt, challenge, or unexpected flow break

### Search Execution

Automation must support:

- packaged search flow
- stitched search flow
- candidate extraction from result pages
- strategy-specific execution boundaries

### Deep Verification

Automation must:

- push shortlisted candidates to the latest safe checkout step
- record final visible payable amount
- detect repricing and unavailability
- stop before any irreversible purchase action

### Recovery Pause And Resume

Automation must:

- pause when user intervention is required
- emit a normalized recovery-required signal
- preserve enough state to resume the run where possible

### Artifact Capture

Automation must capture:

- screenshots where useful
- traces when enabled or when failures occur
- structured raw payload snapshots when extraction fails or verification diverges

## Task Types

The application layer should submit bounded tasks to automation.

Recommended task types:

- `ensure_tripcom_session`
- `execute_packaged_strategy`
- `execute_stitched_strategy`
- `verify_candidate`
- `resume_after_recovery`

Each task should have:

- a stable task id
- a parent run id
- a clear input payload
- a normalized success/failure shape

## Input Boundary

Automation should receive structured task payloads only.

Examples:

- normalized search strategy payload
- candidate verification payload
- recovery resume context

It should not receive raw form data or UI-specific state.

## Output Boundary

Automation should emit:

- normalized lifecycle events
- normalized candidate and verification data
- structured failure and recovery signals
- artifact metadata

Any lower-level automation session classifications should be normalized into the app-facing connection and recovery states from `canonical-state-model.md` before leaving the automation boundary.

It should not emit:

- raw selector names as product errors
- UI copy
- unbounded debugging logs as part of the app contract

## Failure Handling Model

Automation failures should be classified into product-safe categories.

At minimum:

- authentication required
- recovery required
- parsing failed
- page shape changed
- candidate unavailable
- candidate repriced
- rate limited
- unknown automation failure

The application layer should map those to UI states and user-facing guidance.

## State Boundaries

Automation may keep transient execution state in memory, such as:

- current page position
- current strategy execution step
- temporary extracted result sets

But durable state belongs elsewhere:

- sessions and runs in SQLite
- secrets in secure local storage
- traces and screenshots on disk

## Resumability Model

The automation system should support resumability at two levels:

### 1. Run-Level Resume

If a run pauses because login or recovery is required, the app should be able to resume that run without creating a new session or losing run context.

### 2. Browser-Level Reuse

If Trip.com remains authenticated, later runs should reuse the existing browser context where safe.

## MVP Simplifications

The MVP should deliberately avoid:

- multi-browser pools
- distributed workers
- concurrent strategy execution
- fully autonomous AI click-navigation
- cloud scheduling

These would add complexity before the product trust layer is proven.

## Recommended Source Layout

```text
src/lib/automation/
  client.ts
  service.ts
  session.ts
  packaged-search.ts
  stitched-search.ts
  verify-candidate.ts
  events.ts
  recovery.ts
  artifacts.ts
  types.ts
```

## Integration Contract

The application layer should treat automation as an internal service with a stable contract.

That contract should support:

- submit task
- observe normalized events
- persist terminal outcomes
- query current connection state
- resume after recovery

## Delivery Sequence

Build the automation layer in this order:

1. browser context initialization
2. Trip.com session detection
3. one baseline packaged search flow
4. candidate extraction
5. candidate deep verification
6. recovery pause and resume
7. stitched strategy execution

## Immediate Next Step

Define the automation event schema so all automation outcomes share one normalized vocabulary before implementation begins.
