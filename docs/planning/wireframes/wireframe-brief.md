# FlyEasy Wireframe Brief

## Purpose

Define the first screen-by-screen wireframe brief for FlyEasy so design work can begin from a concrete, prioritized structure rather than from abstract planning alone.

This brief is intentionally low-level enough to guide wireframes, but not yet visual-design specific.

## Product Framing

FlyEasy is a session-first travel-hunt workspace.

The wireframes should express these principles:

- session-first home experience
- trust through verification and clear state
- inline AI explanations, not chat
- structured, responsive live progress
- state-first dashboard scanning
- recommendation-led results with deeper comparison

## Design Scope For First Pass

Wireframe these seven screens first:

1. Session Dashboard
2. Session Detail / Search Setup
3. Pre-Run Review
4. Live Run Progress
5. Results Overview
6. Candidate Detail
7. Monitoring / History

## Global Shell Requirements

All primary screens should share a stable app shell with:

- top app bar
- Trip.com connection state indicator
- current session label when inside a session
- primary navigation
- lightweight access to Settings

Recommended primary navigation:

- `Sessions`
- `Settings`

Search, Results, and Monitoring should be presented as session-level views rather than top-level global navigation items in the MVP shell.

The shell should feel stable and operationally trustworthy, not decorative.

## Screen 1: Session Dashboard

### Primary Purpose

Let the user scan active trip hunts, see what needs attention, and jump back into the right session.

### Primary User Questions

- Which hunts are live right now?
- Does anything need my attention?
- Which hunt currently has the most promising outcome?
- Where should I jump back in?

### Required Sections

1. Dashboard header
2. Global Trip.com session status
3. Quick actions row
4. `Live hunts` section
5. `Not live` section
6. `Archived` section

### Required Modules

#### Header

- page title
- short supporting line explaining dashboard purpose

#### Global status bar

- Trip.com connection state
- if blocked, concise action to resolve

#### Quick actions

- `New Session`
- `Resume Last Session`
- optional `Review Best Options`

#### Session cards

Use the state-first card model as default.

Each card must include:

- trip identity
- monitoring/session state
- best verified outcome
- freshness
- last meaningful change
- primary action

### Required Session Card Variants

- healthy live session
- high-opportunity live session
- needs-attention session
- not-live session
- completed session

### Required Actions

- open session
- resume blocked session
- rerun now
- pause monitoring
- archive
- restore archived session

### Priority Rules

- `Live hunts` appear first
- needs-attention sessions sort before healthy live sessions
- archived hunts are visually quieter than live hunts

### Wireframe Notes

- design for a small number of sessions, not a dense enterprise table
- prioritize scan clarity over analytics density
- avoid making the dashboard feel like a marketplace grid

## Screen 2: Session Detail / Search Setup

### Primary Purpose

Let the user define or evolve the trip hunt through a simple but flexible form.

### Primary User Questions

- What trip am I hunting?
- How flexible is this hunt?
- What stopover rules am I using?
- Is monitoring on?

### Required Sections

1. Session header
2. Search form
3. Plain-language summary panel
4. AI suggestion region
5. Monitoring controls

### Required Form Structure

#### Primary block

- origin
- destination
- departure window
- return rule
- return origin mode

#### Secondary block

- max stops
- stop duration range
- booking mode
- cabin policy
- monitoring enabled

#### Advanced block

- preferred stopover cities
- excluded stopover cities
- preferred return cities
- search intensity

### Required Behaviors

- progressive disclosure
- live updating plain-language summary
- inline AI recommendations
- clear fork recommendation only for intent-level changes

### Required Actions

- `Run Search`
- `Save Session`
- `Fork Session`
- `Turn Monitoring On/Off`

### Wireframe Notes

- the form should feel like a flexible planner, not an admin form
- the summary panel should read like a trip brief, not raw field echo

## Screen 3: Pre-Run Review

### Primary Purpose

Translate the configured session into a clear search plan before execution begins.

### Primary User Questions

- What exactly is FlyEasy about to do?
- How broad is this search?
- What tradeoffs am I making?

### Required Sections

1. Search plan summary
2. Strategy-family summary
3. Breadth/time expectation
4. warnings or caveats
5. action footer

### Required Content

- plain-language search description
- route and date flexibility summary
- stopover constraints
- packaged vs stitched comparison note
- return-origin flexibility note
- "likely to take longer" warning for broad searches

### Required Actions

- `Confirm And Run`
- `Back To Edit`

### Wireframe Notes

- this should feel like a confidence screen, not an obstacle
- use language the user can inspect quickly

## Screen 4: Live Run Progress

### Primary Purpose

Show FlyEasy actively searching and verifying in a way that feels responsive, structured, and trustworthy.

