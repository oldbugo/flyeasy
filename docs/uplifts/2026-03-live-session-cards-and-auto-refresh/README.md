# Live Session Cards And Auto Refresh

## Context

The dashboard session cards were still shaped like generic summary cards, while
the product intent for a `live` session had become much stronger: a live
session should feel like an active monitoring workspace, not a saved form.

At the same time, `live` did not yet mean automatic refresh in the app itself.
Monitoring state existed in the data model, but there was no local scheduler,
no per-session cadence control, and no truthful `next refresh` state to expose
in the landing-page cards.

## Goal

- redesign the home-page session cards so they read more like itinerary-led
  monitoring cards
- add real per-session automatic refresh while the local FlyEasy app is open
- make refresh frequency configurable inside the session
- default live-session cadence to a full run every 12 hours

## Scope

Included in this uplift:

- new session-level refresh interval setting
- persisted next-refresh timestamp
- local scheduler tick from the Electron shell
- scheduled monitoring runs that are distinct from manual runs
- richer dashboard query and card presentation

Not included in this uplift:

- background scheduling when the app is fully closed
- OS-native scheduled tasks or daemon/service installation
- fine-grained countdown animations beyond server-rendered relative copy

## Implementation Strategy

1. Extend the `session` model with refresh cadence and next-refresh fields.
2. Make session create/update/toggle flows own that cadence explicitly.
3. Allow run creation to differentiate `manual` and `scheduled` monitoring runs.
4. Add a lightweight local scheduler that calls an internal monitoring tick route
   while Electron is running.
5. Enrich the dashboard session query so cards can render:
   - best price
   - route endpoints
   - current stop chips
   - refresh status
   - next scheduled refresh state

## Outcome

Implemented:

- `session.refresh_interval_hours` with a default of 12 hours
- `session.next_refresh_at` as the next queued monitoring checkpoint
- per-session refresh frequency input in the session editor
- automatic monitoring tick from the Electron main process to a local Next API route
- scheduled run creation through the same run pipeline as manual runs
- redesigned dashboard cards with route visualization and a live-status footer

## Follow-up Notes

- The current scheduler runs only while the local FlyEasy app is open.
- The dashboard status copy is truthful but intentionally conservative: it shows
  active refresh, due/next refresh, or last checked state without pretending to
  be a millisecond-accurate live progress feed.
- If the product later needs always-on monitoring while the app is closed, that
  should be a separate uplift with an OS-level scheduling strategy.
