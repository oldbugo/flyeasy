# Automation Event Schema

This document defines the normalized event vocabulary emitted by the FlyEasy automation layer.

Its purpose is to make live progress, recovery, candidate updates, and verification updates consistent across the app.

## Purpose

The automation layer should not stream arbitrary logs into the product.

It should emit a bounded set of normalized events that the application layer can:

- persist
- aggregate
- translate into UI state
- use for run progress polling

App-facing normalized states in this document should follow `canonical-state-model.md`.

## Event Design Rules

- Every event must belong to a known event type.
- Every event must carry stable IDs for correlation.
- Events should be product-safe, not Playwright-specific.
- Events should be append-only from the perspective of the event stream.
- The application layer, not the automation layer, decides how to summarize events for the UI.

## Event Envelope

All automation events should use one shared envelope.

Suggested shape:

```ts
type AutomationEvent = {
  id: string
  runId: string
  sessionId: string
  taskId: string
  strategyExecutionId?: string
  candidateId?: string
  verificationAttemptId?: string
  type: AutomationEventType
  occurredAt: string
  payload: Record<string, unknown>
}
```

## Correlation Rules

- `runId` is always required
- `sessionId` is always required
- `taskId` is always required
- `strategyExecutionId` is required for strategy execution events
- `candidateId` is required for candidate-related events
- `verificationAttemptId` is required for verification-related events

## Event Type Families

The event model should be grouped into six families:

1. run lifecycle
2. strategy lifecycle
3. candidate discovery
4. verification lifecycle
5. recovery and connection
6. artifact and diagnostics

## 1. Run Lifecycle Events

### `run.started`

Emitted when automation begins executing work for a run.

Payload:

- `runMode`
- `triggerSource`

### `run.completed`

Emitted when automation has finished all planned work for the run.

Payload:

- `status`
- `totalStrategiesExecuted`
- `totalCandidatesFound`
- `totalCandidatesVerified`
- `bestCandidateId?`

### `run.failed`

Emitted when the run ends in a terminal failure.

Payload:

- `failureCode`
- `failureDetail?`

### `run.cancelled`

Emitted when the run is intentionally stopped.

Payload:

- `reason?`

## 2. Strategy Lifecycle Events

### `strategy.queued`

Payload:

- `strategyType`
- `sourceType`
- `priority`
- `reason`

### `strategy.started`

Payload:

- `strategyType`
- `sourceType`
- `priority`
- `reason`

### `strategy.completed`

Payload:

- `strategyType`
- `status`
- `candidateCount`
- `verifiedCandidateCount`
- `bestCandidateId?`

### `strategy.failed`

Payload:

- `strategyType`
- `failureCode`
- `failureDetail?`

### `strategy.skipped`

Payload:

- `strategyType`
- `reason`

## 3. Candidate Discovery Events

### `candidate.surfaced`

Emitted when a candidate is newly discovered and persisted.

Payload:

- `candidateId`
- `bookingType`
- `displayedDisplayCurrency`
- `displayedDisplayAmount`
- `stopCount`
- `intentionalStopCount`
- `outboundDestinationCity`
- `returnOriginCity?`

### `candidate.updated`

Emitted when a persisted candidate receives a meaningful update outside verification completion.

Payload:

- `candidateId`
- `changeKinds[]`

Examples of `changeKinds`:

- `ranking_changed`
- `best_flag_changed`
- `resume_url_added`

### `candidate.current_best_changed`

Emitted when the best candidate for the run changes.

Payload:

- `candidateId`
- `previousCandidateId?`
- `reason`

## 4. Verification Lifecycle Events

### `verification.started`

Payload:

- `candidateId`
- `verificationAttemptId`

### `verification.completed`

Payload:

- `candidateId`
- `verificationAttemptId`
- `status`
- `displayCurrency?`
- `displayAmount?`
- `sourceCurrency?`
- `sourceAmount?`
- `checkoutStepReached?`

Allowed `status` values:

- `verified`
- `repriced`
- `unavailable`
- `partial`

### `verification.failed`

Payload:

- `candidateId`
- `verificationAttemptId`
- `failureCode`
- `failureDetail?`

## 5. Recovery And Connection Events

### `connection.session_checked`

Payload:

- `state`

Allowed `state` values:

- `connected`
- `session_expired`
- `challenge_required`
- `blocked`
- `unknown`

### `recovery.required`

Emitted when automation cannot continue without the user.

Payload:

- `recoveryType`
- `reason`
- `resumeAvailable`

Allowed `recoveryType` values:

- `login_required`
- `challenge_required`
- `verification_blocked`
- `app_interrupted`

### `recovery.resumed`

Payload:

- `recoveryType`
- `success`

## 6. Artifact And Diagnostics Events

### `artifact.created`

Payload:

- `artifactType`
- `artifactId`
- `filePath`

Allowed `artifactType` values:

- `screenshot`
- `html_snapshot`
- `playwright_trace`
- `json_export`

### `diagnostic.notice`

Use sparingly for structured non-terminal diagnostic conditions.

Payload:

- `code`
- `message`

Examples:

- `results_page_shape_changed`
- `candidate_parse_partial`
- `verification_step_slow`

## Failure Code Guidelines

Failure codes should be normalized and finite.

Recommended families:

- `AUTH_REQUIRED`
- `RECOVERY_REQUIRED`
- `PAGE_SHAPE_CHANGED`
- `PARSING_FAILED`
- `RATE_LIMITED`
- `CANDIDATE_UNAVAILABLE`
- `PRICE_REPRICED`
- `UNKNOWN_AUTOMATION_FAILURE`

Do not emit raw selector strings or stack traces in event payloads intended for product use.

## Event Ordering Rules

- Events must be written in occurrence order for a task.
- A run should emit `run.started` before any strategy events.
- A strategy should emit `strategy.started` before candidate or verification events linked to it.
- A verification should emit `verification.started` before `verification.completed` or `verification.failed`.
- A terminal run event should be last for the run.

## Persistence Recommendation

For MVP, it is acceptable not to create a dedicated `automation_event` table if:

- the app derives live progress from run, strategy, verification, and artifact tables
- recent events can be synthesized from persisted state transitions

If a dedicated event store is added later, it should persist this normalized schema rather than raw logs.

## UI Mapping Guidance

The application layer should map normalized events into:

- run progress metrics
- recent event summaries
- recovery banners
- candidate freshness and verification updates
- monitoring change summaries

Examples:

- `strategy.started` -> "Testing one-stop routes through Shanghai"
- `verification.completed` with `repriced` -> "A shortlisted option repriced during final verification"
- `recovery.required` with `login_required` -> "Trip.com needs you to sign in again before this run can continue"

The event itself should stay structured; UI phrasing belongs outside the automation layer.

## Suggested Type Modules

```text
src/lib/automation/
  events.ts
  event-types.ts
  event-payloads.ts
```

## Immediate Next Step

With the automation architecture and event schema defined, the planning set is ready for either:

1. a route and page contract spec
2. the initial implementation backlog
3. actual schema and app scaffolding