### Primary User Questions

- What is FlyEasy doing right now?
- Is the run making progress?
- Did it find anything good yet?
- Does it need my help?

### Required Sections

1. Run status header
2. Default progress panel
3. Emerging best candidates shelf
4. expandable deeper activity panel
5. intervention/recovery panel

### Default Visible Progress Requirements

- run status
- current phase
- current focus
- best verified fare so far
- candidates found
- candidates verified
- strategy queue summary
- latest meaningful event
- Trip.com session state
- attention banner if blocked

### Expanded Progress Requirements

- recent strategy history
- verification outcome breakdown
- route/city under test
- booking mode under evaluation
- stitched-search activity
- elapsed time
- strategies completed vs planned
- retries and interruptions

### Required Actions

- `Pause`
- `Stop And Review`
- `Resume`
- recovery action if blocked

### Wireframe Notes

- default layer should feel structured and technical, not chatty
- expanded layer should reward curiosity without turning into raw logs

## Screen 5: Results Overview

### Primary Purpose

Help the user browse and narrow down recommended candidates quickly.

### Primary User Questions

- What are the best options right now?
- Which are single booking versus stitched?
- Which are verified and fresh?
- What changed since last time?

### Required Sections

1. Results summary row
2. filters/sort bar
3. candidate list
4. details preview drawer or side panel

### Required Summary Modules

- cheapest verified option
- cheapest single booking
- cheapest stitched itinerary
- best new change since last run

### Candidate Card Requirements

Each candidate card should include:

- verified price
- displayed price if different
- freshness state
- booking type badge
- risk badge
- stopover city chips
- total travel time
- travel dates
- return origin city
- short "why this surfaced" explanation

### Required Actions

- open candidate detail
- compare
- shortlist
- re-verify if stale

### Wireframe Notes

- this is recommendation-led, not spreadsheet-first
- comparison power comes after initial scan clarity

## Screen 6: Candidate Detail

### Primary Purpose

Provide enough detail and explanation for the user to trust or reject a specific itinerary.

### Primary User Questions

- Why is this option good?
- How real is this price?
- What is the risk?
- Am I ready to open this in Trip.com?

### Required Sections

1. candidate header
2. route timeline
3. price and verification panel
4. baggage/fare block
5. explanation blocks
6. shortlist/compare/handoff actions

### Required Content

- verified price and freshness
- displayed price if different
- route timeline with stopovers
- flight legs
- baggage/fare summary
- verification history
- stitched risk explanation if relevant
- handoff confidence state

### Required Explanation Blocks

- `Why this is good`
- `What changed during verification`
- `Booking risk`
- `Trip.com handoff readiness`

### Required Actions

- `Open in Trip.com`
- `Re-verify`
- `Save to Shortlist`
- `Compare`
- `Dismiss`

### Wireframe Notes

- detail view should feel like a trust surface, not a dump of raw itinerary data
- the price/verification block needs especially strong hierarchy

## Screen 7: Monitoring / History

### Primary Purpose

Show how a session evolved over time and what changed across runs.

### Primary User Questions

- Has this hunt improved?
- What changed since the last run?
- Which city patterns are working?
- Is monitoring still active and healthy?

### Required Sections

1. session monitoring header
2. monitoring state and controls
3. run history timeline
4. price change summary
5. recurring pattern summary
6. blocked/failure history

### Required Content

- monitoring state
- latest run status
- historical best verified price
- recent price changes
- repeated strong stopover cities
- blocked or failed run events
- stale or unavailable shortlist candidates when relevant

### Required Actions

- `Run Now`
- `Pause Monitoring`
- `Resume Monitoring`
- `Edit Session`
- `Archive`

### Wireframe Notes

- this screen should feel like the memory of the hunt
- prioritize "what changed" over dense analytics

## Cross-Screen Component Requirements

These components should be defined consistently during wireframing:

- Trip.com connection badge
- session card variants
- candidate card
- verification freshness badge
- booking type badge
- risk label
- recovery banner/panel
- plain-language search summary block
- AI explanation snippet

## Critical States That Must Be Wireframed

Do not wireframe only happy paths.

Include at least one state for:

- session blocked
- challenge required
- stale verified candidate
- repriced candidate
- unavailable candidate
- live run with partial results
- not-live session
- archived session

## Output Expectation For Next Step

The next design artefact after this brief should define each screen in more exact layout terms:

- major regions
- module ordering
- empty/loading/error states
- mobile responsiveness priorities

## Current Recommendation

Start wireframing from:

1. Session Dashboard
2. Live Run Progress
3. Results Overview

These three screens establish the product's identity fastest. Then complete the search setup and candidate detail surfaces around them.

