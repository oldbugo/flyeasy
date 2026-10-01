# 03 · Test and Analysis Plan

## Approach in one paragraph

Collect a **complete price grid once** for two very different travel periods.
Use it to (a) test the hypotheses in doc 02 directly, and (b) **replay every
strategy offline** against the grid as if it were Trip.com. Offline replay
means each strategy can be scored against the true cheapest pair, on hundreds
of simulated trips, at zero extra scraping cost, and without price drift
between arms. The strategy that wins offline is then built into the app and
checked live.

## Fixed test configuration

| Setting | Value |
|---------|-------|
| Route | MEL → Guangzhou (CAN) → MEL. Fixed return origin, same as the existing sessions |
| Cabin, passengers, currency | Economy, 1 adult, AUD, locale en-AU |
| Stops | Up to 2 (Trip.com default listing, no stopover filter) |
| Trip length | 14–21 days |
| **Period A ("end of this year")** | Departures 1–31 Dec 2026, returns 15 Dec 2026–21 Jan 2027 → **248 pairs** |
| **Period B (Mar–Jun 2027)** | Departures 1 Mar–30 Jun 2027, returns 15 Mar–21 Jul 2027 → **976 pairs** |
| Booking window at collection time | A: 61–112 days out (peak season, prices change quickly). B: 5–10 months out (shoulder season) |

The two periods are deliberately different: a short peak-season window close
to departure, and a long shoulder-season window far from departure. A strategy
has to win in **both** to be adopted.

## Phase 0: Spikes (1 day)

Every later phase depends on these four questions.

| Spike | Question | Method | Pass criterion |
|-------|----------|--------|----------------|
| P0.1 Calendar | How many days does `GetLowPriceInCalender` cover for one-way and round-trip searches? Which cells are `-1`? Do its request parameters let us move the window? | Load 3 one-way and 3 round-trip pages at different dates and record the request and response bodies | Know the coverage per load and the `-1` rate |
| P0.2 Screen validity (H8) | Does the cheapest round-trip "from" price on the outbound list equal the cheapest fully extracted round-trip price? How long does a screen take? | 20 pairs (10 random, 10 known-cheap): screen, then full verify, in the same minute | ≥ 90% exact match, the rest within 2%. A screen takes ≤ ⅓ of a verify |
| P0.3 One-way content | Does a one-way load give `airlineFilters` and `transferFilters` with prices, and a one-way calendar? | 4 one-way loads, both directions | Fields present and parseable |
| P0.4 Pacing | How many loads per sitting before Trip.com shows friction (captcha, empty pages, blocks)? | Increase batch size 20 → 40 → 60 with 5–15 s random gaps | Find a safe batch size. Default to 40 if unclear |

All spikes use the existing anonymous Playwright profile on public search
pages only. No login, and nothing is booked. If Trip.com shows a captcha or a
block, the collector stops and waits; it never tries to get around it.

## Phase 1: Data collection

### Datasets per period

| Dataset | Content | A loads | B loads |
|---------|---------|-------:|-------:|
| `rt_grid` | Screen of **every** pair: cheapest round-trip price, cheapest per airline, cheapest per transit city, card count, raw API response | 248 | 976 |
| `ow_out` | One-way MEL→CAN load for every departure date | 31 | 122 |
| `ow_ret` | One-way CAN→MEL load for every return date | 38 | 129 |
| `calendar` | Every `GetLowPriceInCalender` response seen (free: captured during the loads above), plus a daily snapshot from one fixed page | ~0 extra + 1/day | ~0 extra + 1/day |
| `verify` | Full extraction of 15 random pairs + the 15 cheapest pairs (checks H8 at scale) | 30 verifies | 30 verifies |
| `sentinel` | 6 fixed pairs (2 cheap, 2 median, 2 expensive) re-screened at the start and end of every collection day, to measure drift | ~24 | ~84 |
| **Total** | | **~345 loads** | **~1,310 loads** |

### Collection protocol

