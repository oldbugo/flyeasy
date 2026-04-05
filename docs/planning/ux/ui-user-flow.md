# FlyEasy UI User Flow

## Purpose

Define the first end-to-end user flow for FlyEasy so the product can be reviewed from a UI and UX perspective before screens are designed in detail.

This flow is based on the current product direction:

- personal-use first
- local-first web app
- Trip.com browser automation
- bounded AI assistance layered onto deterministic search orchestration
- price-first ranking
- intentional mainland China stopovers

## Product UX Goal

The UI should make a complex search system feel legible and trustworthy.

The user should always be able to answer:

- what trip am I searching for
- what is the agent doing right now
- why is this result considered good
- how risky is this itinerary
- what changed since the last run
- how do I get from a candidate to booking on Trip.com

The primary object the user interacts with is a long-lived session or trip hunt that evolves over time.

## Core UX Principles

- Search setup should feel simple even if the backend strategy system is complex.
- Results should prioritize clarity of tradeoffs over raw data density.
- AI behavior should be visible as reasoning and suggestions, not as mysterious autonomy.
- Verification status must be visually prominent because displayed and final price can diverge.
- Stitched itineraries must never be visually confused with protected single bookings.

## Primary User Flow

### 1. Session Dashboard

Purpose:

- establish the user's active trip hunts
- show whether Trip.com is connected
- surface the latest best options, monitoring status, and sessions needing attention

Key content:

- active session cards
- needs-attention module
- Trip.com session status
- quick summary of latest best verified fares across sessions
- quick actions: `New Session`, `Resume Session`, `Review Best Options`

Primary user decision:

- start a new trip hunt
- reopen an existing session
- deal with a blocked or stale session

### 2. Search Setup

Purpose:

- capture the trip intent in a simple form

Primary inputs:

- origin airport
- destination city
- departure date window
- return rule: duration window or return window
- return origin mode
- stop count
- stop duration range
- booking mode
- cabin policy

Advanced options:

- preferred stopover cities
- excluded stopover cities
- preferred return cities
- monitoring on/off
- search intensity

AI-related affordance:

- a compact assistant panel suggesting useful ranges or stopover city ideas
- example: "Shanghai and Chengdu have been strong stopover cities in similar searches"

Primary user decision:

- run the search immediately
- save the session and continue monitoring it over time

### 3. Pre-Run Review

Purpose:

- translate the simple form into an understandable search plan

Key content:

- plain-language summary of the search
- expected strategy families to be used
- expected search breadth
- warning if the search is broad and likely to take longer

Example content:

- "Searching Melbourne to Guangzhou"
- "Allowing 1-2 mainland China stopovers of 1-5 days"
- "Comparing packaged and stitched itineraries"
- "Return may start from any mainland China city"

Primary user decision:

- confirm and run
- go back and refine

This screen matters because it makes the AI-heavy engine feel inspectable rather than opaque.
This screen matters because it makes the search engine feel inspectable rather than opaque, even before AI-assisted strategy expansion is introduced.

### 4. Live Search Progress

Purpose:

- make the automation and agent behavior visible while the search is running

Key content:

- progress header with current run status
- strategy timeline or queue
- current phase: seed, expand, verify
- live event feed
- emerging top candidates
- candidates found and verified counts

Useful status modules:

- `Trip.com session`: connected, relogging, blocked
- `Current strategy`: one-stop city sweep, stitched split, open-jaw return
- `Current city focus`: Shanghai, Chengdu, etc.
- `Deep verification`: running, repriced, unavailable, verified

Primary user decision:

- let it continue
- pause
- stop and review current results

### 5. Results Overview

Purpose:

- show the best candidates in a way that supports fast comparison

Recommended default layout:

- top summary row
- candidate list on the left or center
- details drawer or details panel on selection

Top summary row should include:

- cheapest verified option
- cheapest single booking
- cheapest stitched itinerary
- best new change since last run

Each candidate card should show:

