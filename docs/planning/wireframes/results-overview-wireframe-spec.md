# FlyEasy Results Overview Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Results Overview screen.

This is the primary recommendation surface where FlyEasy turns search output into a browsable, trustworthy set of candidate options.

## Screen Role

The Results Overview screen should help the user:

- see the strongest options immediately
- understand what is verified and what is provisional
- distinguish single booking from stitched results
- decide which candidate deserves deeper inspection

It should feel recommendation-led first, comparison-capable second.

## Primary User Goals

- identify the current best options
- understand price and freshness quickly
- filter out obviously less relevant options
- compare candidate types at a glance
- enter candidate detail confidently

## Information Priority

1. Best current outcomes summary
2. Filters and sort controls
3. Candidate list
4. Candidate preview / details pane
5. Strong changes or warnings

## Desktop Layout

### Overall Structure

Use a two-region layout:

1. top summary and filter area
2. lower split area with:
   - left: candidate list
   - right: candidate preview / detail drawer

This gives the screen recommendation clarity while preserving fast drill-down.

### Region 1. Summary And Controls

Required modules:

- page/session context header
- summary row
- filters and sort bar

### Region 2. Main Results Area

Required modules:

- candidate list
- candidate preview panel

## Mobile Layout

Use a stacked layout:

1. session/context header
2. summary row
3. filter and sort controls
4. candidate list
5. full-screen candidate detail on tap

Mobile should not try to preserve a persistent side preview.

## Required Modules

### Module 1. Session / Results Header

Required content:

- session title
- small run or results context cue
- optional quick path back to live progress or monitoring

### Module 2. Summary Row

Purpose:

- surface the strongest current signals before the user reads the list

Required summary blocks:

- cheapest verified option
- cheapest single booking
- cheapest stitched itinerary
- best new change since last run

Optional:

- count of fully verified versus provisional candidates

### Module 3. Filters And Sort Bar

Required controls:

- freshness filter
- booking type filter
- risk filter
- stop count filter
- sort control

Default sort:

- lowest verified price first

Rules:

- filters should be compact and high-signal
- do not overload with advanced analytical controls in v1

### Module 4. Candidate List

Purpose:

- let the user browse options quickly

Required list behavior:

- one candidate card per item
- selected item updates preview panel on desktop
- selected item opens detail on mobile

Ordering rules:

- fresh verified candidates first
- aging verified next
- stale, repriced, or unavailable lower

### Module 5. Candidate Card

Required content:

- verified price
- displayed price if different
- freshness label
- booking type badge
- risk badge
- route summary
- stopover city chips
- total travel time
- travel date cue
- return origin city
- short inline explanation

Optional:

- a small warning if candidate is provisional, stale, repriced, or unavailable

### Module 6. Candidate Preview Panel

Desktop only persistent preview.

Purpose:

- help the user inspect one option without fully leaving the overview

Required content:

- route timeline summary
- verification freshness
- booking type
- risk summary
- short explanation of why this surfaced
- action cluster

Required actions:

- `View Details`
- `Re-verify`
- `Shortlist`
- `Compare`

## Required Candidate Card Rules

### Price Hierarchy

- verified price must be dominant
- displayed search price should appear only as supporting context when different

### Booking Type Differentiation

- single booking and stitched must be clearly differentiated
- stitched should not be alarmist by default

### Freshness Hierarchy

- fresh verified candidates should feel most trustworthy
- stale candidates should be visibly downgraded

### Explanation Layer

Each card should include a short inline explanation such as:

- `Cheaper because the return departs from Chengdu`
- `Stable through deep verification`
- `Includes a 3-day Shanghai stopover`

## Required States

### State A. Strong Verified Results

- multiple strong verified candidates
- healthy comparison environment

### State B. Mixed Verified And Provisional

- clear distinction between provisional and verified
- user can still browse meaningfully

### State C. Repriced Candidates Present

- repriced candidates stay visible
- downgraded recommendation treatment

### State D. No Strong Results

- no compelling verified candidates found
- encourage refinement or further exploration

### State E. Freshness Problem

- many top candidates are aging or stale
- screen encourages re-verification before handoff

## Interaction Rules

### Selecting A Candidate

Desktop:

- updates preview panel

Mobile:

- opens candidate detail screen

### Filtering

- filters should update the list immediately
- current summary row should still reflect the overall strongest options unless we later decide to make it filter-reactive

### Sorting

- sort changes should be obvious but lightweight
- avoid forcing the user into a table view for normal use

### Re-Verification

- stale or aging candidates should expose `Re-verify`
- re-verification should not feel hidden behind candidate detail only

## Copy Guidance

Use:

- factual recommendation language
- concise explanation snippets
- explicit freshness and risk cues

Avoid:

- vague "best for you" claims
- chatty AI language
- opaque internal reasoning labels

## Wireframe Notes

- the screen should feel like a recommendation workspace, not a spreadsheet
- summary row should help orient, not compete with the list
- the candidate list should remain highly scannable
- the preview panel should reduce click depth, not duplicate the full detail screen

## Success Criteria

The wireframe is good enough when:

- a user can quickly identify the top few options
- verified versus provisional is unmistakable
- stitched versus single-booking distinction is clear and calm
- the screen supports both fast scan and deliberate drill-down

## Next Step

After this screen, define the Candidate Detail wireframe spec so the trust and handoff surface is equally precise.

