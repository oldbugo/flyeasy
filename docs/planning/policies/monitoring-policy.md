# FlyEasy Monitoring Policy

## Purpose

Define what `live` monitoring means in FlyEasy v1, when monitoring runs, what happens if the app is not active, and how important changes are surfaced.

## Why This Exists

FlyEasy is local-first.

That means monitoring cannot be described like a cloud service unless the product actually behaves that way. The UX and operational behavior must match.

## Monitoring Principles

- Monitoring is a session capability, not a separate product.
- `Live` should mean actively monitored by the local app environment.
- The product should not imply 24/7 cloud monitoring in v1.
- When monitoring is inactive, the session should still preserve history and remain editable.

## Canonical Session Monitoring States

Use these session-level states:

- `live_running`
- `live_idle`
- `needs_attention`
- `not_live`
- `archived`

Meanings:

- `live_running`: a monitoring or interactive run is currently executing
- `live_idle`: monitoring is enabled and eligible to run, but not currently executing
- `needs_attention`: monitoring is blocked pending user help
- `not_live`: monitoring is disabled or intentionally paused
- `archived`: hunt retired from active tracking

## V1 Monitoring Behavior

### When Monitoring Runs

For v1, monitoring should run when:

- the app is open and the local worker is active
- the session is marked live
- FlyEasy has valid Trip.com session state or can recover it

### When Monitoring Does Not Run

For v1, monitoring should not be assumed to run continuously when:

- the app is closed
- the local worker is not running
- the machine is asleep or offline
- the session is paused or archived

### Startup Catch-Up

When FlyEasy reopens:

- live sessions should be recognized immediately
- the app should surface that monitoring was inactive while closed
- the user should be able to trigger or allow a fresh run

Recommended behavior:

- do not pretend continuous checks occurred while the app was unavailable
- do summarize that the session needs a fresh monitoring pass if the app was closed for a meaningful period

## UX Promise

The UI should describe monitoring honestly as:

- active while FlyEasy is live and able to run
- resumable when the app returns
- continuously tracked at the session-history level

Avoid suggesting:

- guaranteed always-on cloud monitoring
- background execution that the product does not actually provide

## Live Vs Not Live

### Live

A session is `live` when:

- monitoring is enabled
- the hunt is still active
- FlyEasy intends to keep checking it when possible

The dashboard may still distinguish:

- currently running
- live but idle
- live but needs attention

### Not Live

A session is `not live` when:

- monitoring is turned off
- the user wants to keep the hunt but not actively watch it
- the hunt is still editable and re-runnable

### Archived

A session is `archived` when:

- the user no longer wants it in active circulation
- monitoring is off
- it is preserved only for historical reference

## Change Surfacing Rules

When monitoring discovers something meaningful, FlyEasy should surface:

- newly cheapest verified option
- meaningful price increase or decrease
- previously strong option now unavailable
- new stopover city pattern worth attention
- session blocked and needing intervention

These are session-level change summaries and should appear on:

- session dashboard cards
- session detail pages
- monitoring history views

## Notifications For V1

For v1, keep notifications simple.

Recommended scope:

- in-app change summaries
- optional desktop notification later if implementation is straightforward

Do not assume email, SMS, or external notification channels in v1.

If desktop notifications are added later, they should only fire for high-signal events:

- new best verified fare
- blocked session requiring intervention

## Monitoring Cadence

The exact cadence does not need to be exposed as a rigid SLA in the UI.

UX should communicate monitoring as:

- periodic checks while FlyEasy is active
- more attention on stronger or changing candidates
- fresher updates when the user is actively working in the session

Avoid UI language like:

- "Checked every 5 minutes"

unless the implementation truly guarantees it.

## Current Recommendation

For v1:

- `live` means the hunt is being actively watched by the local app environment
- monitoring does not promise continuous cloud behavior when the app is closed
- reopened app sessions should clearly show that a fresh pass is needed after downtime
- session grouping should remain `Live hunts`, `Not live`, and `Archived`

This keeps the product honest, understandable, and aligned with the local-first architecture.
