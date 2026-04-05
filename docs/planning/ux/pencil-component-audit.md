# Pencil Component Audit

Date: 2026-04-01
File: `D:\flyeasy\designs\flyeasy`

## Purpose

This audit records the current Pencil UI inventory and classifies each notable UI block as one of:

- `component`: reusable master in the standalone `Core Components` group
- `pattern`: repeatable composition built from components, but not promoted to its own reusable master
- `single_use`: screen-specific structure that should stay local for now

## Core Library Organization

The `Core Components` frame is physically grouped into separate category frames so the library mirrors the reuse hierarchy:

- `Layer 1 - Atomic Actions`: `Button / Primary`, `Button / Secondary`, `Button / Danger`, `Toggle / Switch`
- `Layer 1 - Atomic Status`: `Pill / Success`, `Badge / Neutral`, `Badge / Success`, `Badge / Warning`, `Badge / Info`
- `Layer 1 - Atomic Fields`: `Field / Labeled Input`, `Field / Textarea`
- `Layer 2 - Shell And Navigation`: `Site Header`
- `Layer 2 - Data Display`: `Card / Stat Badge`, `Card / Metric`, `Card / Insight Summary`, `Card / Recommendation`, `Card / AI Influence`
- `Layer 2 - Planning And Control`: `Card / Constraint Toggle`, `Card / Strategy Pass`, `Card / Program Step`, `Card / Suggestion`

Rule of thumb:

1. Layer 1 components should be usable directly inside other components.
2. Layer 2 components should usually be composed from Layer 1 primitives.
3. Patterns and single-use sections should not live inside `Core Components`.

## Interaction Reference States

`Layer 1 - Atomic Actions` also includes non-reusable state-reference strips for the atomic action set:

- `Button / Primary States`: `default`, `hover`, `active`, `focus`, `disabled`
- `Button / Secondary States`: `default`, `hover`, `active`, `focus`, `disabled`
- `Button / Danger States`: `default`, `hover`, `active`, `focus`, `disabled`
- `Toggle / Switch States`: `off`, `off / hover`, `on`, `focus`, `disabled`

These state strips are documentation and design-reference frames only. They are not promoted to reusable masters; the reusable masters remain the base atomic action components themselves.

## Reusable Components

| Label | Classification | Subcomponents / Contents | Current Consumers | Notes |
| --- | --- | --- | --- | --- |
| `Site Header` | component | Brand block, nav frame, `Button / Primary`, `Button / Secondary`, `Pill / Success` | Overview, Results, History, Trip settings, Search strategy | Correctly moved out of screens into `Core Components`. |
| `Button / Primary` | component | Label text | Site Header, Overview tabs, Results tabs, History tabs, Trip settings tabs, Search strategy tabs, Overview rerun, Settings save, suggestion accept | Used for active nav/tab states and primary actions. |
| `Button / Secondary` | component | Label text | Site Header, Overview actions, Overview tabs, Results tabs, History tabs, Trip settings tabs, Search strategy tabs, Settings fork save, suggestion dismiss, suggestions refresh | Used for inactive nav/tab states and neutral actions. |
| `Button / Danger` | component | Label text | Overview action row | Used for destructive session actions. |
| `Pill / Success` | component | Label text | Site Header, Overview tab row, Results live status | Used for positive status and monitoring state pills. Larger than the compact status badges below. |
| `Badge / Neutral` | component | Compact uppercase label | `Card / Program Step`, `Card / Strategy Pass` | Stable compact metadata badge for step labels and neutral metadata. |
| `Badge / Success` | component | Compact uppercase label | `Card / Suggestion` | Stable compact positive validation badge. |
| `Badge / Warning` | component | Compact uppercase label | Search strategy suggestions | Used for warning or review-needed validation states. |
| `Badge / Info` | component | Compact uppercase label | `Card / Strategy Pass`, `Card / Suggestion`, `Card / AI Influence` | Stable compact informational badge. |
| `Card / Metric` | component | Eyebrow label, value, body text | Overview metrics, Results metrics | Correct for KPI tiles with identical structure. |
| `Card / Insight Summary` | component | Eyebrow label, title/value, body text | Overview insight grid | Correct for compact insight cards with same layout. |
| `Card / Recommendation` | component | Fare, meta text, outbound card, return card, variants text | Overview recommendations, Results grouped recommendations | Correct for itinerary-summary cards. |
| `Card / AI Influence` | component | Title, `Badge / Info`, summary, rationale | Overview suggestion influence, Results suggestion influence | Added once the built `AiInfluencePanel` needed a shared item card across multiple screens. |
| `Card / Stat Badge` | component | Small label, large value | Overview hero rail, Results hero rail, History hero rail, Trip settings hero rail, Search strategy hero rail, compiled cost callout | Shared top-right badge card and lightweight numeric callout. |
| `Field / Labeled Input` | component | Label, input shell, helper text | Trip settings form, Search strategy pass settings, strategy experiments | Generic display primitive for text, numeric, select, and date-like fields in the current Pencil translation. |
| `Field / Textarea` | component | Label, multiline input shell, helper text | Trip settings notes | Added once notes became a real repeated field primitive instead of a local custom box. |
| `Toggle / Switch` | component | Switch track, knob, label | `Card / Strategy Pass`, strategy experiments | Shared toggle primitive for enabled/off state UI. |
| `Card / Constraint Toggle` | component | Constraint title, description, checkbox marker | Trip settings constraints | Stable card for hard-filter constraint rows. |
| `Card / Strategy Pass` | component | Title, `Badge / Neutral`, `Badge / Info`, summary, `Toggle / Switch`, detail box, settings slot | Search strategy setup | Contains a reusable settings slot so screen instances can add bounded field controls instead of custom local frames. |
| `Card / Program Step` | component | Step badge, strategy title, cost badge, reason text | Search strategy compiled program | Built from compact badge primitives instead of embedded raw badge chrome. |
| `Card / Suggestion` | component | Title, `Badge / Info`, validation badge, summary, rationale, `Button / Primary`, `Button / Secondary` | Search strategy suggestions | Carries status and rationale structure internally rather than relying on screen-local substitutes. |

