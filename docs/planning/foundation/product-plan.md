# FlyEasy V1 Product Plan

## Summary

FlyEasy v1 is a local-first hybrid web app for personal trip planning. It searches Trip.com through browser automation, ranks results by lowest current displayed Trip.com price in MVP, supports both single-booking and stitched itineraries, and allows 1-2 mainland China stopovers of 1-5 days each.

The MVP should stop at result extraction and manual booking handoff. Deep verification inside authenticated Trip.com booking flows is intentionally deferred because the product must avoid any meaningful risk of accidental transaction progression.

For implementation planning, this vision should be split into:

- an MVP that proves the core Trip.com automation and trust loop
- post-MVP expansion for stitched search, broader strategy exploration, and AI-driven optimization

## User Context

- Primary traveler: personal-use first
- Origin: Melbourne, Australia
- Outbound destination: Guangzhou, China
- Return destination: Melbourne, Australia
- Return origin: any mainland China city
- Travel style: flexible dates and duration, price-first
- Stopover goal: intentionally spend a few days in cheaper layover cities
- Booking path: Trip.com only

## Core Product Decisions

- Surface: web app first
- Runtime: desktop-first hybrid local app architecture
- Search mode: interactive search plus local background monitoring
- Ranking default: lowest displayed packaged-search price in MVP
- Layover scope: mainland China only
- Stop pattern: 1-2 stops, 1-5 days each
- Booking models: support both single-booking and stitched itineraries
- Cabin policy: any cabin, cheapest wins
- Trip.com handling: logged-out automation by default in MVP; authenticated automation is post-MVP only if it can be made acceptably safe
- AI posture: bounded assistive layer, introduced after the deterministic trust loop is stable
- Model integration: provider-agnostic AI adapter

## MVP Scope Lock

The first implementation milestone should intentionally narrow scope to reduce delivery risk.

### MVP Must Include

- session-first web app shell
- session creation and editing
- one packaged Trip.com search flow for the core Melbourne to Guangzhou hunt
- candidate extraction into a normalized data model
- results, candidate detail, shortlist, and monitoring history views backed by persisted data
- recovery for public-session automation interruptions and partial reruns

### MVP Should Not Depend On

- stitched itinerary search
- open-jaw return optimization as a required first capability
- multi-strategy breadth beyond a narrow deterministic baseline
- deep verification beyond result-list extraction
- Trip.com-authenticated automation
- AI-generated strategy proposals
- broad desktop-notification or external-notification behavior

### Post-MVP Expansion

After the packaged-search extraction loop is stable, expand into:

- stitched itinerary search and risk scoring
- optional authenticated deep verification with explicit safety controls
- richer return-city exploration
- broader stopover-city and date-neighborhood strategy search
- AI-assisted strategy proposal and prioritization
- deeper monitoring automation and optional notifications

## System Shape

- `Electron` shell for desktop packaging and local process orchestration
- `Next.js` app for UI and local application routes
- `Playwright` for Trip.com automation
- `SQLite` for session history, candidates, monitoring runs, and supporting state
- Local OS-backed encrypted secret storage reserved for future authenticated session material if post-MVP flows ever require it
- AI orchestration layer for strategy generation, prioritization, and summarization

## Key Interfaces

### SearchRequest

The core search request should include:

- origin airport
- primary outbound destination
- departure date window
- return date window or duration window
- return city behavior
- allowed layover geography
- maximum stop count
- stop duration range
- booking mode
- cabin policy

### ItineraryCandidate

Each candidate should capture:

- booking type: single booking or stitched
- ordered leg list
- layover cities
- stop durations
- displayed price
- optional later verified checkout price
- fare class
- availability status
- extraction timestamp
- Trip.com resume URL or replay token
- stitched-ticket risk metadata

### MonitoringRun

Each monitoring execution should store:

- search definition
- run time
- strategies executed
- best current displayed-price candidates
- price changes from prior run
- failures or blocked automation states

## Required Behaviors

### MVP Required Behaviors

- run one deterministic packaged Trip.com search flow for the active session definition
- extract normalized candidates from search results
- show a dashboard with search inputs, ranked candidates, and monitoring history
- preserve clear extraction freshness and recovery state in the UI

### Post-MVP Required Behaviors

- search across direct, 1-stop, and 2-stop options more broadly
- explore intentional mainland-China stopovers rather than only standard connections
- compare packaged Trip.com results against explicitly stitched ticket combinations
- preserve clear labeling between protected single bookings and stitched separate tickets

## Constraints

- Do not automate payment
- Exclude Hong Kong and Macau from valid layovers
- Do not let AI override hard geography, stop-count, or stop-duration rules
- Treat cheapest displayed packaged-search price as the primary MVP ranking signal
- Keep v1 local-first; no hosted backend is required

## Acceptance Direction

The MVP is successful when it can run a Melbourne to Guangzhou packaged Trip.com search with flexible dates, persist candidate results, recover cleanly from public-flow automation interruptions, and present the results in a way that is immediately useful for manual booking handoff.

Post-MVP success extends this to stitched itineraries, broader stopover exploration, and AI-guided strategy expansion.
