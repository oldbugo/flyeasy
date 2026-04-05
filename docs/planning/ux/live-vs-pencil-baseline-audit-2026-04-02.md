# Live vs Pencil Baseline Audit

Date: 2026-04-02
Base URL: `http://127.0.0.1:3000`
Pencil file: `D:\flyeasy\designs\flyeasy`
Playwright artifacts: `D:\flyeasy\artifacts\ui-audit\2026-04-02`
Sample session: `session_3482b3d90794436ca8bb3c2f1f8b2d07`
Sample run: `run_d2c40074ea1c4af1a0131e899351d566`

## Purpose

Record the first live-app baseline against the current Pencil screens so the next pass can focus on correction rather than discovery.

This audit distinguishes between:

- structural drift: layout, sectioning, component hierarchy, or route composition no longer matches Pencil
- fixture drift: the same structure exists, but sample state, copy, or data no longer matches the live seeded dataset
- reuse drift: the live implementation is expressing a repeatable pattern that should be promoted further in the shared component layer or Pencil library

## Method

1. Ran Playwright against the live app on `http://127.0.0.1:3000`.
2. Captured route screenshots and summaries with `scripts/proofs/ui-baseline-audit.mjs`.
3. Compared those captures against the current Pencil screens:
   - `SCJHp` Home Dashboard
   - `G4b6i` New Session
   - `NkKyD` Global Settings
   - `bi8Au` Overview
   - `1QItq` Results
   - `LRMpU` Trip settings
   - `UexYE` Search strategy
   - `VUSjK` Monitoring and history
   - `iiziU` Candidate detail
   - `wXNJ7` Run detail
4. Read the current shared implementation layer in:
   - `src/components/shared/ui.tsx`
   - `src/components/shared/app-shell.tsx`
   - `src/components/sessions/session-route-shell.tsx`
   - `src/components/sessions/session-card.tsx`
   - `src/components/candidates/candidate-card.tsx`
   - `src/components/runs/run-progress-panel.tsx`

## Findings

### 1. Results route is the largest live/Pencil mismatch

Classification: `structural drift`
Severity: high

Live results now centers on a real route-family timeline board with grouped round-trip rows, representative fares, route-family counts, expandable itinerary rows, and supporting metrics. The current Pencil `Results` screen still represents an earlier simplified version with a much lighter timeline placeholder and a grouped recommendation section that no longer carries the same information density.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/results-top.png`
- Pencil: screen `1QItq`

Impact:

- The current Pencil file is no longer a safe implementation source for the results route.
- Any design-driven implementation from Pencil would regress the richer live route-family timeline.

Correction update on 2026-04-02:

- Pencil screen `1QItq` has now been rebuilt to reflect the live route-family model:
  - session action row
  - completed-run timeline copy
  - grouped round-trip family board
  - explicit multi-city section
  - AI influence card
  - search outcome details
  - baseline experiment board
  - duplicate-removal note
- Reusable component `Card / AI Influence` was added to the Pencil library so this pattern can be reused outside the results screen.
- The remaining work for this route is implementation sync in the app build, not another structural Pencil translation pass.

### 2. Run detail in Pencil still reflects a blocked-recovery story, while live run detail is now an operational telemetry workspace

Classification: `structural drift`
Severity: high

The live run route has evolved into a completed-run operations surface with:

- run metrics
- recent events
- strategy queue
- query log
- pass 1 analysis
- multi-city evidence
- preview candidates

The current Pencil `Run detail` screen is still anchored on the blocked/recovery state and only sketches a small subset of that telemetry model.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/run-detail-top.png`
- Pencil: screen `wXNJ7`

Impact:

- The run route needs a fresh Pencil translation based on the current telemetry layout, not an incremental tweak to the old recovery-first version.

Correction update on 2026-04-02:

- Pencil screen `wXNJ7` has been partially corrected to reflect the live completed-run workspace:
  - completed-run hero state
  - monitoring control restored
  - recovery banner removed from the default fixture
  - 2x2 run-metrics grid
  - denser recent-events stack
  - denser strategy-queue stack
  - denser query-log stack

