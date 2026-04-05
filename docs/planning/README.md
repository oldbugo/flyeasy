# Planning Artefacts

This folder holds the working planning documents for FlyEasy.

## Structure

- `foundation/`: product, domain, data, strategy, and automation specifications
- `ux/`: interaction, IA, component, and state-system specifications
- `policies/`: operational policies that govern trust, recovery, monitoring, currency, and lifecycle behavior
- `wireframes/`: screen-by-screen wireframe briefs and low-fidelity interface specifications

## Foundation

- `foundation/product-plan.md`: agreed v1 product plan and constraints
- `foundation/search-strategy.md`: concrete search strategy framework, ranking rules, and AI guardrails
- `foundation/data-model.md`: SQLite schema, entity relationships, and storage rules
- `foundation/database-schema-draft.md`: first-pass SQLite and Drizzle-oriented schema for MVP implementation
- `foundation/api-action-contracts.md`: app-facing read/write contracts for sessions, runs, candidates, settings, and recovery
- `foundation/implementation-backlog.md`: ordered MVP build plan from app shell through automation and AI strategy
- `foundation/domain-model.md`: canonical product objects, naming, and lifecycle boundaries
- `foundation/canonical-state-model.md`: source of truth for lifecycle, monitoring, run, verification, recovery, shortlist, and artifact state values
- `foundation/runtime-architecture.md`: concrete MVP runtime decision for desktop packaging, process boundaries, SQLite location, Playwright worker, and secure local storage
- `foundation/technical-proof-plan.md`: pre-build feasibility gates for Trip.com session reuse, packaged-search extraction, safe verification, and recovery resume
- `foundation/proof-run-log.md`: live record of actual technical proof runs against the automation feasibility plan
- `foundation/automation-spec.md`: Trip.com automation architecture, flows, and safety rules
- `foundation/automation-architecture.md`: bounded execution model and application boundary for Playwright automation
- `foundation/automation-event-schema.md`: normalized event vocabulary for run progress, recovery, verification, and diagnostics
- `foundation/implementation-map.md`: app architecture, route map, module boundaries, and delivery phases

## UX

- `ux/ui-user-flow.md`: key screens, primary journey, and UX review points
- `ux/ux-requirements.md`: UX requirements, interaction rules, and resolved product behavior
- `ux/session-card-models.md`: candidate dashboard card patterns for long-lived trip hunts
- `ux/session-card-spec.md`: exact session card content, hierarchy, and variant rules
- `ux/component-spec.md`: cross-screen component system for badges, cards, trust blocks, and recovery patterns
- `ux/state-matrix.md`: shared labels, badge states, and CTA priority rules across the UI

## Policies

- `policies/verification-policy.md`: freshness rules, re-check triggers, and handoff confidence policy
- `policies/recovery-flow.md`: human takeover, blocked-state handling, and resume rules
- `policies/monitoring-policy.md`: live monitoring behavior, app-open/app-closed semantics, and notification scope
- `policies/currency-policy.md`: display currency, comparison rules, and conversion guidance
- `policies/session-lifecycle-policy.md`: live, not-live, completed, and archived hunt semantics

## Wireframes

- `wireframes/wireframe-brief.md`: screen-by-screen wireframe brief for the first design pass
- `wireframes/session-dashboard-wireframe-spec.md`: exact wireframe spec for the session-first home screen
- `wireframes/session-detail-wireframe-spec.md`: exact wireframe spec for session detail and search setup
- `wireframes/pre-run-review-wireframe-spec.md`: exact wireframe spec for the search confirmation screen
- `wireframes/live-run-progress-wireframe-spec.md`: exact wireframe spec for live search execution and recovery
- `wireframes/results-overview-wireframe-spec.md`: exact wireframe spec for the recommendation and comparison surface
- `wireframes/candidate-detail-wireframe-spec.md`: exact wireframe spec for itinerary trust and handoff
- `wireframes/monitoring-history-wireframe-spec.md`: exact wireframe spec for longitudinal session tracking
- `wireframes/compare-view-wireframe-spec.md`: exact wireframe spec for side-by-side itinerary comparison

## Current Focus

Build a local-first hybrid app that uses browser automation on Trip.com to find and verify cheap flight options for flexible travel to China, with intentional mainland China stopovers.