## Patterns

These are repeatable structures, but they are currently better represented as compositions of existing components rather than promoted to new masters.

| Label | Classification | Built From | Why Not a Standalone Component Yet |
| --- | --- | --- | --- |
| `Overview tab row` | pattern | `Button / Primary`, `Button / Secondary`, `Pill / Success` | Composition is simple and state-driven; no extra unique structure beyond spacing. |
| `Results tab row` | pattern | `Button / Primary`, `Button / Secondary` | Same composition as overview without monitoring pill. |
| `History tab row` | pattern | `Button / Primary`, `Button / Secondary` | Same as results, active tab differs by state only. |
| `Overview hero` | pattern | `Card / Stat Badge`, button components | Repeats page-shell logic but content and controls vary by route. |
| `Search Insight Summary` | pattern | `Card / Insight Summary` | Container is reusable in concept, but only one concrete use currently. |
| `Top Recommendations` | pattern | `Card / Recommendation` | Container and section chrome are shared ideas, but only one concrete composition exists. |
| `Results hero` | pattern | `Card / Stat Badge`, tab-row pattern | Same structural family as overview and history hero blocks. |
| `Grouped Recommendations` | pattern | `Card / Recommendation` | Already correctly built from a reusable card; section wrapper can stay local for now. |
| `History hero` | pattern | `Card / Stat Badge`, tab-row pattern | Same structural family as overview and results hero blocks. |
| `Trip settings hero` | pattern | `Card / Stat Badge`, button components | Same route-shell family as the other session pages. |
| `Search strategy hero` | pattern | `Card / Stat Badge`, button components | Same route-shell family as the other session pages. |
| `Trip settings form` | pattern | `Field / Labeled Input`, `Field / Textarea`, `Card / Constraint Toggle`, button components | Built from stable field and action primitives, but the full form wrapper is still route-specific. |
| `Search strategy setup` | pattern | `Card / Strategy Pass`, `Field / Labeled Input`, `Toggle / Switch`, compact badges | Repeated section family, but still too tied to this route's strategy catalog to promote as one master. |
| `Compiled search program` | pattern | `Card / Program Step`, `Card / Stat Badge` | Strongly repeatable internally, but only one current consumer. |
| `System suggestions` | pattern | `Card / Suggestion`, `Button / Secondary` | Correctly assembled from components, but only one route owns the wrapper. |

## Single-Use Structures

These are currently specific to one screen, or they do not yet have enough repeated evidence to justify promotion.

| Label | Classification | Screen | Notes |
| --- | --- | --- | --- |
| `Latest Outcome` | single_use | Overview | Distinct callout panel. Could become a reusable route-summary panel later if another screen needs it. |
| `Live Timeline Panel` | single_use | Results | Complex, highly route-specific board. Keep local until a second consumer exists. |
| `Monitoring Controls` | single_use | History | Purpose-built action panel. |
| `Run History` | single_use | History | Section wrapper is unique; child entries are repeated but history-only for now. |
| `Recent Price Observations` | single_use | History | Repeated internal entry cards exist, but only within history. |
| `Route-family Continuity` | single_use | History | Repeated internal entry cards exist, but only within history. |
| `Fork Recommendation` | single_use | Trip settings | Specific warning callout tied to session forking logic. |
| `Strategy experiment mode summary` | single_use | Search strategy | Current explanatory note is tied to this route's experiment behaviour. |
| `Dashboard hero` | single_use | Home Dashboard | Distinct product-level welcome panel, not a session route surface. |
| `Global connection state` | single_use | Global Settings | Operational card tied to the Trip.com readiness workflow. |
| `Run recovery card` | single_use | Run Detail | Purpose-built recovery callout for blocked Trip.com runs. |

## Repeated Items Not Yet Promoted

These are repeated inside a single screen and should be watched, but they are not promoted yet.

