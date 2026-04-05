# API And Server Action Contracts

This document defines the application-facing operations for the FlyEasy MVP.

It is intentionally implementation-agnostic:

- the contracts may be implemented with Next.js server actions
- route handlers may still be used where polling or explicit fetch APIs are cleaner

The purpose is to lock the behavior and payload shapes before code scaffolding begins.

## Contract Design Rules

- All inputs and outputs must use explicit schemas.
- UI code must never consume raw Playwright or raw Trip.com payloads.
- Contracts should be scoped to product concepts: sessions, runs, candidates, settings, recovery.
- Mutations should return enough data to refresh the affected UI surface without forcing a full reload.
- Use stable IDs everywhere.

All stateful payloads should normalize to the values defined in `canonical-state-model.md`.

## Transport Recommendation

For MVP:

- use server actions for create and update mutations triggered from forms
- use route handlers for polling-oriented reads such as live run state, candidate lists, and history data

This gives a pragmatic split:

- actions for write flows
- fetchable endpoints for live and repeatable reads

## Shared Contract Conventions

### Success Shape

Use a consistent success envelope:

```ts
type ActionSuccess<T> = {
  ok: true
  data: T
}
```

### Error Shape

Use a consistent error envelope:

```ts
type ActionError = {
  ok: false
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
  }
}
```

### Mutation Result Rule

Every mutation should return either:

- the updated primary object
- or a compact UI refresh payload containing the updated object plus any immediately affected summaries

## Session Contracts

### `createSession`

Purpose:

- create a new long-lived trip-hunt session

Input:

- `name`
- `originAirport`
- `outboundDestinationCity`
- `returnDestinationAirport`
- `returnOriginMode`
- `returnOriginCity`
- `departureStartDate`
- `departureEndDate`
- `durationMinDays`
- `durationMaxDays`
- `returnStartDate`
- `returnEndDate`
- `layoverScope`
- `maxStops`
- `stopDurationMinDays`
- `stopDurationMaxDays`
- `bookingMode`
- `searchIntensity`
- `cabinPolicy`
- `notes`
- `cityPreferences`

Output:

- `session`
- `dashboardSummary`

Notes:

- validation must enforce duration-window xor return-window rules
- the new session should default to `lifecycle_state = draft`
- `cityPreferences` should support preferred stopover cities, excluded stopover cities, and preferred return-origin cities

### `updateSessionDefinition`

Purpose:

- update the active search definition for an existing session

Input:

- `sessionId`
- session definition fields

Output:

- `session`
- `forkRecommendation`

Notes:

- if the change is an intent-level change, include a fork recommendation object instead of silently splitting state

### `duplicateSession`

Purpose:

- fork an existing session into a new trip hunt

Input:

- `sessionId`
- `nameOverride`

Output:

- `session`

### `archiveSession`

Input:

- `sessionId`

Output:

- `sessionId`
- `lifecycleState`

### `restoreSession`

Input:

- `sessionId`

Output:

- `sessionId`
- `lifecycleState`

### `setSessionMonitoringState`

Purpose:

- enable or disable monitoring for a session

Input:

- `sessionId`
- `monitoringState`

Output:

- `session`
- `monitoringSummary`

Allowed values:

- `enabled`
- `disabled`

## Session Read Contracts

### `getDashboardSessions`

Purpose:

- load the session dashboard groups

Output:

- `liveHunts`
- `notLive`
- `archived`
- `connectionSummary`

Each session summary item should include:

- `id`
- `name`
- `tripSummary`
- `lifecycleState`
- `monitoringState`
- `bestPriceSummary`
- `freshnessSummary`
- `lastChangeSummary`
- `lastUpdatedAt`
- `needsAttention`

### `getSessionDetail`

Purpose:

- load the session detail/search setup screen

Input:

- `sessionId`

Output:

- `session`
- `cityPreferences`
- `recentOutcomeSummary`
- `forkGuidance`

## Run Contracts

### `createRunFromSession`

Purpose:

- start a new search run from the session's current definition

Input:

- `sessionId`
- `runMode`

Output:

- `run`
- `initialProgressState`

Allowed values:

- `interactive`
- `monitoring`

### `stopRun`

Purpose:

- stop an in-progress run

Input:

- `runId`

Output:

- `runId`
- `status`

### `resumeBlockedRun`

Purpose:

- resume a run after user recovery action

Input:

- `runId`

Output:

- `run`
- `progressState`

Notes:

- the returned `run` should expose recovery metadata including `recoveryState`, `recoveryType`, `resumeAvailable`, and `resumeMode` when relevant

## Run Read Contracts

### `getRunProgress`

Purpose:

- polling contract for the live run progress screen

Input:

- `runId`

Output:

- `run`
- `progressHeader`
- `progressMetrics`
- `strategyQueue`
- `recentEvents`
- `partialTopCandidates`
- `recoveryState`

Notes:

- this contract should be optimized for polling and should not include full candidate detail
- `recoveryState` should include normalized fields for `state`, `type`, `reason`, `resumeAvailable`, and `resumeMode`

### `getSessionRunHistory`

Purpose:

- load the monitoring/history view for a session

Input:

- `sessionId`

Output:

- `sessionSummary`
- `runHistory`
- `priceMovementSummary`
- `latestChangeSummaries`

## Candidate Contracts

### `getSessionResults`

Purpose:

- load the results overview for a session and optional run

Input:

