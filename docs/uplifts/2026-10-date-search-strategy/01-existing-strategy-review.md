# 01 · Existing Strategy Review

Reviewed on 2026-10-01 against `src/lib/search-strategies/catalog.ts`,
`scripts/automation/run-baseline-search.mjs` and the local run history in
`%APPDATA%/FlyEasy/flyeasy.db`.

## How a run spends its budget today

A run is a list of strategy bundles, sorted by priority. The baseline, either
the round-trip baseline or the adaptive coverage baseline, always runs first.
Every later bundle reads the baseline's analysis snapshots: departure anchors,
stopover cities and candidate families.

**Unit of cost.** One "direct sweep query" covers one (depart, return) pair. It
costs 1 + `maxOutboundOptionsPerQuery` page states: the outbound list, then one
return list for each outbound branch clicked. That is about 40–60 s of browser
time. The local history agrees: 5 queries take about 3 minutes.

**Budget by search intensity** (`getSearchIntensityDefaults`):

| Intensity | Direct sweep pairs | Anchor dates × returns | Outbound × return branches per pair |
|-----------|-------------------:|-----------------------:|------------------------------------:|
| low       | 3 | 1 × 2 | 2 × 2 |
| balanced  | 5 | 2 × 3 | 3 × 3 |
| high      | 7 | 3 × 4 | 4 × 4 |

**Size of the search space**:

| Window | Pairs | Balanced coverage |
|--------|------:|------------------:|
| Dec 2026 departures, 14–21 days | 248 | 5 + 6 = **4.4%** |
| Mar–Jun 2027 departures, 14–21 days | 976 | 5 + 6 = **1.1%** |

## Evidence from local runs

Session "Example Guangzhou trip": MEL→CAN, departures 10 Dec–9 Jan, fixed 14
day duration, 31 valid pairs.

| Pair | Run 1 (8 Sep) | Runs 2–4 (30 Sep) | Run 5 (30 Sep) | Run 6 (1 Oct) |
|------|------:|------:|------:|------:|
| 10 Dec → 24 Dec | empty | 1,090 | 1,090 | **1,089** |
| 14 Dec → 28 Dec | empty | empty | 1,366 | 1,366 |
| 18 Dec → 1 Jan | 1,982 | 1,897–1,898 | 1,899 | 1,901 |
| 22 Dec → 5 Jan | 1,921 | 1,754–1,755 | 1,757 | 1,558 |
| 26 Dec → 9 Jan | 1,678 | 1,564–1,566 | 1,568 | 1,792 |

What this shows:

- **Every run queried the same 5 pairs.** `sampleEvenly` is deterministic, so
  six runs over three weeks never looked at the other 26 pairs. Monitoring
  re-runs measure price drift, but they never explore new dates.
- **Prices vary a lot between pairs.** Within one run the spread is 75%
  (1,089 vs 1,901). A sample of 5 can easily miss the cheap pairs.
- **Prices drift between runs.** The 22 Dec pair dropped from 1,755 to 1,558
  in under a day, while 26 Dec rose from 1,566 to 1,792. Any comparison
  between strategies run at different times mixes up strategy quality with
  market movement.
- **Empty results.** 5 of 30 queries returned "empty" results that later
  produced prices. These are extraction or loading failures, not real
  no-flight days. A strategy that treats empty as "expensive" will learn the
  wrong thing.

## Strategy-by-strategy critique

Usefulness ratings are for the goal of finding the cheapest dates.

### Round trip baseline (`price_first_market_scan`), even coverage. Usefulness: Low

`enumerateDatePairs` flattens every (departure, duration) pair into one list,
ordered by departure and then by duration. `sampleEvenly` then picks evenly
spaced indices from that list.

- **Duration is effectively random.** With a duration range, the duration of
  each sampled pair depends on index arithmetic, so the sample is not designed
  across the duration dimension. With a fixed duration it reduces to "every
  Nth departure".
- **Deterministic.** Same window, same pairs, every run (see the evidence
  above).
- **Spends depth before breadth.** Each pair is fully extracted (3 outbound ×
  3 return branches) before we know whether the pair is cheap. About 75% of
  that work is wasted on duplicate candidate families (doc 18 measured a
  74.27% duplication rate).
- **The useful part:** it does give a coarse but unbiased view of the window,
  and it is a sensible **control arm** for experiments.

### Pass-1 analysis + anchored departure follow-up. Usefulness: Medium

