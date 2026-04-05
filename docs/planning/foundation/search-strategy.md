# FlyEasy Search Strategy Spec

## Purpose

Define how FlyEasy explores the flight search space, how AI is allowed to contribute, and how the system decides which strategies are worth repeating or expanding.

## Objective

Find the cheapest valid, deeply verified itinerary for the requested trip while respecting these hard constraints:

- origin and destination provided by the user
- booking path must be Trip.com
- stopovers must be mainland China only
- allow 0-2 stops
- intentional stopovers must be 1-5 days each
- support both single-booking and stitched itineraries

## Search Model

Treat each search as a point in a constrained search space with these dimensions:

- origin airport
- outbound destination city
- return destination airport
- return origin policy
- outbound date window
- return date window or duration window
- stop count
- candidate stopover cities
- stopover durations
- booking mode
- cabin/fare class

The system should not brute-force the full space. It should use ranked strategies to decide which regions of the space to explore first.

The active session's `search_intensity` should influence how much of this space is explored per run:

- `low`: narrow deterministic baseline and minimal exploratory expansion
- `balanced`: MVP default
- `high`: broader date and city exploration within budget controls

## Strategy Schema

Every strategy, whether authored by a developer or proposed by AI, must normalize into the same shape.

```ts
type StrategyType =
  | "baseline_direct"
  | "baseline_standard_1stop"
  | "baseline_standard_2stop"
  | "one_stop_city_sweep"
  | "two_stop_chain"
  | "open_jaw_return"
  | "stitched_hub_split"
  | "date_neighborhood_expansion"
  | "stopover_duration_expansion"
  | "ai_experimental";

type SearchStrategy = {
  id: string;
  strategyType: StrategyType;
  priority: number;
  reason: string;
  origin: string;
  outboundDestination: string;
  returnDestination: string;
  returnOriginMode: "fixed_city" | "any_mainland_city";
  departureWindow: {
    start: string;
    end: string;
  };
  durationWindowDays?: {
    min: number;
    max: number;
  };
  returnWindow?: {
    start: string;
    end: string;
  };
  candidateStopoverCities: string[];
  maxStops: 0 | 1 | 2;
  stopDurationDays: {
    min: number;
    max: number;
  };
  bookingMode: "single_booking" | "stitched" | "both";
  searchGranularity: "coarse" | "focused" | "micro";
  derivedFromRunIds: string[];
  estimatedSearchCost: number;
};
```

## Initial Strategy Catalog

### 1. `baseline_direct`

Purpose:
Establish the cheapest direct round-trip baseline so all stopover strategies are compared against something concrete.

Behavior:

- search direct outbound and return options
- no intentional stopover logic
- run early in every search cycle

### 2. `baseline_standard_1stop`

Purpose:
Capture the cheapest normal 1-stop Trip.com itinerary without intentionally extending the stop.

Behavior:

- use Trip.com as a standard search channel
- collect cheapest valid 1-stop packaged options
- record hub cities that appear repeatedly

### 3. `baseline_standard_2stop`

Purpose:
Measure whether normal 2-stop packaged itineraries are already competitive before doing custom stopover construction.

Behavior:

- run after direct and 1-stop baselines
- collect only top few results because cost and noise are higher

### 4. `one_stop_city_sweep`

Purpose:
Search for a meaningful stopover in one mainland China city before reaching the final outbound destination.

Behavior:

- evaluate one stopover city at a time
- search multiple stop durations within 1-5 days
- compare packaged and stitched results when available

### 5. `two_stop_chain`

Purpose:
Search for lower prices through two mainland China stopovers.

Behavior:

- restrict to a smaller hub list than 1-stop sweep
- use only after 1-stop evidence suggests savings potential
- mark higher complexity and missed-connection risk for stitched results

### 6. `open_jaw_return`

Purpose:
Exploit the fact that the return may start from any mainland China city.

Behavior:

- outbound still targets Guangzhou
- return explores alternate mainland cities with strong fare history
- combine with one-stop and stitched search where useful

### 7. `stitched_hub_split`

Purpose:
Break the trip into separately priced components when packaged Trip.com results hide cheaper combinations.

Behavior:

- search leg groups independently
- build legal candidate itineraries from compatible legs
- explicitly annotate separate-ticket risks

### 8. `date_neighborhood_expansion`

Purpose:
Exploit nearby dates when a promising itinerary pattern is found.

