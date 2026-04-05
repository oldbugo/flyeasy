# Single-Worker Live Automation Queue

## Status

- `Complete`

## Goal

Prevent concurrent live Trip.com workers from running at the same time.

The worker currently relies on:

- one shared persistent Playwright profile
- one shared automation worker state file
- one shared Trip.com connection state file

That makes detached worker fan-out unsafe. The immediate uplift is therefore to
queue live runs instead of trying to execute them concurrently.

## What Changed

### Queue dispatcher

A new live-run dispatcher now sits between run creation and worker launch.

The dispatcher:

- claims one queued live run at a time
- uses a filesystem lock to avoid double-dispatch
- refuses to start a new live run while another live run is `running` or
  `blocked`
- launches the next queued run only after the active worker exits cleanly

### Launch behavior

`Start baseline run` no longer spawns every live worker immediately.

Instead:

- runs are created in `queued` state
- the dispatcher starts the oldest eligible live run
- later runs wait in the queue until the active worker completes, fails, or is
  cancelled

### Experiment suites

Baseline experiment suites are still grouped as one experiment family, but the
individual arms now run through the same single-worker queue.

This preserves auditability without violating the shared-browser constraint of
the current worker architecture.

### Resume guard

Blocked-run resume now also goes through the dispatcher path so it cannot start
alongside another live worker.

## Files

- `scripts/automation/dispatch-run-queue.mjs`
- `scripts/automation/run-baseline-search.mjs`
- `src/lib/tripcom/automation.ts`
- `src/app/sessions/actions.ts`
- `src/components/sessions/session-strategy-form.tsx`
- `src/components/insights/baseline-experiment-board.tsx`

## Impact

This does not make the live worker faster, but it does make the system safer
and more predictable:

- one live worker owns the Trip.com browser profile at a time
- queued runs no longer compete for the same browser session
- baseline experiment suites still work, but now execute sequentially
- the app now reflects the real execution model more honestly

## Verification

Verified with:

- `node --check D:\\flyeasy\\scripts\\automation\\dispatch-run-queue.mjs`
- `node --check D:\\flyeasy\\scripts\\automation\\run-baseline-search.mjs`
- `npm run typecheck`
- `npm run lint`
