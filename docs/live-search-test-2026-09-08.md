# Christmas 2026 live-search test

Tested on 8 September 2026 (Australia/Sydney). Application source and dependencies were not changed.

## Session

- Name: Christmas 2026 · Melbourne–Guangzhou
- Session: session_1d5fbf13012543df9500ae825565e5ec
- Route: MEL → Guangzhou (CAN) → MEL; fixed Guangzhou return origin.
- Earliest departure: 15 December 2026; latest return: 10 January 2027.
- Duration: 14–21 days; single booking; economy, one adult in the worker's generated query.
- Monitoring disabled. No booking or checkout attempted.
- Test data is in `.tmp/healthcheck/flyeasy.db`, the data directory used by the currently running local server.

## Result: automated fare capture failed

Session creation, persistence and date-pair generation worked. FlyEasy calculated 76 valid date pairs. The first network-enabled query, 15–29 December 2026, failed with:

> Timed out waiting for outbound Trip.com results.

Run: `run_05190de775a94941ac483ff226c919a3`. The worker reached the correct Trip.com results URL and the connection state recorded `ready_public`. No fare candidates had been captured. The worker advanced to 17 December–3 January, but the remaining scan was cancelled after the first timeout established the failed test; the full 76-pair universe was not searched.

A separate browser check of the same route and dates loaded **45 outbound options**. Advertised round-trip prices included AU$1,215 (Batik Air Malaysia/TransNusa via Bali), AU$1,384 (Thai Airways via Bangkok), and AU$1,686 (China Southern direct outbound). These were outbound-selection-stage advertised return prices, not fully selected return itineraries or checkout-verified fares. The browser had a different session from the anonymous automation worker, so this comparison does not prove the root cause.

## Findings

1. **Missing browser runtime causes a stale running state.** The initial checkout had no Playwright Chromium installed. The worker disappeared while the UI and runtime JSON continued to say running/Launching. Browser launch at `scripts/automation/run-baseline-search.mjs:5130` is outside the main try/catch beginning at line 5142; the dispatcher also discards stdout/stderr. Installed the official Playwright Chromium runtime and cancelled the stale run to continue the test.
2. **Automation times out waiting for outbound flight cards.** The network-enabled worker's first real query failed after its result-stage wait. The currently visible website still has `data-testid="u-flight-card-*"` elements, matching the worker's primary selector. A blanket selector rename is therefore not established as the cause. Browser-session differences, headless behavior, and result-page loading need targeted investigation with captured failure-page evidence.
3. **Progress is misleading.** The Results page stayed at “Launching Trip.com search strategies” while a date-pair query was running and after that query failed and the next started. Query failures are persisted in SQLite, but the displayed summary did not communicate them during this test.

An intermediate attempt failed with `ERR_NETWORK_ACCESS_DENIED` inside the workspace sandbox. Repeating the same app worker with approved network access reached Trip.com, so the sandbox error is separate from the later fare-card timeout.

## Next implementation work

- Catch and persist startup failures, including browser launch; capture worker errors and reconcile stale worker PIDs.
- Capture screenshots and page observations on each query timeout, before its page closes, to distinguish blocked/empty pages from extraction failures.
- Show current query dates, completed/failed counts and actionable errors in the Results UI.
- Retest this saved session after fixes, including return selection and persisted itinerary/price accuracy.
