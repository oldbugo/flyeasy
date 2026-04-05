# FlyEasy Live Run Progress Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Live Run Progress screen.

This is the screen where FlyEasy visibly does the work of searching, expanding, verifying, and occasionally asking the user for help.

## Screen Role

The Live Run Progress screen is the operational heart of the product.

It must make the system feel:

- active
- responsive
- inspectable
- trustworthy

without turning the UI into a raw automation console.

## Primary User Goals

- understand what the run is doing right now
- see that progress is real
- notice strong early outcomes
- know when the system needs intervention
- decide whether to wait, pause, stop, or review

## Information Priority

1. Current run status
2. Current phase and focus
3. Best verified outcome so far
4. Progress counts
5. Latest meaningful event
6. Recovery state if blocked
7. Deeper activity only when expanded

## Desktop Layout

### Overall Structure

Use a vertically stacked layout with one strong primary column and one optional secondary region for emerging results.

Recommended desktop regions:

1. top app shell
2. run context header
3. default progress panel
4. emerging best candidates shelf
5. expandable activity detail panel
6. recovery panel when needed
7. action footer or header controls

### Layout Intent

The top half of the page should answer:

- what phase are we in
- what is being tested
- is the run healthy
- did we already find anything useful

The lower half should support inspection without becoming mandatory reading.

## Mobile Layout

Use a single-column stacked layout.

Recommended order:

1. run context header
2. default progress panel
3. recovery panel if needed
4. emerging candidates
5. expandable details
6. sticky control bar

Mobile should prioritize:

- phase
- best outcome so far
- blocked-state visibility
- one primary action cluster

## Required Modules

### Module 1. Run Context Header

Required content:

- session name
- run state
- current session monitoring state if relevant

Optional:

- small link back to session detail

### Module 2. Default Progress Panel

This is the default-visible high-signal panel.

Required content:

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

Recommended structure inside the panel:

#### Top row

- run status
- phase badge
- elapsed time cue

#### Main body

- current focus line
- best verified fare so far
- key counts

#### Bottom row

- latest event
- strategy queue summary

### Module 3. Emerging Best Candidates Shelf

Purpose:

- let the user see early value before the run is complete

Required content:

- top 1 to 3 currently strongest candidates
- compact verified-price-first candidate summaries

Rules:

- if candidates are only provisional, label them clearly
- fully verified results should outrank provisional ones

### Module 4. Expandable Activity Detail Panel

Purpose:

- give deeper inspection without forcing it into the main layer

Required content:

- recent strategy history
- verification outcome breakdown
- route/city under test
- booking mode under evaluation
- stitched-search activity
- strategies completed vs planned
- recent retries and interruptions

This panel should be collapsed or visually secondary by default.

### Module 5. Recovery Panel

Purpose:

- handle blocked states and guide the user through recovery

Show only when relevant.

Required content:

- what happened
- what FlyEasy was doing
- what the user needs to do
- what will happen after recovery
- primary recovery action

Examples:

- `Trip.com needs you to log in again`
- `Complete the challenge in the browser window, then return here to resume`

### Module 6. Run Controls

Required actions:

- `Pause`
- `Stop And Review`
- `Resume` when paused

Conditional actions:

- recovery CTA when blocked

Rules:

- controls should always be reachable
- stopping should not discard already found results

## Required States

### State A. Normal Active Run

- healthy session
- progress visible
- no intervention required

### State B. Active Run With Strong Early Outcome

- emerging candidate shelf contains one clearly promising option
- user may choose to stop and review

### State C. Blocked Session

- recovery panel visible
- progress context preserved
- partial findings still visible

### State D. Paused Run

- run state clear
- resume action prominent
- findings preserved

### State E. Run Complete

- final progress state visible
- strong transition path to results overview

## Interaction Rules

### Pause

- pauses the run without discarding current context
- progress screen should explain that the hunt can be resumed

### Stop And Review

- ends the active run
- sends the user to the current results set
- keeps partial verified outcomes

### Resume

- resumes the same run when safely possible
- if a partial restart is required, tell the user

### Recovery

- recovery should not wipe visible progress
- after recovery, show whether the run resumed or partially restarted

## Copy Guidance

Use concise, operational, human-readable language.

Good:

- `Testing one-stop routes through Shanghai`
- `Verifying the cheapest options now`
- `New best option found`
- `Trip.com needs your help to continue`

Avoid:

- raw strategy identifiers
- log-like event spam
- vague errors

## Visual Hierarchy Notes

- the phase and current focus should be more important than raw counts
- best verified outcome should be the strongest numeric element
- blocked state should be unmistakable without swallowing the whole screen
- the expanded detail area should feel secondary

## Empty And Transitional States

### Very Early Run

- no candidates yet
- progress still visible and meaningful

### Partial Results

- some candidates available
- verification still ongoing
- provisional vs verified clearly separated

### Finished With No Useful Results

- run completed
- no strong candidates found
- encourage refinement rather than implying product failure

## Success Criteria

The wireframe is good enough when:

- the user can tell the run is genuinely progressing
- the page feels responsive and inspectable
- a blocked state feels recoverable
- strong early results are visible without waiting for completion
- the UI does not devolve into a raw engineering console

## Next Step

After this screen, define the Results Overview wireframe spec so the product's recommendation surface is equally concrete.

