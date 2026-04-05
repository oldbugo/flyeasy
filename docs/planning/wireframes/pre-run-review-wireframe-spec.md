# FlyEasy Pre-Run Review Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Pre-Run Review screen.

This screen is the final confidence checkpoint before FlyEasy begins an active run.

## Screen Role

The Pre-Run Review screen should translate the configured session into an understandable search plan.

It is not a technical debugger. It is a trust and clarity screen that answers:

- what FlyEasy is about to search
- how broad the hunt is
- what tradeoffs are implied
- whether the user wants to proceed

## Primary User Goals

- confirm the trip definition
- understand the breadth of the search
- understand the major search modes being used
- catch any mistake before launching
- proceed with confidence

## Information Priority

1. Trip-hunt summary
2. Search breadth and flexibility
3. Strategy-family summary in human language
4. Important warnings or caveats
5. Confirmation actions

## Desktop Layout

### Overall Structure

Use a centered, vertically stacked layout with strong reading hierarchy.

Recommended regions:

1. top app shell
2. session context header
3. search plan summary card
4. breadth / timing card
5. search approach card
6. caveats / warning card
7. confirmation footer

This screen should feel more like a review surface than a dashboard.

## Mobile Layout

Use a single-column stacked layout with the same region order.

Priority on mobile:

- summary must remain first
- warnings must stay above the primary CTA
- primary action should remain easy to reach

Consider a sticky bottom confirmation bar on mobile.

## Required Modules

### Module 1. Session Context Header

Required content:

- session title
- route label
- session state

Optional:

- lightweight breadcrumb or back action

### Module 2. Search Plan Summary Card

Purpose:

- restate the hunt in plain language

Required content:

- route summary
- departure window
- return rule
- stopover rule summary
- booking mode summary

Example:

- `Searching Melbourne to Guangzhou, departing Apr 5-15, staying 3-5 weeks, allowing 1-2 mainland China stopovers of 1-5 days, comparing single-booking and stitched options.`

### Module 3. Breadth / Timing Card

Purpose:

- explain how wide and costly the run may be

Required content:

- concise breadth assessment
- likely runtime expectation in qualitative terms
- quick explanation of what makes the search broader or narrower

Examples:

- `Moderately broad search`
- `Likely to take longer because return city and stopover cities are flexible`

Do not present false precision unless later implementation supports it.

### Module 4. Search Approach Card

Purpose:

- show the user the major search families without raw strategy jargon

Required content:

- direct baseline search
- standard stop search
- intentional stopover search
- packaged vs stitched comparison
- return-city exploration if enabled

Example language:

- `Checking direct and standard stop options first`
- `Exploring intentional mainland China stopovers`
- `Comparing packaged Trip.com results with separate-ticket combinations`
- `Looking for cheaper return departures from other mainland China cities`

### Module 5. Caveats / Warning Card

Purpose:

- surface things the user should understand before running

Required content when relevant:

- search is especially broad
- stitched results may be included
- Trip.com session is aging or may need re-authentication
- current edits materially changed the hunt

Rules:

- show only relevant caveats
- keep tone factual and non-alarmist

### Module 6. Confirmation Footer

Required actions:

- `Confirm And Run`
- `Back To Edit`

Optional:

- `Fork Instead` if intent-level changes triggered a fork recommendation

## Required States

### State A. Standard Review

- healthy session
- normal breadth
- no significant warnings

### State B. Broad Search Review

- stronger breadth warning
- more emphasis on runtime/volatility explanation

### State C. Fork Recommendation Review

- destination or intent changed materially
- `Fork Instead` surfaced
- user can still continue in-place deliberately

### State D. Session Attention Warning

- Trip.com session is weak or blocked
- run can still be reviewed, but warning is visible before execution

## Interaction Rules

### Confirmation Behavior

- `Confirm And Run` starts the run using the current session configuration
- this action should feel decisive and primary

### Back Behavior

- `Back To Edit` returns to Session Detail without data loss

### Fork Behavior

- if shown, `Fork Instead` should create a new session and preserve the current one
- do not make forking mandatory

## Copy Guidance

Good tone:

- explanatory
- concise
- grounded in the user's hunt

Good examples:

- `This search is broader than usual because it allows multiple stopover cities and flexible return departures.`
- `FlyEasy will compare packaged Trip.com itineraries with stitched alternatives when cheaper patterns appear possible.`

Avoid:

- raw strategy names
- generic warnings with no reason
- engineering-style execution details

## Wireframe Notes

- this screen should reassure, not overwhelm
- visual hierarchy should make the hunt summary immediately clear
- the strategy-family section should feel intelligible to a non-technical user
- warnings should feel informative, not punitive

## Success Criteria

The wireframe is good enough when:

- a user can tell exactly what hunt is about to run
- the breadth and tradeoffs are easy to grasp
- the user understands stitched vs packaged comparison at a high level
- the screen increases confidence rather than slowing the flow

## Next Step

After this screen, define the Live Run Progress wireframe spec, since that is where execution becomes visible and interactive.
