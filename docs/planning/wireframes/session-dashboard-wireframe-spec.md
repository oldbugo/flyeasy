# FlyEasy Session Dashboard Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Session Dashboard so it can be designed consistently across desktop and mobile.

## Screen Role

The Session Dashboard is the home screen and control surface for all active trip hunts.

It should optimize for:

- fast scan of session state
- rapid re-entry into the right hunt
- visibility of blocked or stale sessions
- confidence in current best outcomes without becoming a results page

## Primary User Goals

- see which hunts are live
- see which hunts need attention
- see the current best known outcome per hunt
- start a new hunt
- reopen an existing hunt

## Information Priority

The dashboard should present information in this order:

1. Global system readiness
2. Quick re-entry actions
3. Live hunts needing attention
4. Healthy live hunts
5. Not-live hunts
6. Archived hunts

## Desktop Layout

### Overall Structure

Use a single-page dashboard with stacked vertical sections.

Recommended desktop regions from top to bottom:

1. top app shell
2. dashboard header
3. global status strip
4. quick actions row
5. `Live hunts` section
6. `Not live` section
7. `Archived` section

### Region 1. Top App Shell

Required content:

- app name / logo
- primary navigation
- Trip.com connection badge
- settings entry

Behavior:

- remains visually stable
- should not consume excessive vertical space

Recommended MVP navigation:

- `Sessions`
- `Settings`

### Region 2. Dashboard Header

Required content:

- page title: `Sessions`
- short supporting line explaining what the dashboard is for

Suggested tone:

- operational and calm
- example: `Track your active trip hunts, review changes, and resume where needed.`

### Region 3. Global Status Strip

Purpose:

- surface cross-session status that affects the whole product

Required content:

- Trip.com session state
- optional worker/app readiness state
- recovery CTA if global connection is blocked

Display rules:

- compact when healthy
- expanded only when attention is required

### Region 4. Quick Actions Row

Required actions:

- `New Session`
- `Resume Last Session`
- optional `Review Best Options`

Layout recommendation:

- 2 to 3 high-emphasis actions
- not a large command center

### Region 5. Live Hunts

Purpose:

- primary active dashboard area

Required section header content:

- section title
- optional count

Ordering rules:

1. needs-attention sessions
2. live-running sessions
3. live-idle sessions

Layout recommendation:

- vertical stack of cards by default
- two-column layout allowed on wide screens only if card readability remains strong

### Region 6. Not Live

Purpose:

- show hunts that are still relevant but not currently active

Ordering rules:

1. completed
2. not live
3. draft

Visual treatment:

- slightly quieter than live hunts
- still fully readable

### Region 7. Archived

Purpose:

- preserve history without competing with active work

Display recommendation:

- collapsed by default if there are many archived sessions
- lighter visual emphasis

## Mobile Layout

### Overall Structure

Use the same content order as desktop, but stack all regions in one column.

Priority on mobile:

- keep global status and live hunts near the top
- reduce secondary metadata per card
- preserve action clarity

### Mobile-Specific Rules

- session cards should be full-width
- only one primary action should be visible on the card face
- secondary actions should move into an overflow menu or compact action row
- archived section may be collapsed by default

## Session Card Spec

Use the state-first model as default.

### Card Structure

Top block:

- session name or route label
- date context
- session/monitoring state badge

Middle block:

- current state message
- best verified outcome
- freshness

Bottom block:

- last meaningful change
- primary action
- optional secondary action affordance

### Required Fields

- session identity
- departure / duration context
- monitoring or blocked state
- best verified price
- verification freshness
- last meaningful change
- primary CTA

### Optional Fields

- best stopover pattern
- booking type of best option
- small risk cue

### Card CTA Rules

Healthy live session:

- primary CTA: `Open Session`

Needs-attention session:

- primary CTA: `Resume`

Not-live session:

- primary CTA: `Open Session`

Archived session:

- primary CTA: `Restore`

## Card Variants

### Variant A. Healthy Live

Content emphasis:

- state is calm
- best fare is visible
- last change is informative, not alarming

Example state line:

- `Monitoring active`

### Variant B. Needs Attention

Content emphasis:

- issue becomes dominant in middle block
- recovery CTA is primary

Example state line:

- `Trip.com needs you to log in again`

### Variant C. High Opportunity

Content emphasis:

- stronger outcome band
- still keep state above outcome in hierarchy

Example change line:

- `New low found: down AUD 34`

### Variant D. Completed

Content emphasis:

- session still easy to revisit
- no live urgency

Example state line:

- `Completed`

### Variant E. Archived

Content emphasis:

- visibly lower prominence
- restore path available

## Empty And Transitional States

### Empty Dashboard

Use when there are no sessions yet.

Required content:

- simple explanation of what a session is
- `New Session` CTA
- reassurance that monitoring and results will appear here once started

### No Live Hunts

Use when there are sessions, but none are currently live.

Required content:

- empty-state messaging inside `Live hunts`
- action to resume or create a session

### Global Blocked State

Use when Trip.com connection prevents meaningful activity.

Required content:

- clear explanation
- recovery CTA
- do not hide session cards

### Loading State

Use lightweight skeletons for:

- session cards
- global status strip

Avoid:

- full-screen spinner for the whole dashboard

## Interaction Notes

### Opening A Session

Clicking the card or primary CTA should open the session at the most appropriate substate:

- setup if still draft
- live progress if a run is active
- results if there are current outcomes to review
- recovery state if blocked

### Hover / Secondary Reveal

Desktop may reveal secondary actions on hover:

- rerun now
- pause monitoring
- archive

Mobile should keep these behind overflow or a secondary tap path.

## Copy Guidance

Use concise, factual language.

Good:

- `Monitoring active`
- `Needs attention`
- `Verified 18m ago`
- `New low found`

Avoid:

- overly conversational copy
- raw technical strategy names
- alarmist warning language for normal states

## Wireframe Success Criteria

The dashboard wireframe is good enough when:

- a user can scan several sessions and know where attention is needed
- live versus not-live versus archived is obvious
- each card communicates both state and best known outcome
- the page feels like a control surface, not a spreadsheet or travel marketplace

## Next Step

After wireframing this screen, define:

- exact session card content density
- card width and list/grid behavior at breakpoints
- session detail / search setup wireframe spec
