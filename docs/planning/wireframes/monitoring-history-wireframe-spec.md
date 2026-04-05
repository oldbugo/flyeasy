# FlyEasy Monitoring / History Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Monitoring / History screen.

This is the screen where a session becomes a story over time rather than just a one-off search.

## Screen Role

The Monitoring / History screen should help the user understand:

- how the hunt has evolved
- what changed across runs
- whether monitoring is active and healthy
- which route or city patterns are consistently strong

It should feel like the memory and watchlist layer of the session.

## Primary User Goals

- know whether the hunt improved
- see meaningful price changes
- understand repeated route patterns
- manage monitoring state
- revisit past outcomes without losing context

## Information Priority

1. Current monitoring state
2. What changed recently
3. Latest run status
4. Historical best-price movement
5. Run history and blocked events
6. Repeated city or pattern insight

## Desktop Layout

### Overall Structure

Use a vertically stacked layout with summary first and history below.

Recommended desktop regions:

1. top app shell
2. session monitoring header
3. monitoring state and controls row
4. what-changed summary row
5. historical price and trend region
6. run history timeline
7. repeated pattern summary
8. blocked / failed event history

### Layout Intent

The screen should answer "what changed" before it answers "everything that ever happened."

## Mobile Layout

Use a single-column stacked layout.

Recommended order:

1. session monitoring header
2. monitoring controls
3. what-changed summary
4. price movement
5. run history
6. repeated patterns
7. blocked or failed events

On mobile, reduce density and prioritize recency.

## Required Modules

### Module 1. Session Monitoring Header

Required content:

- session title
- route summary
- monitoring state
- lifecycle state if relevant

Optional:

- latest best verified fare

### Module 2. Monitoring State And Controls

Required content:

- monitoring status
- last run time
- current health state

Required actions:

- `Run Now`
- `Pause Monitoring`
- `Resume Monitoring`
- `Edit Session`
- optional `Archive`

Rules:

- controls should reflect the current state
- if blocked, recovery action should be visible here as well

### Module 3. What-Changed Summary

Purpose:

- surface the most important recent movement in the hunt

Required content:

- new best verified fare if found
- meaningful price increase or decrease
- candidate became unavailable
- new city pattern worth attention
- session blocked and needing help

This should read as a concise change digest, not a chart caption.

### Module 4. Historical Best-Price Region

Purpose:

- show whether the hunt is trending better or worse over time

Required content:

- historical best verified price trend
- current best versus prior best
- optional annotation for significant jumps or drops

This can be sketched as a chart region or simplified timeline marker in wireframes.

### Module 5. Run History Timeline

Purpose:

- show the sequence of runs and their outcomes

Required content per item:

- run time
- run status
- strongest result or outcome summary
- if blocked, why

Examples:

- `Today, 10:32 AM - completed - new best fare found`
- `Yesterday, 8:14 PM - blocked - Trip.com challenge required`

### Module 6. Repeated Pattern Summary

Purpose:

- show useful learned patterns from repeated runs

Required content:

- strongest recurring stopover city
- strongest return-origin city
- booking mode patterns if useful

Examples:

- `Chengdu has produced the lowest returns in 3 of the last 5 runs`
- `Single-booking options remain more stable than stitched results in this hunt`

### Module 7. Blocked / Failed Event History

Purpose:

- preserve trust and transparency around interruptions

Required content:

- blocked events
- failed verification events
- session-recovery events

This module should not dominate the page unless there is an active problem.

## Required States

### State A. Healthy Live Monitoring

- monitoring active
- recent run history healthy
- no current intervention needed

### State B. Not Live Session

- monitoring paused
- session still reviewable and editable

### State C. Needs Attention

- blocked state visible
- recovery action available
- history preserved

### State D. Strong Improvement

- what-changed summary emphasizes a new best fare or promising change

### State E. No Meaningful Change

- no major movement
- screen should still feel informative, not empty

## Interaction Rules

### Run Now

- launches a new run immediately from the current session configuration

### Pause Monitoring

- moves the session out of live monitoring
- does not delete history

### Resume Monitoring

- returns the session to live monitoring
- should be explicit and lightweight

### Opening Run History

- users should be able to inspect prior run details or jump to related results/candidates if later implemented

## Copy Guidance

Use:

- recency-based language
- factual change summaries
- trust-preserving event language

Good:

- `New low found since yesterday`
- `No major change in the last 3 runs`
- `Monitoring paused`
- `Trip.com login blocked the last run`

Avoid:

- dense analytics jargon
- passive, vague event language
- making quiet periods feel like product failure

## Wireframe Notes

- this screen should feel like a hunt journal with operational clarity
- lead with "what changed," not with raw history
- trend region should support interpretation, not dominate
- blocked history should reinforce trust without turning the screen into a failure report

## Success Criteria

The wireframe is good enough when:

- a user can understand the recent story of the hunt quickly
- monitoring state is unmistakable
- price movement and repeated patterns are legible
- the screen supports both action and reflection

## Next Step

After this first-pass screen set, the next logical step is either:

- define the Compare View wireframe spec
- or create a cross-screen component spec for shared modules and badges

