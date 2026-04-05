# Next Steps Plan

## Status Legend

- `Complete`: implemented and verified
- `In progress`: partially implemented or actively underway
- `Not started`: planned but not yet implemented

## Strategic Principle

There is no universally best search strategy for this product.

The engine therefore needs to behave like a bounded search portfolio manager,
not a fixed recipe:

- choose among multiple strategy families
- adapt the next wave of work from evidence
- preserve hard constraints and auditability
- stay honest about what is deterministic and what is model-assisted

## Design Principles

### 1. Separate intent, planning, and execution

The system should distinguish between:

- user search intent
- session-level strategy bundle selection
- compiled search program
- execution adapters that run concrete queries

This prevents strategy meaning from being scattered across UI copy, planner
counts, and worker branches.

### 2. Keep every query explainable

Every query should still answer:

- why it exists
- what evidence created it
- what budget bucket it consumed
- what future decisions it can influence

### 3. Keep expansion bounded

Flexibility must not become brute force. Every family should declare:

- cost estimate
- preconditions
- evidence requirements
- stop conditions

### 4. Be honest about suggestion systems

If a feature is deterministic, call it deterministic. If later a real model is
introduced, keep it bounded, explainable, and validated before execution.

## Phase 1: Define The Search Program Model

Status: `In progress`

### Goal

Replace the fixed queue recipe with a compiled search-program model built from
session-selectable strategy bundles instead of raw pass editing.

### Deliverables

- `In progress`: a search-method taxonomy document
- `In progress`: a typed `SearchProgram` or equivalent planning structure
- `Complete`: a strategy-bundle catalog that groups compatible passes into higher-level
  session-facing modules
- `In progress`: strategy-family definitions with:
  - preconditions
  - budget cost
  - evidence inputs
  - outputs
- `Complete`: a session workspace tab for strategy-bundle selection and constrained bundle
  configuration
- `In progress`: a planner refactor that emits executable program nodes instead of a small
  hard-coded list

### Recommended scope

Support at least these families explicitly:

- direct sweep
- anchored date follow-up
- stopover-city follow-up
- alternate return-origin follow-up
- stitched search placeholder vs live stitched adapter
- no-op analysis-only stages

### Session-facing rule

Do not expose foundation passes directly for arbitrary user editing.

Expose:

- one required baseline bundle
- optional companion bundles
- constrained per-bundle controls where safe

This preserves flexibility without allowing incoherent pass combinations.

## Phase 2: Build A Shared Evidence And Scoring Layer

Status: `In progress`

### Goal

Convert recorded observations into reusable planner signals instead of one-off
logic.

### Deliverables

- `In progress`: evidence extractors for:
  - departure dates
  - return dates
  - stopover cities
  - airlines
  - route patterns
  - branch-depth yield
  - cross-run historical winners
- `Complete`: a first historical-prior use in the planner for adaptive direct-sweep
  allocation
- `Complete`: a baseline handoff artifact that now carries:
  - family-level follow-up candidates
  - cheapest city-entry findings
  - a compact city x date x airline matrix
- `Not started`: a scoring model for:
  - expected value
  - confidence
  - novelty
  - execution cost
  - operational risk
- `Not started`: explicit exploration vs exploitation budget allocation

### Expected product effect

The planner can then choose which family to run next instead of always running
the same family order.

## Phase 3: Decouple Query Generation From Playwright Mechanics

Status: `In progress`

### Goal

Make strategy logic independent from Trip.com interaction details.

### Deliverables

- `In progress`: query generators that define the intended search
- `In progress`: execution adapters that translate that query into Trip.com mechanics
- `Complete`: a single-worker live automation queue so shared Trip.com browser
  state is not contended by concurrent workers
- `Complete`: a first true Trip.com multi-city execution adapter for anchored
  three-leg stopover search
- `Not started`: clearer result contracts for:
  - direct round trip
  - anchored direct round trip
  - stopover-focused follow-up
  - stitched search

### Why this matters

Right now, planner semantics and browser tactics are too entangled. This makes
it hard to add new methodology without creating more worker branching and copy
paste logic.

## Phase 4: Expand The Bundle Catalog

Status: `In progress`

### Goal

Grow beyond the first required baseline bundle plus stitched companion bundle.

### Candidate additions

- `Complete`: a dedicated multi-city verification cluster split out from the baseline
- `Complete`: seed-based multi-city verification that reuses bounded family-city baseline contexts
- `Complete`: a dedicated anchored true multi-city search bundle that converts
  baseline city clues into real three-leg Trip.com searches