- **Random order.** Pairs are shuffled before collection so that drift over
  the collection days is not mixed up with date effects (for example, "late
  December looks expensive only because we collected it last").
- **Batches** of the P0.4 safe size (default 40) with 5–15 s random gaps, and at
  most 6 batches a day. The collector can resume after an interruption and
  skips pairs already collected.
- **Empty or failed loads** are retried once at the end of the batch, then
  marked `missing`. They are never recorded as a price.
- **Every record stores** `observedAt`, the lead time in days, the raw response
  file and the parser version, so analyses can be re-run if a parser changes.
- **Storage:** JSONL plus raw responses under `research/fare-grid/<period>/`.
  This folder is git-ignored. Only analysis outputs are committed.

### Schedule (starting the week of 5 Oct 2026)

| Days | Work |
|------|------|
| 1 | Phase 0 spikes |
| 2–3 | **Period A** collection (~9 batches). A goes first because its prices move fastest. |
| 4–10 | **Period B** collection (~33 batches) |
| +7 days | **Re-snapshot** a random 20% of each grid (A: 50 pairs, B: 200 pairs) to test rank stability (H9) |

**Fallback if Trip.com throttles us:** cut B to every departure date × trip
lengths {14, 17, 21} days (366 pairs). The replay then scores strategies on
that sub-grid only.

## Phase 2: Analysis (deducing the strategy from the data)

Each analysis maps to a hypothesis and has a threshold, so the outcome is a
decision, not just a chart. The results go in `04-analysis-results.md`, with
the charts as committed images or an HTML report.

| # | Analysis | Hypothesis | Output | Decision threshold |
|---|----------|------------|--------|--------------------|
| A1 | Price surface: departure × return heatmap, distribution, spread | H1 | Heatmap and price percentiles | Continue only if the top decile is ≥ 15% below the median |
| A2 | Weekday and week effects: robust two-way effects for departure weekday, return weekday and week of window | H5 | Effect sizes with confidence intervals | Strong if any weekday effect is ≥ 8% of the median and the same in A and B |
| A3 | Smoothness: autocorrelation at lag 1 and lag 7 along departure and along trip length; count of local minima | H6 | Correlogram, minima map | S4 stays only if lag-1 autocorrelation is ≥ 0.5 and there are ≤ 3 basins |
| A4 | Separability: Spearman correlation between the round-trip price and `ow_out + ow_ret`; recall of the true top 10 pairs inside the top 30 by one-way score | H3 | Scatter plot, recall@30 | S3 is viable if Spearman ≥ 0.7 and recall@30 ≥ 0.8 |
| A4b | Airline-aware separability: the same test using per-airline one-way minima | H4 | As A4, per airline | S3b is preferred if recall@30 beats A4 by ≥ 0.1 |
| A5 | Calendar validity: calendar price vs live price; coverage; `-1` rate; staleness vs lead time | H2 | Error distribution | S2 is viable if the median error is ≤ 5%, the 90th-percentile error is ≤ 15%, and coverage is ≥ 80% of days |
| A6 | Screen validity at scale, from `verify` vs `rt_grid` | H8 | Match rate | S6 is adopted if ≥ 90% match within 1% |
| A7 | Drift and stability: sentinel drift per day; Kendall tau between the original grid and the +7 day re-snapshot | H9 | Drift curve, tau | Priors can be reused across runs if tau is ≥ 0.6 |
| A8 | Airline anatomy: which airline is cheapest on which dates; operating weekdays; share of top-decile pairs per airline; round-trip discount vs two one-ways per airline | H4, H5 | Table and calendar strip | Explains *why* certain dates are cheap. Feeds S3b and S5 features |
| A9 | Period comparison: every result above for A vs B | all | Side-by-side table | Only hypotheses that hold in **both** periods shape the default strategy |

**"Start in the middle" is decided by A3.** If the surface has one or two
broad cheap regions, a middle start with pattern search works well. If cheap
pairs are isolated spikes (for example, one airline flying twice a week), a
middle start will miss them. Then S3b and S5 are the right tools.

## Phase 3: Offline strategy replay

### Simulator

- `oracle(pair, kind)` returns prices from the grid: screen, one-way, calendar
  or verify. Every call is charged its load cost.
- Each strategy (S1, S1r, S2, S3, S3b, S3c, S4, S4w, S5, S7, S8) is a **pure
  function** of `(window, oracle, budget, seed)`. That keeps them unit-testable
  and lets them be ported straight into the app later.
- **Noise injection** to test robustness:
  - apply drift sampled from the measured sentinel drift;
  - make a random 10–15% of calls return `missing` (the empty-result rate seen
    in local runs);
  - add calendar staleness from A5.

### Many trips from two grids

One grid gives far more than one test case. Sample **sub-windows** from each
grid and treat each as an independent trip search:

- **A:** 50 sub-windows. Departure windows of 10–31 days with random start
  dates; trip-length ranges drawn from {14–14, 14–17, 14–21, 17–21}.
- **B:** 300 sub-windows. Departure windows of 14–60 days; same trip-length
  ranges.

Each strategy runs on every sub-window with 5 random seeds.

### Metrics

- **Regret** = cheapest price found ÷ true cheapest in the sub-window − 1.
- **Hit@2%** and **Hit@5%**: the share of sub-windows with regret at or below
  2% or 5%.
- **Loads-to-2%**: the median page loads until regret first reaches 2% or
  less.
- **Regret vs budget curves** at 10, 20, 40, 80 and 160 loads.
- **Wall-clock estimate**, using the load timings from P0.2.

### Decision rule

Adopt the **cheapest strategy (in loads)** that, in **both** periods, has:

- median regret ≤ 2%, and
- Hit@5% ≥ 90%, and
- no more than 15% of exhaustive cost.

Ties go to the simpler strategy. If nothing meets the bar, adopt the best
Hit@5% at the balanced-intensity budget, and report the gap.

## Phase 4: Build the winner into the app

- A new baseline bundle in `catalog.ts`, for example
  `calendar_guided_baseline` (the name depends on the winner). It ports the
  strategy function used in the replay.
- The S6 screen stage in `run-baseline-search.mjs`: an outbound-only load for
  screening, with full branch extraction only for the top K.
- Quick wins QW1–QW4 from doc 02.
- Map search intensity to load budgets taken from the regret vs budget curves,
  instead of today's hand-picked 3/5/7.
- Keep `price_first_market_scan` as the control arm for experiments.

## Phase 5: Live validation

- **Interleaved paired arms.** Run the new baseline and the control in the
  same session, alternating queries. Price drift then affects both arms
  equally, unlike today's arms that run one after another.
- **New-window check.** Fresh exhaustive screens of one window that was not
  used in Phases 1–3 (for example, departures 1–21 Jul 2027). Confirm that
  live regret matches the replay's prediction.
- **Second route.** Repeat a light version (A-sized window) on a second route,
  such as SYD→Shanghai (PVG), so the strategy is not tuned only to MEL→CAN.

## Tooling to build (Phase 0 and 1 prerequisites)

| File | Purpose |
|------|---------|
| `scripts/research/lib/tripcom-capture.mjs` | Record `FlightListSearchSSE` and `GetLowPriceInCalender` responses for every load (extends `flight-data-capture.mjs` without the sample cap) |
| `scripts/research/lib/parse-flight-list.mjs` | Structured parser: min price, per-airline minima, per-transit-city minima, itinerary count |
| `scripts/research/lib/parse-calendar.mjs` | Calendar parser: one-way daily and round-trip grid, with `-1` turned into missing |
| `scripts/research/collect-fare-grid.mjs` | Resumable, randomised, batched collector for `rt_grid`, `ow_*`, `verify` and `sentinel` |
| `scripts/research/analyse-fare-grid.mjs` | Analyses A1–A9 → JSON and an HTML report |
| `scripts/research/replay-strategies.mjs` | Simulator and strategy functions → regret tables and curves |
| `tests/unit/research-*.test.mjs` | Parser tests on captured fixtures; strategy tests on synthetic grids with a known optimum |

## Deliverables checklist

- [ ] Phase 0 spike notes (append to this folder as `03a-spike-results.md`)
- [ ] Period A grid collected (≥ 95% of pairs priced)
- [ ] Period B grid collected (≥ 95% of pairs priced, or B-lite)
- [ ] `04-analysis-results.md` with A1–A9 and their decisions
- [ ] `05-replay-results.md` with regret curves and the chosen strategy
- [ ] App implementation + live validation, recorded under Outcome in the README
