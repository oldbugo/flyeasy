# FlyEasy Compare View Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Compare View.

This is the screen where the user makes a deliberate choice between multiple candidates by comparing price, risk, stopovers, and trust signals side by side.

## Screen Role

The Compare View should help the user answer:

- which option is cheaper in a trustworthy way
- which option is safer or less inconvenient
- what tradeoff each itinerary makes
- which candidate should be pursued next

It should feel analytical, but still readable and recommendation-aware.

## Primary User Goals

- compare 2 to 3 candidates directly
- understand tradeoffs without switching back and forth between detail pages
- identify the most sensible next step
- re-verify or shortlist without losing the comparison context

## Information Priority

1. Verified price and freshness
2. Booking type and risk
3. Stopover structure
4. Total travel time
5. Route and fare differences
6. Action path for each candidate

## Comparison Scope

For v1:

- support comparison of 2 candidates by default
- allow 3 candidates if layout permits without collapsing readability

Do not optimize the first version for large comparison grids.

## Desktop Layout

### Overall Structure

Use a multi-column comparison layout with one column per candidate and one left-side label column.

Recommended regions:

1. top app shell
2. comparison header
3. summary recommendation bar
4. comparison grid
5. bottom action row if needed

### Comparison Grid Structure

Use rows for categories and columns for candidates.

Recommended row order:

1. candidate header
2. verified price and freshness
3. booking type and risk
4. route summary
5. stopover details
6. total travel time
7. baggage/fare notes
8. verification behavior
9. recommendation explanation
10. actions

## Mobile Layout

Use a stacked comparison mode rather than a wide table.

Recommended patterns:

- segmented toggle between candidates
- or vertically stacked candidate blocks with repeated comparison labels

Mobile should optimize for:

- price and freshness first
- clear route understanding
- one action path per candidate

## Required Modules

### Module 1. Comparison Header

Required content:

- page title
- quick session context
- count of compared candidates

Optional:

- back to results

### Module 2. Summary Recommendation Bar

Purpose:

- surface the top-level tradeoff before the grid

Required content:

- cheapest option
- safest option if different
- optional short recommendation statement

Example:

- `Cheapest: Candidate A`
- `Lowest risk: Candidate B`
- `Best if you want the lowest fare with stable verification: Candidate A`

This should remain factual, not prescriptive.

### Module 3. Candidate Header Row

Per candidate, show:

- short route label
- booking type badge
- risk badge
- optional shortlist marker

### Module 4. Verified Price And Freshness Row

Required content per candidate:

- verified price
- displayed price if different
- freshness label
- handoff confidence cue

This should be the strongest row in the comparison.

### Module 5. Booking Type And Risk Row

Required content:

- single booking or separate tickets
- low/medium/high risk
- one short explanation if needed

Examples:

- `Separate tickets - medium risk`
- `Single booking - low risk`

### Module 6. Route Summary Row

Required content:

- outbound and return city path
- high-level route shape

This row should be compact, not full itinerary detail.

### Module 7. Stopover Details Row

Required content:

- stopover cities
- stop durations
- whether stopovers are meaningful/intentional

### Module 8. Total Travel Time Row

Required content:

- total trip travel time
- optional note if one option is materially shorter

### Module 9. Baggage / Fare Notes Row

Required content:

- baggage summary
- fare-brand differences if important

Keep this row concise.

### Module 10. Verification Behavior Row

Purpose:

- compare how stable or unstable the candidates were through verification

Required content:

- stable through verification
- repriced
- unavailable previously
- stale / needs re-check

This is one of the key trust rows and should not be omitted.

### Module 11. Recommendation Explanation Row

Purpose:

- summarize what makes each option appealing

Examples:

- `Cheapest because return departs from Chengdu`
- `Higher fare, but single booking and fresher verification`
- `Longer trip time, but includes a 3-day Shanghai stopover`

### Module 12. Action Row

Required actions per candidate:

- `View Details`
- `Open in Trip.com` or `Re-verify`, depending on state
- `Shortlist`

## Required States

### State A. Clean Comparison

- both candidates fresh and comparable
- no major warning state

### State B. Mixed Trust Comparison

- one candidate fresh
- one candidate aging, stale, or repriced
- trust differences clearly visible

### State C. Stitched Versus Single Booking

- the comparison strongly hinges on booking-type tradeoff
- risk explanation becomes especially important

### State D. No Longer Comparable

- one candidate unavailable or too stale
- screen should still preserve transparency, but suggest re-verification or replacement

## Interaction Rules

### Entering Compare View

- should come from results overview or candidate detail
- preserve the selected candidates

### Removing A Candidate

- user should be able to remove one candidate and return to a 1- or 2-candidate comparison state

### Re-Verification

- if a candidate is stale, `Re-verify` should be available directly in the comparison row or action area

### Opening In Trip.com

- only primary when the candidate meets handoff confidence requirements

## Copy Guidance

Use:

- comparative, factual phrasing
- explicit trust language
- short tradeoff statements

Good:

- `Lower fare, but higher self-transfer risk`
- `More stable through verification`
- `Shorter overall travel time`

Avoid:

- oversimplified "best overall" claims with no basis
- verbose explanation blocks in every row
- emotionally loaded warnings

## Wireframe Notes

- do not let the grid become a spreadsheet wall
- verified price row should dominate visually
- trust differences should be legible in one scan
- route and stopover rows should remain concise
- action row should make the next step obvious for each candidate

## Success Criteria

The wireframe is good enough when:

- a user can compare 2-3 candidates without getting lost
- price, trust, and risk differences are all obvious
- stitched versus single-booking tradeoffs are clear
- the screen supports choice rather than just showing data

## Next Step

After this screen, the next logical design artefact is a shared state matrix for badges, labels, and CTA priority so the whole UI system stays consistent.

