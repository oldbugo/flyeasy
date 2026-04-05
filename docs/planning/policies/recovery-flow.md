# FlyEasy Recovery Flow

## Purpose

Define how FlyEasy handles automation interruptions that require human intervention, especially Trip.com session expiry, CAPTCHA, challenge, or ambiguous checkout states.

## Why This Exists

Blocked states are normal for this product, not edge cases.

The recovery flow must therefore feel designed, understandable, and resumable rather than like a generic failure screen.

## Recovery Principles

- Preserve user context whenever automation is blocked.
- Explain the cause in product language.
- Tell the user exactly what to do next.
- Resume the interrupted hunt where feasible instead of forcing a full restart.
- Distinguish between recoverable block, terminal failure, and user-cancelled interruption.

## Recovery Categories

### 1. Session Expired

Meaning:

- Trip.com login/session is no longer valid

Expected user action:

- re-authenticate

Preferred resume behavior:

- restore the affected session
- retry the interrupted run from the nearest safe point

### 2. Challenge Required

Meaning:

- CAPTCHA, device verification, or unusual login challenge is required

Expected user action:

- complete the challenge directly in the browser context FlyEasy is using

Preferred resume behavior:

- keep the run paused
- detect successful completion
- continue without discarding the run

### 3. Verification Blocked

Meaning:

- the automation reached a page shape or handoff state it could not safely classify

Expected user action:

- inspect and optionally trigger re-verification later

Preferred resume behavior:

- keep the candidate visible
- mark verification as blocked or partial
- do not automatically push through ambiguous purchase-adjacent states

### 4. App Or Worker Interrupted

Meaning:

- the app was closed, crashed, or the automation worker stopped

Expected user action:

- reopen FlyEasy
- resume if desired

Preferred resume behavior:

- preserve the session and run record
- restart from a safe re-entry point rather than pretending the run completed

## Recovery Entry Points

The user should be able to encounter recovery in three places:

### Inline During Active Run

Best for:

- session expiry
- challenge required
- blocked verification

UX form:

- inline banner or recovery panel in the live progress view

### Session Dashboard

Best for:

- previously blocked live hunts
- paused sessions needing intervention

UX form:

- needs-attention session card state

### Settings

Best for:

- reconnecting Trip.com manually
- reviewing stored connection state
- fixing a persistent credential problem

UX form:

- `Trip.com Connection` settings screen

## Recovery Flow Structure

Every recovery flow should provide:

1. what happened
2. what FlyEasy was doing
3. what the user needs to do
4. what will happen after they do it
5. the primary recovery action

## Recommended UX Pattern

### Step 1. Pause And Preserve

When a block happens:

- pause the affected run
- preserve run progress and candidate outcomes found so far
- mark the session as `needs_attention`

### Step 2. Explain The Block

Show:

- simple cause label
- plain-language explanation
- whether the issue affects the whole session or only one run branch

Example:

- "Trip.com needs you to log in again before FlyEasy can continue checking fares."

### Step 3. Present Recovery Action

Primary actions should be concrete:

- `Reconnect Trip.com`
- `Complete challenge`
- `Resume verification`
- `Retry later`

### Step 4. Confirm Resume State

After successful intervention:

- show whether FlyEasy is resuming the current run
- show whether it is restarting only the affected verification step
- avoid silent full resets when possible

## Browser Recovery Model

For v1, FlyEasy should use the same automation browser context for challenge resolution when possible.

Reason:

- preserves session continuity
- reduces confusion
- makes resume more reliable

That means:

- the user may need to complete the challenge inside the browser window FlyEasy controls
- the product should explain this explicitly

## Resume Rules

### Resume Current Run

Allowed when:

- session was restored successfully
- challenge completed in the same browser context
- blocked step is still safe to continue

### Partial Restart

Allowed when:

- current page state is no longer reliable
- search form or verification path must be replayed safely

### Full New Run

Use only when:

- original run context is unrecoverable
- browser state was lost
- a safe continuation point cannot be established

If FlyEasy must start a new run, the UI should say so explicitly.

## Copy Guidance

Good copy:

- "FlyEasy paused this hunt because Trip.com needs your help."
- "Complete the challenge in the browser window, then return here to resume."
- "Verification stopped because the checkout page changed unexpectedly. This candidate remains visible, but needs a fresh re-check."

Avoid:

- "Unknown error"
- "Automation failed"
- "Please try again later"

unless that is truly the only honest message.

## Data And State Requirements

The product should persist:

- recovery reason
- affected session id
- affected run id
- whether recovery is pending, completed, or abandoned
- whether resume used same run, partial restart, or full new run

For MVP, store this on the run record plus supporting event history.

Recommended run-level fields:

- `recovery_state`
- `recovery_type`
- `recovery_reason`
- `blocked_at`
- `resume_available`
- `resume_mode`
- `resume_checkpoint_json`
- `recovery_completed_at`

## Current Recommendation

Treat recovery as a first-class UX flow with:

- in-context interruption
- plain-language explanation
- same-browser challenge completion where possible
- explicit resume semantics
- preserved session continuity

This is critical to making FlyEasy feel dependable despite browser automation volatility.
