# FlyEasy Shared State Matrix

## Purpose

Define the shared state vocabulary, label rules, and CTA priority logic used across FlyEasy so the product behaves consistently in every screen.

Internal stored values should follow `foundation/canonical-state-model.md`. This document focuses on user-facing labels and CTA behavior.

## Why This Exists

FlyEasy repeatedly communicates:

- session state
- monitoring state
- connection state
- verification freshness
- booking type
- risk
- handoff readiness

If those states drift by screen, the product will feel unreliable and confusing.

## State Matrix Principles

- one meaning should map to one label family
- CTA priority should respond to state, not arbitrary screen context
- labels should be short, factual, and reusable
- stronger language should be reserved for genuinely stronger states

## 1. Session Lifecycle State

### Allowed User-Facing Labels

- `Live`
- `Needs attention`
- `Not live`
- `Completed`
- `Archived`

### Meaning

- `Live`: actively running or monitored
- `Needs attention`: live in intent but blocked or intervention-required
- `Not live`: not currently monitored but still active as a hunt
- `Completed`: hunt fulfilled, still reviewable
- `Archived`: removed from active circulation

### Usage

- session cards
- session header
- monitoring/history

### Do Not Use Instead

- `inactive`
- `closed`
- `action required` as a lifecycle replacement

## 2. Monitoring Operational State

### Allowed Labels

- `Monitoring active`
- `Monitoring idle`
- `Monitoring paused`
- `Monitoring blocked`

### Meaning

- `Monitoring active`: currently running or actively watching
- `Monitoring idle`: live but not running at this exact moment
- `Monitoring paused`: intentionally not live
- `Monitoring blocked`: unable to continue without intervention

### Usage

- session cards
- session detail
- monitoring/history

## 3. Trip.com Connection State

### Allowed Labels

- `Connected`
- `Session expired`
- `Challenge required`
- `Blocked`

### Meaning

- `Connected`: healthy and usable
- `Session expired`: re-authentication needed
- `Challenge required`: user must complete CAPTCHA or verification
- `Blocked`: system cannot proceed safely

### Primary CTA Mapping

- `Connected`: no CTA or optional open settings
- `Session expired`: `Reconnect Trip.com`
- `Challenge required`: `Complete challenge`
- `Blocked`: `Fix connection`

## 4. Candidate Verification Freshness State

### Allowed Labels

- `Verified just now`
- `Verified Xm ago`
- `Verified earlier today`
- `Needs fresh re-check`

### State Mapping

- fresh verified -> `Verified just now` or `Verified Xm ago`
- aging verified -> `Verified earlier today` or similar compact cue
- stale verified -> `Needs fresh re-check`

### CTA Impact

- fresh -> `Open in Trip.com` may remain primary
- aging -> `Open in Trip.com` may remain primary with softer trust
- stale -> `Re-verify` becomes primary

## 5. Candidate Verification Result State

### Allowed Labels

- `Verified`
- `Repriced`
- `Unavailable`
- `Partial verification`
- `Failed`

### Meaning

- `Verified`: stable verified result exists
- `Repriced`: candidate still exists but changed materially
- `Unavailable`: no longer currently bookable
- `Partial verification`: verification did not fully reach the desired trust point
- `Failed`: verification did not produce a usable result

### Usage

- candidate detail
- monitoring/history
- optionally compactly in results list

## 6. Booking Type

### Allowed Labels

- `Single booking`
- `Separate tickets`

### Meaning

- `Single booking`: one protected booking flow
- `Separate tickets`: stitched itinerary with independent booking risk

### Usage

- candidate cards
- candidate detail
- compare view

## 7. Risk Level

### Allowed Labels

- `Low risk`
- `Medium risk`
- `High risk`

### Meaning

- `Low risk`: relatively stable/protected structure
- `Medium risk`: acceptable but with notable tradeoffs
- `High risk`: materially less forgiving itinerary or booking structure

### Usage

- candidate cards
- candidate detail
- compare view

### Rule

- risk label alone is not enough; detail screens must explain the reason

## 8. Handoff Readiness

### Allowed Labels

- `Ready for handoff`
- `Handoff recommended with re-check`
- `Re-verify before handoff`
- `Not available for handoff`

### Meaning

- `Ready for handoff`: fresh verified and safe to act on
- `Handoff recommended with re-check`: aging but still plausible
- `Re-verify before handoff`: stale or uncertain
- `Not available for handoff`: unavailable, failed, or insufficiently verified

### CTA Mapping

- ready -> `Open in Trip.com`
- soft handoff -> `Open in Trip.com` with caution or adjacent `Re-verify`
- re-check required -> `Re-verify`
- not available -> no handoff CTA

## 9. Recovery State

### Allowed Labels

- `Trip.com needs you to log in again`
- `Complete the challenge to continue`
- `Verification blocked`
- `Run paused`

### Usage

- live run progress
- session detail
- session dashboard
- monitoring/history

### Rule

- recovery language should explain the next action, not only the problem

## CTA Priority Matrix

### Session Card

| State | Primary CTA |
|---|---|
| Live healthy | `Open Session` |
| Needs attention | `Resume` |
| Not live | `Open Session` |
| Completed | `Review` |
| Archived | `Restore` |

### Candidate Detail

| Trust State | Primary CTA |
|---|---|
| Fresh verified | `Open in Trip.com` |
| Aging verified | `Open in Trip.com` |
| Stale | `Re-verify` |
| Repriced | `Re-verify` or downgraded handoff |
| Unavailable | no handoff CTA |

### Live Run Progress

| Run State | Primary CTA |
|---|---|
| Running | none beyond `Pause` / `Stop And Review` controls |
| Paused | `Resume` |
| Blocked | recovery action |
| Completed | `Review Results` |

## Screen-Level Label Consistency Rules

- the same state should use the same wording across list, detail, and monitoring surfaces
- if a longer explanation is needed, add supporting text rather than renaming the label
- avoid synonyms that sound similar but mean different things

Example:

- keep `Needs attention` as the session state
- explain the cause in nearby text
- do not rename it to `Blocked` on one screen and `Action required` on another

## Priority Rules For Shared Numeric Surfaces

- verified price outranks displayed price
- verified freshness outranks raw timestamp alone
- state message outranks secondary metadata
- change summary is supplemental, not the primary state indicator

## Current Recommendation

Use this state matrix as the source of truth for:

- badge wording
- status labels
- trust labels
- CTA priority

No screen should invent alternative wording unless the distinction is deliberate and defined here.
