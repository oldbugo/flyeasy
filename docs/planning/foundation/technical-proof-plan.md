# FlyEasy Technical Proof Plan

## Purpose

Define the minimum technical proofs that should be completed before the project commits heavily to the full MVP implementation.

These proofs reduce the biggest delivery risk: third-party browser automation volatility.

## Why This Exists

The planning set is already strong on product and UX structure.

The main uncertainty is not whether the product concept is coherent. The main uncertainty is whether Trip.com automation can be made reliable enough to justify the rest of the build.

## Proof Goals

Before broad implementation investment, validate these MVP-critical questions:

1. can FlyEasy maintain a usable Trip.com browser context for public packaged-search flows
2. can it extract normalized packaged-search results from Trip.com consistently enough to power the UI
3. can it recover from interruption and resume cleanly enough to preserve user trust

An optional exploratory proof may also be run to understand whether a safe deep-verification boundary exists for a later post-MVP phase.

## Proof 1. Browser Context Handling And Recovery

Question:

- can the app maintain a reusable Trip.com browser context often enough to make public packaged-search automation practical

What to validate:

- persistent Playwright browser context works across restarts
- session probe can distinguish connected, expired, challenge-required, and unknown states
- interruption recovery can be resumed without losing the browser context

Success bar:

- a previously used browser context is reused successfully in repeated local test runs
- blocked or expired-state detection is reliable enough to classify recovery cleanly

## Proof 2. Packaged Search Extraction

Question:

- can the automation extract enough structured data from Trip.com packaged search results to power candidate cards and detail views

What to validate:

- route endpoints can be extracted
- displayed price can be extracted
- stop count and visible stopover details can be extracted
- timing markers can be extracted
- parse failures can be detected and bounded

Success bar:

- one baseline Melbourne to Guangzhou packaged search yields a usable normalized candidate set
- extracted results are sufficient for ranking, display, and manual handoff

## Proof 3. Recovery And Resume

Question:

- can a blocked run pause and resume in a way that is understandable and technically stable

What to validate:

- blocked state is persisted on the run
- challenge or page-state recovery can be completed in the same browser context when possible
- the run resumes either in place or through an explicit partial restart
- partial results remain visible after interruption

Success bar:

- the app can demonstrate one full blocked-to-resumed run path without losing the session story

## Optional Exploratory Proof. Safe Deep Verification Boundary

Question:

- is there a safe enough authenticated verification boundary worth preserving for a later post-MVP phase

What to validate:

- candidate can be reopened via resume URL, token, or replay path
- candidate identity can be checked before proceeding
- payable amount or equivalent final review amount can be extracted
- the automation can stop safely before irreversible booking commitment

Success bar:

- the team can document whether post-MVP deep verification is technically possible
- the outcome is used to justify either continued deferral or a tightly controlled future design

## Suggested Execution Order

Run the proofs in this order:

1. browser context handling and recovery
2. packaged search extraction
3. recovery and resume
4. optional deep verification exploration

Each proof should feed implementation, not stand apart from it.

## Recommended Output Artefacts

Capture these outcomes for each proof:

- what was attempted
- what succeeded
- what failed
- what assumptions changed
- whether the MVP plan needs scope adjustment

Useful local artefacts:

- screenshots
- bounded HTML snapshots
- example normalized payloads
- notes on unstable selectors or page states

## Scope Rule

Do not expand into stitched search, AI strategy generation, or broad monitoring automation until the three MVP-critical proofs are acceptable.

## Current Recommendation

Treat this proof plan as the technical gate before full MVP implementation.

If one of the MVP-critical proofs fails materially, reduce scope or change architecture before proceeding deeper into the backlog. Deep verification should remain deferred unless its separate exploratory proof supports a clearly safe design.
