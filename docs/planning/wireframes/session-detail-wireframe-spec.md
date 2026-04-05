# FlyEasy Session Detail / Search Setup Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Session Detail / Search Setup screen.

This screen is where the user defines or evolves the trip hunt and understands the current search setup in one place.

## Screen Role

The Session Detail screen is the main planning workspace inside a session.

It should help the user:

- understand the current hunt at a glance
- edit trip logic without overwhelm
- see how the current configuration is interpreted
- act on the session: run, monitor, fork, or archive

## Primary User Goals

- review the current hunt definition
- refine trip flexibility and stopover rules
- see AI suggestions inline
- understand whether the changes still belong to this session
- launch a run or update monitoring

## Information Priority

1. Session identity and status
2. Current trip definition
3. Simple editable search controls
4. Plain-language summary of current intent
5. Monitoring controls
6. Advanced options and branching actions

## Desktop Layout

### Overall Structure

Use a two-column working layout.

Recommended desktop regions:

1. top app shell
2. session header bar
3. main content area split into:
   - left: editable search form
   - right: summary and support column

### Region 1. Top App Shell

Shared shell content:

- app identity
- primary navigation
- Trip.com connection badge
- settings

### Region 2. Session Header Bar

Purpose:

- orient the user within the current hunt

Required content:

- session name
- lightweight route summary
- session state
- monitoring state
- session actions menu

Recommended actions in header:

- `Run Search`
- `Fork Session`
- overflow menu for archive / rename / restore if needed

### Region 3. Left Main Column: Search Workspace

Purpose:

- primary editing surface

Required section order:

1. core trip inputs
2. flexibility and stopover controls
3. monitoring controls
4. advanced options

## Right Support Column

Purpose:

- interpret and support the editing process

Required section order:

1. plain-language session summary
2. AI recommendations
3. change-impact or fork guidance
4. current monitoring summary

This side column should explain, not duplicate.

## Mobile Layout

### Overall Structure

Use a single-column scroll layout with this order:

1. session header
2. plain-language summary
3. core trip inputs
4. flexibility and stopover controls
5. monitoring controls
6. AI recommendations
7. advanced options

### Mobile Rules

- summary should appear earlier than on desktop because there is no side column
- primary CTA should stay reachable without excessive scrolling
- advanced options should be collapsible

## Required Modules

### Module 1. Session Header

Required content:

- session title
- route label
- lifecycle state
- monitoring state

Optional:

- last run timestamp
- latest best verified fare

### Module 2. Core Trip Inputs

Required fields:

- origin
- destination
- departure window
- return rule selector
- return origin mode

Behavior:

- keep this block visually simple
- these fields establish the hunt identity

### Module 3. Flexibility And Stopover Controls

Required fields:

- stop count
- stop duration range
- booking mode
- cabin policy

Optional explanatory copy:

- short sentence about how flexibility affects search breadth

### Module 4. Monitoring Controls

Required controls:

- monitoring on/off
- current monitoring state
- if monitoring is off, explanation of what that means

Required behavior:

- monitoring changes should update session state immediately
- turning monitoring off should not feel like deleting the session

### Module 5. Advanced Options

Required fields:

- preferred stopover cities
- excluded stopover cities
- preferred return cities
- search intensity

Required behavior:

- collapsed by default
- clearly optional

### Module 6. Plain-Language Summary Panel

Purpose:

- continuously rewrite the hunt into natural language

Required content:

- route summary
- flexibility summary
- stopover summary
- booking mode summary
- monitoring summary

Example:

- `Searching Melbourne to Guangzhou, departing Apr 5-15, staying 3-5 weeks, allowing 1-2 mainland China stopovers of 1-5 days, comparing single-booking and stitched options.`

### Module 7. AI Recommendation Panel

Purpose:

- offer inline suggestions without becoming a chat surface

Allowed content:

- recommended stopover cities
- flexibility suggestions
- search breadth warnings
- city pattern notes from prior runs

Required behavior:

- suggestions are clearly optional
- each suggestion is editable or dismissible

### Module 8. Change Impact / Fork Guidance

Purpose:

- explain when the current edits may materially change the hunt

Show only when relevant.

Examples:

- `These edits broaden the hunt significantly and may change the best route patterns.`
- `Changing destination will materially alter this trip hunt. We recommend forking this session.`

### Module 9. Action Footer Or Sticky Action Row

Required primary action:

- `Run Search`

Secondary actions:

- `Save Changes`
- `Fork Session`

Behavior:

- on desktop, actions may live in header plus sticky footer
- on mobile, use a sticky bottom action bar if needed

## Required States

Wireframe these states:

### State A. New Session Draft

- empty or lightly prefilled form
- no prior run context
- strong guidance and explanation

### State B. Existing Session Healthy

- current values loaded
- latest summary visible
- monitoring state visible

### State C. Existing Session Needs Attention

- connection or recovery warning visible
- editing still possible
- recovery should not obscure the form entirely

### State D. Fork Recommendation Triggered

- lightweight inline prompt
- explain why fork is recommended
- let user continue in-place if they choose

## Interaction Rules

### Save Behavior

- edits should feel persistent and session-based
- the product should not force a modal save ritual for every field

### Run Behavior

- `Run Search` should use the current active configuration
- if edits materially change the hunt, fork guidance may appear before running

### Monitoring Behavior

- monitoring toggle should be explicit
- status text should explain whether the hunt is live, idle, paused, or blocked

## Wireframe Notes

- this screen is a planner, not a settings page
- avoid using too many small controls in one dense stack
- the right column should increase confidence, not add clutter
- use layout to make core versus advanced decisions unmistakable

## Success Criteria

The wireframe is good enough when:

- a user can understand the current hunt without reading every field
- the form feels approachable despite the complexity underneath
- the summary panel makes the system feel interpretable
- monitoring and fork behavior are visible without dominating the screen

## Next Step

After this screen, define the Pre-Run Review wireframe spec so the transition from planning to execution is equally concrete.
