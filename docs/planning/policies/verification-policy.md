# FlyEasy Verification Policy

## Purpose

Define how FlyEasy evaluates freshness, when candidates become stale, when re-verification should happen, and what confidence level is required before handing a user off to Trip.com.

## Why This Exists

FlyEasy ranks by verified price, not just displayed search price.

That means the product needs explicit policy for:

- when a verification is fresh enough to trust
- when a candidate should be rechecked
- when a handoff to Trip.com is still safe to recommend

Without this, the UI cannot communicate confidence honestly.

## Core Principles

- Verified price is authoritative over displayed result-list price.
- Freshness is time-sensitive and context-sensitive.
- Handoff confidence should be stricter than comparison confidence.
- Re-verification should focus on candidates that matter, not on every candidate all the time.

## Verification States

Every candidate should map to one of these states for UX purposes:

- `not_checked`
- `fresh_verified`
- `aging_verified`
- `stale_verified`
- `repriced`
- `unavailable`
- `partial`
- `failed`

## Freshness Windows

Use these default windows for v1:

### Fresh Verified

- verified within the last 30 minutes

UX meaning:

- safe to compare
- safe to recommend strongly
- safe for handoff if no newer conflicting signal exists

### Aging Verified

- verified more than 30 minutes ago and up to 4 hours ago

UX meaning:

- still valid for comparison
- still visible as recommended
- handoff should suggest a quick re-check if this is the chosen candidate

### Stale Verified

- verified more than 4 hours ago

UX meaning:

- still useful as historical evidence
- should not be strongly recommended without a new verification
- handoff should require re-verification first

These thresholds are deliberately conservative because Trip.com availability and price can change quickly.

## Triggered Re-Verification Rules

Re-verification should happen automatically when:

- a candidate becomes the current best option in an active session
- a previously verified candidate shows a meaningful price delta in fresh search results
- the user opens a stale candidate with intent to compare seriously
- the user clicks `Open in Trip.com` on an aging or stale candidate
- a monitored session finds a candidate that appears better than the current best verified candidate

Re-verification should be available manually when:

- the user is inspecting any candidate detail view
- the user wants to refresh a shortlist candidate

## Handoff Confidence Rules

The handoff bar should be stricter than the comparison bar.

### Allowed Strong Handoff

Candidate may be handed off with a confident CTA when:

- verification state is `fresh_verified`
- candidate is not marked unavailable or repriced after the last verification
- no blocking risk state is present

### Allowed Soft Handoff

Candidate may still be handed off with caution when:

- verification state is `aging_verified`
- the UI clearly states that a quick re-check is recommended

### Blocked Handoff

Candidate should not receive a primary handoff CTA when:

- verification state is `stale_verified`
- latest state is `unavailable`
- latest state is `failed`
- verification is only partial and final payable amount is uncertain

In those cases, the primary action should become `Re-verify`.

## Meaningful Price Delta

For v1, define a meaningful delta as:

- absolute price change greater than or equal to AUD 20
- or relative change greater than or equal to 3%

This threshold is used to decide when a previously strong candidate should be refreshed automatically.

## Session-Level Recommendation Rules

In list and dashboard contexts:

- `fresh_verified` candidates can appear as primary recommendations
- `aging_verified` candidates can remain recommended, but should show softer freshness language
- `stale_verified` candidates should drop below fresh or aging options unless no better option exists
- `repriced` candidates remain visible but lose primary recommendation status
- `unavailable` candidates move to history or lower-priority contexts

## Shortlist Interaction Rules

If a shortlisted candidate becomes stale:

- keep it on the shortlist
- visibly downgrade freshness
- surface a `Re-verify` action

If a shortlisted candidate becomes unavailable:

- keep it in shortlist history
- mark it unavailable
- encourage the user to review alternatives

## Monitoring Rules

Monitoring should not deep-verify every candidate every cycle.

Default priorities:

1. current best candidate
2. newly improved candidate
3. shortlisted candidates
4. previously strong candidate with meaningful delta

This keeps monitoring efficient while preserving trust.

## UI Language Guidance

Use plain language rather than only raw timestamps.

Examples:

- `Verified just now`
- `Verified 18 minutes ago`
- `Verified earlier today`
- `Needs fresh re-check`

Avoid presenting freshness as only a timestamp with no interpretation.

## Data Requirements

The application should persist:

- latest verification timestamp
- latest verification state
- last verified total
- prior verified total for delta comparison
- whether handoff is currently strong, soft, or blocked

The handoff confidence level may be derived rather than stored directly if the rules remain simple.

## Current Recommendation

Use a three-tier freshness model for verified candidates:

- fresh: under 30 minutes
- aging: 30 minutes to 4 hours
- stale: over 4 hours

Require re-verification for stale candidates before primary Trip.com handoff, and automatically prioritize re-checks for candidates that are best, shortlisted, or materially changed.
