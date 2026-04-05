# FlyEasy Session Card Spec

## Purpose

Define the exact content, hierarchy, and behavior of the session card so it can be used consistently across dashboard states and breakpoints.

## Role Of The Card

The session card is the primary dashboard object.

Its job is not to explain the whole hunt. Its job is to help the user decide:

- does this session need attention
- is there a promising current outcome
- should I open it now

## Core Design Principle

Use a state-first hierarchy.

The card should answer:

1. what trip is this
2. what state is it in
3. what is the best known outcome
4. what changed
5. what should I do next

## Base Card Anatomy

Use a three-band structure:

### Band 1. Identity

Purpose:

- identify the hunt quickly

Required content:

- session title or route label
- date context
- optional short return rule

### Band 2. State And Outcome

Purpose:

- show whether the session is healthy and whether it has a compelling current result

Required content:

- state badge
- state message
- best verified fare
- verification freshness

### Band 3. Change And Action

Purpose:

- give the user the latest meaningful update and the next action

Required content:

- last meaningful change
- primary CTA
- optional secondary action affordance

## Exact Required Fields

These should appear on every non-empty session card:

1. Session label
2. Trip context line
3. Session state badge
4. State message
5. Best verified fare
6. Verification freshness label
7. Last meaningful change
8. Primary CTA

## Field Definitions

### 1. Session Label

Use one of:

- user-provided session name
- fallback route label if no custom name exists

Examples:

- `China April Hunt`
- `Melbourne -> Guangzhou`

### 2. Trip Context Line

Must include:

- departure window or trip timing cue
- duration or return rule

Example:

- `Apr 5-15 | 3-5 weeks | Return from any mainland China city`

Keep this to one line on desktop and up to two lines on mobile.

### 3. Session State Badge

Allowed values:

- `Live`
- `Needs attention`
- `Not live`
- `Completed`
- `Archived`

Badges should communicate state first, not emotional tone.

### 4. State Message

This is the main operational sentence on the card.

Examples:

- `Monitoring active`
- `Trip.com needs you to log in again`
- `Monitoring paused`
- `Completed and kept for reference`

### 5. Best Verified Fare

Display rules:

- use primary display currency
- always show verified amount, not displayed search price
- do not show multiple prices by default

Example:

- `AUD 612 verified`

### 6. Verification Freshness Label

Use plain language plus compact time cue.

Examples:

- `Verified 18m ago`
- `Verified earlier today`
- `Needs fresh re-check`

### 7. Last Meaningful Change

Examples:

- `New low found: down AUD 34`
- `Best option now via Chengdu`
- `Candidate repriced during verification`
- `No major change since last run`

This line should be concise and scannable.

### 8. Primary CTA

Per state:

- healthy live: `Open Session`
- needs attention: `Resume`
- not live: `Open Session`
- completed: `Review`
- archived: `Restore`

## Optional Fields

Use only when space and clarity allow:

- best stopover pattern
- best option booking type
- small risk cue

Do not let optional fields push out state or freshness.

## Card Variants

### Variant 1. Healthy Live

Required emphasis:

- balanced
- calm
- operationally healthy

Preferred content pattern:

- state badge: `Live`
- state message: `Monitoring active`
- outcome clearly visible
- change line modest

### Variant 2. Needs Attention

Required emphasis:

- issue and recovery dominate

Preferred content pattern:

- state badge: `Needs attention`
- state message describes the problem
- outcome remains visible but secondary
- primary CTA becomes recovery action

### Variant 3. High Opportunity

Required emphasis:

- meaningful outcome improvement is noticeable

Preferred content pattern:

- still use `Live` state first
- visually strengthen outcome or change line
- do not overpower the card with market-style price treatment

### Variant 4. Not Live

Required emphasis:

- session is still relevant but inactive

Preferred content pattern:

- state badge: `Not live`
- state message: `Monitoring paused` or equivalent
- best known verified outcome remains visible

### Variant 5. Completed

Required emphasis:

- session achieved its purpose
- still easy to revisit

Preferred content pattern:

- state badge: `Completed`
- state message: `Completed and kept for reference`

### Variant 6. Archived

Required emphasis:

- historical and low priority

Preferred content pattern:

- quieter visual treatment
- restore CTA visible

## Desktop Density Rules

Desktop should show:

- all required fields
- at most one optional field

Preferred max visible text blocks:

- title
- context line
- state message
- best fare
- freshness
- change line
- CTA row

Avoid multi-line clutter in every band.

## Mobile Density Rules

Mobile should show:

- all required fields except optional metadata
- single visible primary CTA
- secondary actions in overflow

Condense:

- trip context
- change line

Do not remove:

- state
- verified fare
- freshness

## Secondary Actions

Desktop:

- may appear inline in a small action row or hover affordance

Recommended secondary actions:

- `Run now`
- `Pause monitoring`
- `Archive`

Mobile:

- place in overflow menu

## Visual Hierarchy Guidance For Wireframes

In low fidelity, make these distinctions clear:

- session label should be strongest textual anchor in band 1
- state badge and state message should dominate band 2 before the fare
- verified fare should be the strongest numeric element
- change line should read as supplemental, not the card headline

## Do Not Do

- do not show both displayed and verified prices on the card face
- do not show route-leg detail on the dashboard card
- do not expose raw strategy names
- do not let stitched vs single-booking status dominate unless risk is unusually high
- do not turn the card into a mini results page

## Example Wireframe Content

### Healthy Live

```text
China April Hunt
Apr 5-15 | 3-5 weeks | Return from any mainland China city
[Live]
Monitoring active

AUD 612 verified
Verified 18m ago

New low found: down AUD 34
[Open Session]
```

### Needs Attention

```text
China April Hunt
Apr 5-15 | 3-5 weeks | Return from any mainland China city
[Needs attention]
Trip.com needs you to log in again

AUD 612 verified
Verified earlier today

Search paused before verification finished
[Resume]
```

### Not Live

```text
China April Hunt
Apr 5-15 | 3-5 weeks | Return from any mainland China city
[Not live]
Monitoring paused

AUD 645 verified
Needs fresh re-check

No major change since last run
[Open Session]
```

## Success Criteria

The session card spec is good enough when:

- a user can understand card state in under a second
- multiple cards remain easy to compare without reading every line
- live and needs-attention states are unmistakable
- the card invites deeper entry without trying to answer everything

## Next Step

After this card spec, define the Session Detail / Search Setup wireframe spec so the user's next level down is equally concrete.

