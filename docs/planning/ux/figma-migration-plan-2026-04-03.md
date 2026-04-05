# FlyEasy Pencil -> Figma Migration Plan

Date: 2026-04-03

## Goal

Transplant the current Pencil baseline in `D:\flyeasy\designs\flyeasy` into the FlyEasy Figma file with minimal reinterpretation, keeping the current structure, component hierarchy, and screen coverage intact.

## What Was Extracted

- Source file: `D:\flyeasy\designs\flyeasy`
- Export set: `D:\flyeasy\artifacts\figma-migration\2026-04-03\pencil-exports`
- Exported screen references:
  - `SCJHp.png` Home Dashboard Screen
  - `G4b6i.png` New Session Screen
  - `LRMpU.png` Settings Screen
  - `NkKyD.png` Global Settings Screen
  - `bi8Au.png` Overview Screen
  - `1QItq.png` Results Screen
  - `iiziU.png` Candidate Detail Screen
  - `VUSjK.png` History Screen
  - `UexYE.png` Search Strategy Screen
  - `wXNJ7.png` Run Detail Screen
  - `Afaxm.png` Reusable Components lane

## Source Inventory

### Lanes

- `Lane - Reusable Components`
- `Lane - Screens - Main & Setup`
- `Lane - Screens - Session Viewing`
- `Lane - Screens - Monitoring & Analysis`

### Reusable Components

- `Site Header`
- `Route Shell / Session Route Hero`
- `Field / Labeled Input`
- `Field / Textarea`
- `Navigation / Session Tabset`
- `Button / Primary`
- `Button / Secondary`
- `Button / Danger`
- `Button / Icon Primary`
- `Button / Icon Secondary`
- `Toggle / Switch`
- `Pill / Success`
- `Badge / Neutral`
- `Badge / Success`
- `Badge / Warning`
- `Badge / Info`
- `Card / Stat Badge`
- `Card / Metric`
- `Card / Insight Summary`
- `Card / Recommendation`
- `Card / AI Influence`
- `Card / Constraint Toggle`
- `Card / Strategy Pass`
- `Card / Program Step`
- `Card / Suggestion`

### Tokens Visible In Pencil

- Font family: `Inter`
- Display and section type scales are already normalized under `font.size.*`
- Font weights are normalized under `font.weight.*`
- Line heights are normalized under `line.height.*`
- Tracking is normalized under `tracking.*`

Color usage is structurally consistent even though the current Pencil file stores it as direct fills rather than named color variables. The Figma migration should promote these into local color styles or variables instead of leaving them as ad hoc paint values.

## Interpretation Decisions For Figma

These are the migration assumptions I would use in the FlyEasy Figma file:

1. Keep everything on the existing single Figma page for now.
2. Rebuild the Pencil component lane first as a left-hand foundations area on that page.
3. Place the migrated screens to the right of the foundations area in staged horizontal groups:
   - Main and Setup
   - Session Viewing
   - Monitoring and Analysis
4. Promote recurring fills, strokes, and text treatments to Figma variables and text styles while keeping the current visual output stable.
5. Preserve current desktop-first width conventions:
   - Screens remain `1440px` wide
   - Lane wrappers are not migrated; only the actual screens and reusable components are
6. Keep the visual language as-is for pass one:
   - white panels
   - pale slate page background
   - green primary actions and success accents
   - rounded cards and controls
7. Do not redesign during migration. Any design uplift should happen only after a like-for-like Figma baseline exists.

## Staged Execution Plan

### Stage 1: Foundations

- Build the reusable component area first on the existing Figma page.
- Recreate the shared header, buttons, badges, inputs, cards, and route hero.
- Create Figma text styles matching the current type ramp.
- Create Figma color variables for the repeated slate, white, border, green, and success surfaces.
- Validate the component page against `Afaxm.png`.

### Stage 2: Main & Setup

- Rebuild:
  - Home Dashboard Screen
  - New Session Screen
  - Settings Screen
  - Global Settings Screen
- Use the shared header and form/card components rather than redrawing.
- Validate against `SCJHp.png`, `G4b6i.png`, `LRMpU.png`, and `NkKyD.png`.

### Stage 3: Session Viewing

- Rebuild:
  - Overview Screen
  - Results Screen
  - Candidate Detail Screen
- Prioritize the route hero, recommendation cards, insight cards, and detail panels.
- Validate against `bi8Au.png`, `1QItq.png`, and `iiziU.png`.

### Stage 4: Monitoring & Analysis

- Rebuild:
  - History Screen
  - Search Strategy Screen
  - Run Detail Screen
- Prioritize dense operational panels, strategy cards, and monitoring summaries.
- Validate against `VUSjK.png`, `UexYE.png`, and `wXNJ7.png`.

### Stage 5: QA And Normalization

- Check spacing and text-style consistency across all pages.
- Convert any repeated local fills into shared variables/styles.
- Verify all shared elements are component instances rather than detached copies.
- Remove any temporary scaffolding frames used during migration.

## Screen Order To Build

1. Home Dashboard Screen
2. New Session Screen
3. Settings Screen
4. Global Settings Screen
5. Overview Screen
6. Results Screen
7. Candidate Detail Screen
8. History Screen
9. Search Strategy Screen
10. Run Detail Screen

This order front-loads the component-heavy setup surfaces and then moves into increasingly dense operational views.

## One-Page Placement Strategy

- Keep all migrated content on `Page 1`.
- Reserve the far-left area for foundations and reusable components.
- Place the ten screens to the right in three visual groups matching the Pencil lanes.
- Use generous horizontal spacing so future extraction into separate pages remains easy.
- Treat each screen as a top-level frame, not as nested artboards.

## Current Blocker

The migration package is prepared locally, but direct scripted placement into the FlyEasy Figma file is blocked in this session for two reasons:

1. The target FlyEasy Figma file URL or file key is not present in the repo or current prompt.
2. The exposed Figma tool surface in this session does not include the write-capable `use_figma` API required to create or mutate frames in an existing design file.

## Resume Conditions

Direct migration into Figma can resume immediately once both are available:

- a concrete FlyEasy Figma file URL or file key
- a session exposing `use_figma` or equivalent write access to that file

At that point, the execution should follow the staged plan above without needing to rediscover the Pencil baseline.