This takes the cheapest sampled departure dates as "anchors" and sweeps
durations from them.

- The idea is right: it is one step of coordinate descent (fix the
  departure, vary the return).
- The anchors are chosen from only 3–7 samples, so they are mostly noise. A
  cheap departure *date* is confounded with whichever return date it happened
  to be paired with.
- It never varies the departure date around the anchor (±1–3 days), and it
  ignores the weekly cycle.
- **Keep it as a local-search building block**, fed with better anchors.

### Adaptive coverage baseline (`adaptive_coverage_market_scan`). Usefulness: Low–Medium

This is a UCB-style bandit over departure-date buckets. It adds historical
session priors and a "proximity bonus" around the best pair seen so far.

- **The reward does not match the goal.** The reward is
  `(2200 − price)/120 + 1.25 × families + stopover richness`. Family
  diversity and stopovers are rewarded alongside price, and AU$2,200 is a
  hard-coded constant that will be wrong for other routes and currencies.
- **Too small a budget to learn.** At balanced intensity there are 5 queries
  and a seed of 3, so only **2 queries are adaptive**. A bandit cannot learn
  from 3 observations; its exploration bonuses dominate.
- **Priors come from the same session, by exact date.** That only helps
  repeat monitoring of the same window. Doc 18 measured a 20–42% exact-pair
  hit rate.
- **The useful part:** the proximity bonus (search near the best pair) is real
  local search and is worth keeping.

### Return option expansion. Usefulness for date-finding: Low

This deepens return options for cheap candidate families. It is about family
diversity and stopover clues, not dates. It is off by default, and that
should stay so for date-finding. It can be reused later as the deep stage of
a screen-then-deepen design (strategy S6 in doc 02).

### Recommendation date coverage. Usefulness: Medium, but wrongly placed

This searches nearby dates around the strongest recommendation routes.
Algorithmically, it is the neighbourhood search we want, but it runs **last**
and is presented as UI densification. Its logic belongs in the baseline's
local-search phase.

### Multi-city verification, anchored multi-city, alternate return city. Not date strategies

These answer a different question: which stopover or return city is cheaper.
They are out of scope here, but they all take date anchors from Pass-1, so
today they inherit the weak anchors described above. Better baseline anchors
will improve them for free.

### Stitched value probe. Usefulness: None (misleading)

This multiplies existing packaged fares by a discount (`0.9` by default) to
produce "stitched" candidates. These are **made-up prices, not observations**.
They should be clearly labelled as estimates or turned off until a real
stitched search exists. They must be excluded from any strategy evaluation.

### Strategy experiments (`baseline_parallel_random`). Usefulness: Medium as infrastructure

Champion and challenger arms run **one after another** as separate runs. The
drift evidence above shows prices can move 10%+ within hours. So differences
between arms mix up strategy quality with timing. The "best fare first seen at
query N" metric is measured against the run's own best fare, not the true
optimum. That rewards strategies that search narrowly. The grouping and
storage are useful. The evaluation method needs ground truth (doc 03).

## Cross-cutting problems

1. **No ground truth.** We cannot say how far any run is from the true cheapest
   pair. This blocks every evidence-based strategy decision.
2. **Data already downloaded is thrown away.** Each results page already loads
   the full itinerary list, the lowest price per airline and per transit city,
   and a price calendar. FlyEasy scrapes DOM cards and samples only three API
   responses per run.
3. **No cheap screening stage.** The cheapest round-trip price for a pair can
   probably be read from the outbound list alone. On Trip.com's round-trip
   flow, outbound cards show the round-trip "from" price. This must be
   verified (doc 03, spike P0.2). Today every pair pays for full branch
   extraction.
4. **Calendar structure is ignored.** Weekday effects and airline schedules
   (many routes are not served daily) are never modelled.

## Verdict

| Strategy | Keep? | Role going forward |
|----------|-------|--------------------|
| Even-coverage baseline | Keep | Control arm only |
| Pass-1 + anchored follow-up | Rework | Local-search step fed by better anchors |
| Adaptive coverage | Rework | Keep the proximity search; replace the reward with price-only regret |
| Return option expansion | Keep, off by default | Deep stage of screen-then-deepen |
| Recommendation date coverage | Merge | Fold into baseline local search |
| Multi-city / alternate city | Unchanged | Benefits from better anchors |
| Stitched value probe | Relabel or disable | Synthetic estimate only |
| Strategy experiments | Rework evaluation | Score against ground truth and offline replay |