- final verified price
- displayed search price if different
- verification badge
- booking type badge
- stopover city chips
- total trip time
- travel dates
- return origin city
- risk badge

Primary user decision:

- sort and filter
- open a candidate in detail
- compare two or more options

### 6. Candidate Detail View

Purpose:

- explain one itinerary fully enough that the user trusts the handoff

Key content:

- route timeline
- flight legs
- stopover durations
- baggage/fare summary
- price breakdown
- verification history
- reason this candidate surfaced
- stitched-risk explanation when applicable

Important explanation blocks:

- `Why this is good`
- `What changed during verification`
- `Booking risk`
- `Trip.com handoff readiness`

Primary actions:

- open on Trip.com
- re-verify this candidate
- save to shortlist
- compare against another candidate

### 7. Compare View

Purpose:

- make tradeoffs between price, risk, stopovers, and travel time explicit

Recommended comparison columns:

- price
- booking type
- stopover cities
- stop durations
- total travel time
- baggage/fare notes
- verification freshness
- risk level

Primary user decision:

- choose the candidate to pursue
- reject options that are too risky or tiring

### 8. Monitoring And History

Purpose:

- make repeated searches feel useful over time rather than disposable

Key content:

- session list
- latest run status
- historical best price
- recent price changes
- repeated winning stopover cities
- blocked or failed verification events

Primary user decision:

- rerun now
- edit search
- inspect what changed
- pause or resume monitoring for this session

### 9. Booking Handoff

Purpose:

- move from FlyEasy into Trip.com with confidence

Key content:

- selected candidate summary
- last verified time
- verified price
- warnings if the candidate is stitched or verification is stale

Primary action:

- `Open in Trip.com`

The user should feel that FlyEasy did the hard search and validation work, but the final booking control is still theirs.

## Recommended Information Architecture

V1 should use a session-first information architecture.

Recommended top-level navigation:

- `Sessions`
- `Settings`

Inside a session, the flow is:

- setup
- pre-run review
- live progress
- results overview
- candidate detail
- compare
- monitoring / history

## System States The UI Must Handle Well

These states are not edge cases. They are core to trust.

### Session blocked

Trip.com session expired, login challenge, or CAPTCHA.

UI should:

- show that the search is blocked, not broken
- explain what the user needs to do
- allow resume after intervention

### Candidate repriced

A good-looking result changed during deep verification.

UI should:

- show the old displayed price and the verified price
- visually downgrade the candidate
- explain that Trip.com changed price deeper in flow

### Candidate unavailable

The itinerary disappeared during verification.

UI should:

- keep it in history for transparency
- remove it from recommended live options

### Search still useful before full completion

Long searches should still surface early wins.

UI should:

- show partial top candidates while later strategies are running
- clearly distinguish provisional vs fully verified results

## Recommended Screen Set For First Design Pass

Design these first:

1. dashboard / home
2. search setup
3. pre-run review
4. live search progress
5. results overview
6. candidate detail
7. monitoring history

These cover the core product story without overextending into low-frequency settings views.

## Suggested Low-Fidelity Wireflow

```text
Dashboard
  -> Search Setup
  -> Pre-Run Review
  -> Live Search Progress
  -> Results Overview
      -> Candidate Detail
      -> Compare View
      -> Open in Trip.com

Dashboard
  -> Monitoring
      -> Search History
      -> Candidate Detail
      -> Re-run Search
```

## UX Tensions To Review Together

These are the main design decisions worth debating before visual design starts:

- How dense each session card should be on the home screen.
- How much live progress detail should show before expansion.
- When the product should recommend forking a session rather than evolving it.
- How strongly result cards should differ visually between single-booking and stitched options while staying calm.

## Current Recommendation

For v1, the UI should behave like:

- a high-trust session workspace
- simple setup inside each evolving trip hunt
- structured, technical live feedback during runs
- editorial, recommendation-style results above a denser comparison table
- very explicit verification and risk communication

This direction fits the product best because the backend is complex and volatile, while the user goal is simple: find the cheapest option that is still real and bookable.