| Label | Current Classification | Parent | Suggested Trigger For Promotion |
| --- | --- | --- | --- |
| `Run history entry` | pattern-in-place | `Run History` | Promote if used in another screen or if history gets more entry variants or states. |
| `Price observation entry` | pattern-in-place | `Recent Price Observations` | Promote if reused in candidate detail or overview/history summaries. |
| `Route-family continuity entry` | pattern-in-place | `Route-family Continuity` | Promote if reused in compare/history/detail views. |
| `Round-trip route board` | pattern-in-place | `Live Timeline Panel` | Promote only if another route board uses the same interaction model. |
| `Multi-city route board` | pattern-in-place | `Live Timeline Panel` | Same decision as round-trip route board. |
| `Strategy cluster article` | pattern-in-place | `Search strategy setup` | Promote only if another route or admin view reuses the same article shell with the same heading and pass-card stack. |
| `Dashboard session card` | pattern-in-place | `Home Dashboard` | Promote only if the same hunt-card layout appears outside the landing dashboard. |
| `Run telemetry card` | pattern-in-place | `Run Detail` | Promote only if run metrics, queue, query, and evidence panels converge on a shared card system across multiple routes. |

## Screen Status

| Screen | Header Uses Component | Top-Right Badges Use Component | Tabs Use Components | Main Sections Built From Components | Notes |
| --- | --- | --- | --- | --- | --- |
| `Home Dashboard` | yes | n/a | n/a | yes | Uses the shared site header and core buttons; dashboard hunt cards mirror the built route-board and status-footer structure, but remain a dashboard-local pattern instead of a promoted master. |
| `New Session` | yes | n/a | n/a | yes | Reuses the session-form field system and create-flow action state. |
| `Overview Screen` | yes | yes | yes | yes | Metrics, insights, recommendations, baseline lab, and suggestion influence are represented in Pencil. |
| `Results Screen` | yes | yes | yes | yes | Route board, grouped recommendations, AI influence, detailed search evidence, baseline lab, and duplicate-removal notice are represented in Pencil. |
| `History Screen` | yes | yes | yes | partial | Hero and tabs are component-driven; history-specific entries remain local patterns. |
| `Trip settings` | yes | yes | yes | yes | Form fields, constraint cards, notes, and footer actions use the core library. |
| `Search strategy` | yes | yes | yes | yes | Strategy passes, compiled program, and deterministic suggestions are built from reusable composites and primitives. |
| `Candidate Detail` | yes | yes | yes | partial | Reuses the results-shell hero and core action buttons; the handoff and raw-data panels remain route-local. |
| `Run Detail` | yes | yes | yes | yes | Reuses the history-shell hero and core action buttons; telemetry panels remain route-local, and the multi-city evidence board is represented in Pencil. |
| `Global Settings` | yes | n/a | n/a | partial | Uses the shared site header and core buttons; operational status panels remain route-local. |

## Coverage Review

Current coverage conclusion:

- Every non-redirect route in the build has a Pencil screen counterpart.
- The route-level surfaces flagged in the audit are represented in Pencil.
- Remaining gaps are mostly about promotion and reuse quality, not missing built sections.

Current watch items:

- `Dashboard session card` is now visually closer to the built `SessionCard`, but it is still a dashboard-local pattern rather than a promoted reusable master.
- `Run telemetry card` remains a strong candidate if run-detail panels begin converging across routes.

## Implementation Findings From Build

The code-side implementation now exposes a clearer equivalent to the Pencil hierarchy and should keep informing the design audit:

- `src/components/shared/ui.tsx` is now the code-side atomic/composite layer. It owns shared button treatment, status pills, section surfaces, stat badges, and metric cards instead of leaving that chrome embedded inside route screens.
- `SessionRouteShell` is the strongest evidence for a higher-level `Session Hero` pattern. It consistently combines hero copy, top-right stat badges, an action row, and a tab row, so Pencil should continue treating that as a route-shell family rather than several unrelated screen headers.
- `AppShell` confirms that `Site Header` is correctly a layer-2 shell component in Pencil, not a screen-local pattern.
- `CandidateCard` and `SessionCard` remain the most structurally informative composite cards in the build. They should continue to influence whether `Card / Recommendation` and `Dashboard session card` stay separate or converge further.
- The build needed a stronger token layer in `globals.css` to support the Pencil look. If Pencil evolves the palette, surfaces, or elevation system, the code-side token layer should be updated in step so the shared components stay visually aligned.

## Redirect-Only Routes

These route paths currently redirect to another screen and therefore do not require their own Pencil screen at this stage:

- `/sessions/[sessionId]/compare` -> `/sessions/[sessionId]/results`
- `/sessions/[sessionId]/review` -> `/sessions/[sessionId]`

## Current Decision Rules

1. Promote to `component` when the structure is reused across screens or clearly serves as a stable primitive.
2. Keep as `pattern` when the real reuse is compositional and existing core components already cover it.
3. Keep as `single_use` when the block is screen-specific, high-context, or not yet proven to repeat.
4. Prefer building screen sections from core components before inventing more component masters.

## Next Candidates

If the design expands further, the strongest candidates for promotion are:

- `Run history entry`
- `Price observation entry`
- `Route-family continuity entry`
- `Strategy cluster article`
- `Dashboard session card`
- `Run telemetry card`
- a higher-level `Session Hero` shell if more routes or screens adopt the same exact hero structure