Follow-up correction on 2026-04-02:

- The lower telemetry panels were then densified with stacked detail cards for:
  - pass 1 analysis
  - multi-city evidence
  - preview candidates
- Remaining work for this route is implementation sync and fixture tuning, not another structural Pencil pass.

### 3. History/monitoring is materially denser in the live app than in Pencil

Classification: `structural drift`
Severity: high

The live `Monitoring and history` route contains a long run-history feed and a denser `Recent price observations` stack than the current Pencil screen. Pencil captures the right section family, but it is still a reduced sample rather than a faithful baseline of the built screen.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/history-top.png`
- Pencil: screen `VUSjK`

Impact:

- The current Pencil screen underrepresents the vertical density and repeatable entry patterns that the built route already uses.

Correction update on 2026-04-02:

- Pencil screen `VUSjK` now reflects the live route more closely:
  - shared session-shell actions restored
  - runtime fixture updated to `disabled` / `not_live`
  - monitoring controls preserved
  - run-history feed expanded into the denser live row pattern
  - recent-price observations expanded into a longer stack
  - route-family continuity expanded into the current repeated-card pattern
- Remaining work for this route is implementation sync in the app build rather than another structural Pencil pass.

### 4. Overview is directionally aligned, but Pencil is missing major live sections

Classification: `structural drift`
Severity: medium

The live overview now includes:

- latest outcome callout
- signals grid
- baseline experiment comparison board
- AI influence panel
- grouped recommendation cards
- bottom metrics

Pencil still covers the hero, signals, and recommendations, but it does not yet fully express the live baseline experiment board and AI influence density visible in the current app.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/overview.png`
- Pencil: screen `bi8Au`

Impact:

- Overview should be corrected after results/history/run, but before any implementation pass that depends on Pencil as source of truth.

Correction update on 2026-04-02:

- Pencil screen `bi8Au` now includes the missing support stack from the live route:
  - updated session-shell fixture
  - baseline experiment board
  - reusable AI influence panel
  - recommendation-view toggle above the grouped recommendation cards
- Remaining work for this route is implementation sync in the build rather than another structural Pencil correction.

### 5. Global settings is structurally close, but its state fixtures no longer represent the current runtime baseline

Classification: `fixture drift`
Severity: medium

The overall shell and card layout are still close between live and Pencil, but the runtime state shown in Pencil is more recovery-heavy than the current live baseline. The live page currently shows:

- healthy connection state
- idle automation worker
- empty recovery queue

Pencil still depicts a blocked recovery queue item and a more intervention-heavy operational state.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/global-settings.png`
- Pencil: screen `NkKyD`

Impact:

- Pencil needs at least two explicit fixtures for this route:
  - healthy runtime
  - blocked recovery

Without that split, the design file will keep drifting whenever the seeded runtime state changes.

### 6. Candidate detail is close in shell, but still drifts in trust/stopover fixture content

Classification: `fixture drift`
Severity: low

The live and Pencil candidate detail pages share the same broad structure:

- session hero shell
- summary/trust split
- raw leg structure
- stopovers
- price observations

The remaining mismatch is mostly in the seeded values and badges. Live currently shows `single_booking` and a different stopover/trust payload, while Pencil still uses an older packaged/summary example.

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/candidate-detail.png`
- Pencil: screen `iiziU`

Impact:

- This route does not need redesign first; it needs fixture realignment.

### 7. New session and trip settings are the closest matches

Classification: `minor fixture drift`
Severity: low

These routes are already close between live and Pencil. The differences are mostly:

