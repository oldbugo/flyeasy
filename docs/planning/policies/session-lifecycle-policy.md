# FlyEasy Session Lifecycle Policy

## Purpose

Define how sessions move between live, not-live, completed, and archived states so the dashboard grouping and session management behavior remain consistent.

## Why This Exists

FlyEasy now uses long-lived sessions as the primary product object.

That means the product needs explicit rules for:

- when a hunt is active
- when it is merely paused or inactive
- when it is considered finished
- when it moves into archive

## Core Principle

A session can stop being operationally active without losing its historical value.

So the lifecycle must separate:

- whether the hunt is currently being watched
- whether the hunt is still relevant
- whether the hunt should stay in active circulation

## Canonical Session States

Use these user-facing group states:

- `Live hunts`
- `Not live`
- `Archived`

Use these operational/internal states:

- `draft`
- `live_running`
- `live_idle`
- `needs_attention`
- `not_live`
- `completed`
- `archived`

## State Meanings

### Draft

- session exists but has not yet produced a meaningful run

### Live Running

- a run is actively executing for this session

### Live Idle

- session is live and monitored, but nothing is executing right now

### Needs Attention

- session is live in intent, but blocked on intervention

### Not Live

- session remains relevant and editable, but is not currently monitored

### Completed

- the user has effectively finished the hunt for its original purpose
- results remain meaningful and should stay easy to revisit for a short period

### Archived

- session is retired from active circulation and only kept for reference

## User-Facing Group Mapping

### Live Hunts

Contains:

- `live_running`
- `live_idle`
- `needs_attention`

### Not Live

Contains:

- `draft`
- `not_live`
- `completed`

Reason:

- completed hunts may still be useful to review without being fully archived

### Archived

Contains:

- `archived`

## Completion Rules

Completion should be a lightweight, user-driven state rather than a hard system determination.

A session may be marked completed when:

- the user found a satisfactory option
- the trip was effectively booked
- the user no longer wants active monitoring but still wants the hunt visible for a while

FlyEasy should not auto-complete a session just because:

- no recent runs occurred
- monitoring was turned off
- a good candidate was found

## Archiving Rules

Archiving should generally be explicit.

Recommended behavior:

- user manually archives a completed or abandoned hunt
- archived hunts are removed from primary active scanning
- archived hunts preserve history, shortlisted items, and outcomes

FlyEasy may suggest archiving when:

- a session has been completed and inactive for a while
- the user has many stale not-live sessions

But the product should not auto-archive aggressively in v1.

## Restore Rules

The user should be able to:

- restore an archived session back to `not_live`
- reactivate a not-live session into `live`
- reopen a completed session and continue evolving it if needed

This keeps the model forgiving and consistent with long-lived trip hunts.

## Monitoring Interaction

Turning monitoring off should:

- move a live session to `not_live`
- not imply completion

Turning monitoring on should:

- move a not-live session to `live_idle` or `live_running`
- not create a new session

## Dashboard Sorting Guidance

Within `Live hunts`:

1. `needs_attention`
2. `live_running`
3. `live_idle`

Within `Not live`:

1. `completed`
2. `not_live`
3. `draft`

Within `Archived`:

- most recently archived first

## UX Language Guidance

Use:

- `Live`
- `Not live`
- `Completed`
- `Archived`

Avoid:

- `inactive` as the main label if it is ambiguous
- `closed` if the session may later be resumed

## Current Recommendation

For v1:

- keep dashboard grouping simple: `Live hunts`, `Not live`, `Archived`
- treat `completed` as a useful not-live state, not immediate archive
- require explicit archive in most cases
- always preserve history and session continuity across lifecycle changes

This makes session management clear without turning the product into an over-structured workflow tool.
