# FlyEasy Candidate Detail Wireframe Spec

## Purpose

Define the exact low-fidelity wireframe structure for the Candidate Detail screen.

This is the deepest trust surface in the product: the place where a user decides whether an itinerary is worth pursuing.

## Screen Role

The Candidate Detail screen should help the user answer:

- is this itinerary truly attractive
- how stable is the price
- what is the booking risk
- am I ready to open this in Trip.com

It should feel like a trust and decision surface, not just an itinerary dump.

## Primary User Goals

- understand the itinerary fully
- verify whether the price is trustworthy
- understand the practical booking risk
- compare this candidate mentally to alternatives
- decide whether to re-verify, shortlist, or hand off to Trip.com

## Information Priority

1. Verified price and freshness
2. Handoff readiness
3. Route and stopover structure
4. Risk and booking type
5. Verification history and changes
6. Supporting fare and baggage details

## Desktop Layout

### Overall Structure

Use a two-column layout with a dominant content column and a narrower trust/action column.

Recommended desktop regions:

1. top app shell
2. candidate header
3. main content split:
   - left: route and supporting detail
   - right: price, trust, and actions

### Left Column

Primary content:

- route timeline
- flight legs
- stopover detail
- baggage and fare info
- deeper explanation sections

### Right Column

Primary content:

- verified price
- freshness
- booking type
- risk summary
- handoff readiness
- action cluster
- verification history summary

This right column should be sticky on desktop if feasible at design level.

## Mobile Layout

Use a single-column stacked layout.

Recommended order:

1. candidate header
2. verified price and trust block
3. action cluster
4. route timeline
5. risk and booking explanation
6. verification history
7. baggage/fare details

Mobile must preserve the strength of the trust block near the top.

## Required Modules

### Module 1. Candidate Header

Required content:

- candidate route summary
- booking type badge
- risk badge
- optional quick back to results

### Module 2. Price And Trust Block

Purpose:

- establish whether this itinerary is currently trustworthy enough to act on

Required content:

- verified price
- displayed price if different
- verification freshness
- freshness interpretation
- handoff confidence state

Examples:

- `AUD 612 verified`
- `Trip.com showed AUD 645 before verification`
- `Verified 18m ago`
- `Ready for handoff`

### Module 3. Action Cluster

Required actions:

- `Open in Trip.com`
- `Re-verify`
- `Save to Shortlist`
- `Compare`
- optional `Dismiss`

CTA rules:

- if handoff is blocked, `Re-verify` becomes primary
- if handoff is soft, `Open in Trip.com` may remain primary with caution language

### Module 4. Route Timeline

Purpose:

- make the itinerary understandable at a glance

Required content:

- outbound and return grouping
- airports
- times
- stopover cities
- stop durations

The route timeline should visually distinguish:

- flight segments
- stopovers
- intentional stopovers versus incidental connections when possible

### Module 5. Flight Leg Detail

Required content:

- airline
- flight number
- airport pair
- departure and arrival times
- cabin class when known
- fare brand when known

### Module 6. Booking Risk Block

Purpose:

- explain what the user is taking on if they pursue this option

Required content:

- booking type explanation
- stitched-risk explanation when relevant
- missed-connection exposure
- baggage/check-in implications when known

The tone should be factual, not alarmist.

### Module 7. Verification History Block

Purpose:

- show how this candidate behaved over time

Required content:

- latest verification result
- prior verification events
- repricing or unavailability history
- last meaningful price change

This block should answer:

- did the itinerary stay stable
- has it repriced before
- did it disappear and return

### Module 8. Explanation Blocks

Required explanation sections:

- `Why this is good`
- `What changed during verification`
- `Booking risk`
- `Trip.com handoff readiness`

These should be explicit content blocks, not hidden inside miscellaneous metadata.

### Module 9. Baggage And Fare Block

Required content:

- baggage summary
- fare-brand summary
- notable restrictions if visible

This block is important but secondary to the trust and route information.

## Required States

### State A. Fresh Verified Candidate

- strongest trust state
- handoff ready

### State B. Aging Verified Candidate

- still attractive
- handoff soft-caution state visible

### State C. Stale Candidate

- re-verification becomes primary action
- handoff not primary

### State D. Repriced Candidate

- old and new price relationship visible
- recommendation downgraded

### State E. Unavailable Candidate

- retained for history and transparency
- not a live handoff target

### State F. Stitched Candidate

- separate-ticket structure explained clearly
- risk language factual and calm

## Interaction Rules

### Opening In Trip.com

- only primary when the candidate is eligible for handoff
- always preceded by visible trust state

### Re-Verification

- available from this screen in all but unavailable/terminal contexts
- if re-verification changes state, update trust block immediately

### Shortlisting

- should feel lightweight
- should not remove the candidate from the current view

### Compare

- should preserve this candidate as one side of a future comparison

## Copy Guidance

Use:

- explicit, factual trust language
- practical risk explanation
- concise route and price phrasing

Good:

- `Stable through deep verification`
- `Cheaper because the return departs from Chengdu`
- `Separate tickets: baggage and missed-connection risk may be higher`
- `Needs fresh re-check before handoff`

Avoid:

- marketing-style persuasion
- vague reassurance
- unexplained technical labels

## Wireframe Notes

- the price/trust block should be the most visually dominant module after the page title
- route understanding should come before raw detail tables
- verification history should help interpretation, not feel like logs
- the screen should make it easy to say yes or no to this candidate

## Success Criteria

The wireframe is good enough when:

- a user can quickly understand whether this itinerary is actionable
- the relationship between verified price and freshness is unmistakable
- stitched risk is clear without feeling alarmist
- the handoff action feels earned and trustworthy

## Next Step

After this screen, define the Monitoring / History wireframe spec so the longer-term session story is equally concrete.
