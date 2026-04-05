# Baseline Run Observability

## Context

The first live Trip.com baseline run failed on a hard `waitForURL()` timeout while
transitioning from search submission into results. That failure exposed two
practical gaps:

- the automation worker was too brittle about how Trip.com advances between stages
- the user could not directly watch the automation browser during a run

## Goal

- make baseline runs more tolerant of softer Trip.com transitions
- capture better failure evidence when a run still fails
- let the user opt into a visible automation browser window during live runs

## Scope

Included in this uplift:

- resilient result-stage waiting for the Trip.com baseline worker
- failure-state artifact capture for worker exceptions
- a persisted runtime preference for showing the automation browser
- settings UI to control that preference

Excluded:

- full run replay tooling
- richer live automation telemetry beyond the existing worker snapshot

## Implementation Strategy

1. Replace hard URL-only stage waits with stage-evidence polling.
2. Persist a runtime preference for headful automation runs.
3. Expose that preference in Settings.
4. Capture HTML and screenshot artifacts on failed runs before closing the browser.

## Outcome

Implemented in:

- `src/lib/tripcom/automation-preferences.ts`
- `src/lib/tripcom/automation.ts`
- `src/app/settings/page.tsx`
- `src/app/settings/actions.ts`
- `scripts/automation/run-baseline-search.mjs`

The worker now waits for visible results or clear stage changes instead of relying
only on `waitForURL()`. Failed runs now try to persist failure-state artifacts.
Automation browser visibility is stored locally and can be toggled from Settings.
The worker also clears stale persisted Trip.com city chips before each search and
can click through the `/flights/explore` top-list surface into detailed fare
results when Trip.com chooses that landing page.