- default field values
- label copy
- data-state examples

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/new-session.png`
- Pencil: screen `G4b6i`
- Live: `artifacts/ui-audit/2026-04-02/trip-settings.png`
- Pencil: screen `LRMpU`

Impact:

- These are not priority correction targets for the next pass.

### 8. Home dashboard is largely aligned, with small shell and sample-count drift

Classification: `minor fixture drift`
Severity: low

The dashboard session-card direction is now consistent between live and Pencil: hero, grouped `Live hunts` / `Not live` / `Archived`, itinerary-led cards, state pill, status footer, and CTA all line up.

Remaining drift:

- live app currently exposes more `Not live` cards than the Pencil sample
- browser Playwright capture does not show `Quit app`, because that control is hidden outside Electron
- connection-badge wording differs by runtime state (`Trip.com public ready` vs prior connected fixture wording)

Evidence:

- Live: `artifacts/ui-audit/2026-04-02/home.png`
- Pencil: screen `SCJHp`

Impact:

- The dashboard is no longer a major blocker.

## Component Library Uplift Opportunities

These are not full correction items yet. They are the places where the audit shows the current shared layer should become more explicit before or during the next correction pass.

### 1. Promote `SessionRouteShell` to a first-class design-system concept

Evidence in code:

- `src/components/sessions/session-route-shell.tsx`

Why:

- It already defines a stable route-shell family:
  - eyebrow
  - page title
  - session subtitle
  - description
  - badge rail
  - action cluster
  - tab row
  - monitoring control

Pencil currently treats these as related screens, but not yet as a strongly named reusable shell family. The live app shows this shell is now stable enough to promote.

Update on 2026-04-02:

- This has now been promoted in Pencil as a reusable `Shell / Session Route Hero` component.
- Overview, Results, Monitoring and history, Trip settings, Search strategy, Candidate detail, and Run detail now use the shared hero structure with route-specific overrides for content, badges, tab state, and optional action rows.
- The tabs were then split further into a reusable Level 2 `Navigation / Session Tabset`, with the session route hero moved into Level 3 route-shell composition above it.

### 2. Promote run telemetry cards/patterns, not just the run page

Evidence in code:

- `src/components/runs/run-progress-panel.tsx`

Why:

- `Run metrics`
- `Recent events`
- `Strategy queue`
- `Query log`
- `Pass 1 analysis`
- `Multi-city evidence`
- `Preview candidates`

all use the same repeated panel and stacked-entry vocabulary. These should become explicit reusable patterns in Pencil instead of remaining a mostly page-local composition.

### 3. Normalize route-local buttons back through the shared button system

Evidence in code:

- `src/app/page.tsx`
- `src/app/sessions/[sessionId]/history/page.tsx`
- `src/app/sessions/[sessionId]/runs/[runId]/page.tsx`

Why:

There are still several route-local CTA styles that bypass `getButtonClassName`, especially for:

- home hero actions
- history rerun
- run recovery actions
- run stop button

This is a reuse drift signal. The app already has a usable shared button system in `src/components/shared/ui.tsx`, but not every route has converged on it.

### 4. History entries and observations are now strong promotion candidates

Evidence in live UI:

- run-history row
- recent-price row
- route-family continuity row

These currently read as repeated local cards, but the live route density shows they are now mature enough to promote as repeatable patterns in Pencil and potentially code.

## Baseline Status By Route

| Route | Pencil status |
| --- | --- |
| Home dashboard | mostly aligned |
| New session | closely aligned |
| Global settings | structurally aligned, fixture drift |
| Overview | corrected in Pencil, build not yet updated |
| Results | corrected in Pencil, build not yet updated |
| Trip settings | closely aligned |
| Search strategy | mostly aligned |
| Monitoring and history | corrected in Pencil, build not yet updated |
| Candidate detail | mostly aligned, fixture drift |
| Run detail | corrected in Pencil, build not yet updated |

## Recommended Correction Order

1. Global settings fixture split
2. Candidate detail fixture refresh
3. Search strategy small alignment pass
4. New session / trip settings copy and default-value sync

## Immediate Next Step

Use this baseline to drive a correction pass that updates Pencil to the live app in this order:

1. split global settings into stable healthy and blocked-recovery fixtures
2. refresh candidate detail against the current seeded trust and stopover payload
3. promote `SessionRouteShell` and run telemetry patterns in the component audit so the screens are assembled from stable shared pieces