- `sessionId`
- `runId?`
- `sort?`
- `bookingType?`
- `verificationStatus?`
- `shortlistOnly?`

Output:

- `sessionSummary`
- `activeRunSummary`
- `recommendations`
- `candidateList`
- `compareSelectionState`
- `filterState`

### `getCandidateDetail`

Purpose:

- load the candidate detail screen

Input:

- `sessionId`
- `candidateId`

Output:

- `candidate`
- `candidateFamily`
- `legs`
- `stopovers`
- `verificationSummary`
- `priceHistorySummary`
- `riskSummary`
- `handoffSummary`
- `shortlistState`

### `setCandidateShortlistState`

Purpose:

- shortlist or dismiss a candidate

Input:

- `sessionId`
- `candidateId`
- `status`
- `userNote?`

Allowed values:

- `shortlisted`
- `top_pick`
- `dismissed`

Output:

- `shortlistEntry`
- `sessionShortlistSummary`

Notes:

- shortlist persistence should attach to the stable `candidateFamilyId` even when the user action originates from a concrete `candidateId`

### `triggerCandidateReverification`

Purpose:

- manually request a fresh verification pass for one candidate

Input:

- `sessionId`
- `candidateId`

Output:

- `verificationRequestAccepted`
- `candidateId`

Notes:

- MVP may implement this as a queued background job rather than an immediate synchronous verification

### `getCompareCandidates`

Purpose:

- load side-by-side candidate comparison

Input:

- `sessionId`
- `candidateIds[]`

Output:

- `sessionSummary`
- `compareItems`
- `sharedComparisonAxes`

Notes:

- cap compare items to a small number in validation, such as `2` or `3`

## Settings And Connection Contracts

### `getSettings`

Output:

- `tripcomConnectionState`
- `appDefaults`
- `artifactRetention`
- `aiProviderSummary`

### `updateSettings`

Input:

- `appDefaults`
- `artifactRetention`
- `aiProviderConfig`

Output:

- `settings`

Notes:

- secrets should be written through a secure storage service, not directly to SQLite
- `tripcomConnectionState` should normalize to `connected`, `session_expired`, `challenge_required`, `blocked`, or `unknown`

### `startTripcomLoginFlow`

Purpose:

- begin or resume the Trip.com login/recovery flow

Input:

- optional `sessionId`
- optional `runId`

Output:

- `connectionState`
- `recoveryInstruction`

Notes:

- when invoked for a blocked run, this should reflect the run's normalized `recoveryType`

### `confirmTripcomRecovery`

Purpose:

- confirm that the user completed the required login or recovery step

Input:

- optional `runId`

Output:

- `connectionState`
- `resumeAvailable`

Notes:

- `connectionState` should normalize to `connected`, `session_expired`, `challenge_required`, `blocked`, or `unknown`
- if `runId` is provided, the underlying run recovery metadata should move from `pending` to either `completed` or a still-blocked state

## Contract Payload Models

These are the key DTO categories the implementation should standardize early.

### Session Summary DTO

Used on:

- dashboard
- session header
- history view

Suggested fields:

- `id`
- `name`
- `tripSummary`
- `lifecycleState`
- `monitoringState`
- `bestPriceSummary`
- `freshnessSummary`
- `lastChangeSummary`
- `lastUpdatedAt`
- `needsAttention`

### Run Progress DTO

Used on:

- live progress polling

Suggested fields:

- `runId`
- `status`
- `phase`
- `currentFocus`
- `bestVerifiedFare`
- `candidatesFound`
- `candidatesVerified`
- `strategyQueueSummary`
- `latestEvent`
- `tripcomSessionState`
- `attentionState`

Notes:

- `status` should use the canonical run states: `queued`, `running`, `blocked`, `paused`, `completed`, `failed`, `cancelled`
- `tripcomSessionState` should normalize to `connected`, `session_expired`, `challenge_required`, `blocked`, or `unknown`

### Candidate Summary DTO

Used on:

- results overview
- shortlist tray
- partial live results

Suggested fields:

- `id`
- `bookingType`
- `routeSummary`
- `stopSummary`
- `displayedPrice`
- `verifiedPrice`
- `verificationStatus`
- `freshnessSummary`
- `riskSummary`
- `isShortlisted`
- `isCurrentBest`

### Candidate Detail DTO

Used on:

- candidate detail
- compare view

Suggested fields:

- `id`
- `bookingType`
- `tripShape`
- `routeSummary`
- `timeline`
- `displayedPrice`
- `verifiedPrice`
- `verificationHistory`
- `riskSummary`
- `handoffSummary`
- `tripcomResumeUrl`

## Error Code Families

Use stable, product-oriented error families.

Examples:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `RUN_NOT_ACTIVE`
- `RECOVERY_REQUIRED`
- `TRIPCOM_NOT_CONNECTED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Do not expose raw automation exception names directly to the UI.

## Suggested File Layout

```text
src/lib/validation/
  session.ts
  run.ts
  candidate.ts
  settings.ts

src/server/actions/
  session.ts
  run.ts
  candidate.ts
  settings.ts

src/app/api/
  runs/[runId]/progress/route.ts
  sessions/[sessionId]/results/route.ts
  sessions/[sessionId]/history/route.ts
  sessions/[sessionId]/compare/route.ts
```

## Immediate Next Step

After these contracts, define the automation event schema so live progress, recovery, and result updates all share one normalized event vocabulary.