- `Complete`: a first executable long-stop follow-up pass inside the multi-city cluster
- `Complete`: alternate return-city exploration bundle
- `Complete`: an adaptive coverage baseline bundle for bounded efficiency experiments
- `Complete`: a session-level champion-versus-challenger comparison loop for baseline experiments
- `Complete`: a bounded queued baseline experiment mode with:
  - strategy-tab enablement
  - grouped experiment persistence
  - latest-suite comparison visibility
- conservative low-risk packaged bundle
- broader exploratory bundle
- stronger stopover-city probe bundle

Each new bundle should compile to safe, prevalidated passes rather than expose
raw worker internals directly.

## Phase 5: Replace Misleading AI Framing

Status: `In progress`

### Immediate recommendation

Rename the current feature to something accurate, for example:

- `Suggested follow-up strategies`
- `Deterministic suggestions`
- `System suggestions`

### If real AI is still desired later

Add it only after phases 1 through 3 are in place, and require:

- evidence-backed inputs
- structured output schema
- deterministic validation
- visible rationale linked to real run history
- clear fallback when no model is available

The model should suggest search-program nodes, not mutate execution code paths
directly.

## Phase 6: Improve User Controls And Transparency

Status: `In progress`

### Goal

Expose flexible search posture without making the form overwhelming.

### Candidate additions

- search posture:
  - conservative
  - balanced
  - exploratory
- expansion preferences:
  - favor alternate return cities
  - favor stopover-city experiments
  - favor lower-risk packaged fares
- `Complete`: pass-level strategy explanations, visible toggle state, and inline tooltips
- `Complete`: run budget summary before launch
- `Complete`: round-trip baseline insights board showing cheapest dates, cheapest
  airlines, and cheap date-airline combinations in both strategy and run views
- `Complete`: workspace separation so overview carries concise search summaries,
  results carries detailed insight boards, and search strategy stays focused on
  strategy explanation and control
- `Complete`: expandable results timeline rows and stricter timing-only grouping
  for similar flights
- `Complete`: broader direct-sweep card scanning and cheapest-distinct card
  selection so duplicate clusters do not crowd out the next candidate family
- `Complete`: bounded baseline return-option expansion with family-coverage
  selection and same-family saturation once repeated expansion stops surfacing
  new stopover-city clues
- `Complete`: results visibility for cheapest city-entry baseline clues and cheapest
  verified multi-city outcomes
- `Complete`: baseline candidates now persist visible-card stopover rows so
  later strategies can reuse real stopover cities and intentional-stop counts
- `Complete`: multi-city outcome boards now distinguish cheapest verified
  stopover trips from cheapest intentional multi-city trips within the session
  stop window
- `Complete`: results now explicitly show whether a qualifying multi-city trip
  exists, otherwise surface the cheapest verified fallback and closest miss
- `Complete`: a separate true multi-city outcome board that shows the cheapest
  qualifying anchored multi-city trip beside the cheaper verification cluster
- `Complete`: baseline execution efficiency snapshots and boards so baseline
  strategies can be compared on real runs
- `Complete`: baseline experiment aggregation in overview and results so
  repeated runs can guide future baseline refinements
- `Complete`: a manual queued experiment toggle so compatible baseline arms
  can be launched as one stored suite and reviewed together afterwards
- `Complete`: trip-setting hard filters for included checked baggage and
  mainland China airline-only searches, enforced directly in the live worker
- `Complete`: overview recommendation tabs and results-timeline separation for
  round-trip vs true multi-city candidates
- `Complete`: shared session stop controls so users can stop the current run or
  clear the rest of the session queue from any session tab
- `In progress`: post-run explanation of which strategy families were selected and why

## Recommended Implementation Order

1. `In progress`: Write the search-program and strategy-family design doc.
2. `In progress`: Refactor the planner to emit program nodes without changing live behavior.
3. `Complete`: Add a session strategy tab that exposes bundle selection and safe bundle
   overrides.
4. `In progress`: Move pass-1 and multi-city findings into a reusable evidence layer.
5. `In progress`: Make anchored and stopover follow-up consume that shared evidence layer.
6. `Complete`: Refactor multi-city verification to consume baseline family-city seeds instead of
   raw cheapest stopover candidates.
7. `Complete`: Add multi-city long-stop validation, then a first executable long-stop follow-up,
   and expose the resulting evidence in the UI.
8. `In progress`: Rename the current suggestion UI and proposal copy to accurate deterministic wording.
9. `Not started`: Decide whether real model-backed suggestions are still worth adding after the
   deterministic planner becomes flexible.

## Acceptance Bar For This Uplift Family

This uplift family is on the right track when FlyEasy can:

- represent multiple search families in one compiled search program
- choose later work from scored evidence instead of fixed order alone
- explain every executed query and follow-up reason
- keep Trip.com execution bounded and observable
- stop calling deterministic rule generation `AI`