Behavior:

- expand around best departure dates
- expand around best trip durations
- keep the same city pattern initially

### 9. `stopover_duration_expansion`

Purpose:
Test whether savings improve when the same city pattern uses different stop lengths.

Behavior:

- rerun winning city patterns across 1, 2-3, and 4-5 day buckets
- use only after a city has shown promise

### 10. `ai_experimental`

Purpose:
Let the AI propose novel, bounded strategies based on previous runs.

Behavior:

- must compile down to the validated schema
- may only use mainland China cities
- may not exceed 2 stops or 5-day stopovers
- must include a reason tied to prior result patterns

## Recommended Initial Stopover City Pools

### Tier 1

Use first in broad searches:

- Shanghai
- Beijing
- Chengdu
- Chongqing
- Xiamen
- Hangzhou
- Nanjing
- Kunming

### Tier 2

Use after Tier 1 or when the agent finds evidence:

- Wuhan
- Qingdao
- Xi'an
- Fuzhou
- Tianjin
- Shenyang
- Harbin
- Jinan

These are city-level planning pools. Implementation should later map each city to its relevant airport set.

## Execution Loop

### Phase 1. Seed

Run a broad first pass using:

- `baseline_direct`
- `baseline_standard_1stop`
- `baseline_standard_2stop`
- `one_stop_city_sweep` over Tier 1 cities
- `open_jaw_return` for the strongest return-city candidates

Use coarse date and duration buckets here to identify promising areas quickly.

### Phase 2. Cluster

Group results by:

- stopover city pattern
- stop count
- booking mode
- approximate date shape
- return-city choice

The goal is to identify distinct winning ideas, not just duplicate low-price rows.

### Phase 3. Exploit

Take the best clusters and expand locally with:

- `date_neighborhood_expansion`
- `stopover_duration_expansion`
- `stitched_hub_split`

Only a limited number of winners should be expanded each cycle.

### Phase 4. Verify

Push shortlisted candidates deeper into Trip.com to confirm:

- final payable amount
- current availability
- fare-family differences
- whether the itinerary survives checkout progression

Candidates that fail deep verification should remain visible in history but must be downgraded from live recommendations.

### Phase 5. Learn

Record which strategies produced:

- the lowest verified prices
- the largest price drops
- the highest deep-verification success rate
- the best search-efficiency ratio

This becomes input to the next search cycle.

## Ranking And Scoring

Primary sort order:

1. lowest final verified price
2. lower risk than alternatives at the same price
3. fewer stops at the same price and risk
4. shorter total travel time at the same price and risk

Risk scoring guidance:

- single booking with successful deep verification is lowest risk
- stitched itinerary with generous stop gaps is medium risk
- stitched itinerary with tight timings or overnight dependencies is high risk

The system should display risk clearly, but risk must not outrank a materially cheaper option by default. It is a tie-breaker unless later product decisions change that.

## Search Budgeting

Each run should divide work between exploitation and exploration.

Default budget split:

- 70% proven strategies
- 30% exploratory strategies

Exploratory budget can be spent on:

- Tier 2 cities
- new open-jaw return combinations
- AI-generated strategies
- two-stop patterns not yet tested

## AI Role And Guardrails

AI is allowed to:

- propose new search strategies
- prioritize which patterns to test next
- summarize why a route pattern appears promising
- identify underexplored date or city combinations

AI is not allowed to:

- bypass hard geography constraints
- exceed 2 stops
- exceed 1-5 day stop duration
- invent unsupported booking flows
- change the ranking rule that verified price is primary

Every AI strategy must pass deterministic validation before execution.

Required AI strategy output fields:

- strategy type
- reason linked to historical evidence
- city set
- date or duration focus
- booking mode
- expected value hypothesis

## Monitoring Behavior

Live sessions should rerun proven strategies first and reserve a smaller budget for experimentation.

The monitoring view should highlight:

- newly discovered cheapest verified option
- any candidate that repriced materially
- candidates that disappeared during deep validation
- city patterns that are repeatedly producing good fares

## First Acceptance Bar

The search system is useful enough for v1 when it can:

- run a Melbourne to Guangzhou search with flexible dates
- evaluate direct, one-stop, and two-stop paths
- compare packaged vs stitched candidates
- use mainland China stopovers only
- test alternate return cities inside mainland China
- deeply verify top options in Trip.com
- preserve enough historical run data for the AI to propose a better next search
