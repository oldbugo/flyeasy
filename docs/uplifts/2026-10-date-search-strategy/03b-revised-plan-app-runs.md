# 03b · Revised Plan: Test Strategies Inside FlyEasy

Status: `Current plan` (replaces the data collection in doc 03, Phase 1)

## Why the plan changed

Doc 03 planned to collect a complete price grid for each period with a
research collector, then replay strategies offline. Trip.com blocked every
automated client Claude could run (doc 03a). The owner decided to drop the
research automation and go back to the original approach: test strategies
through FlyEasy's own runs and analyse what they find.

Removed: the grid collector, the collection-day driver, the monitoring-session
script, the cross-check against research data, and the price-calendar parser.

Kept, because none of it touches Trip.com:

- `scripts/research/lib/analyses.mjs`: hypothesis analyses. They run on
  whatever pairs the app has priced.
- `scripts/research/lib/strategies.mjs`, `replay.mjs`, `fare-grid.mjs`:
  strategy functions and the synthetic-grid simulator.
- `scripts/research/build-report.mjs`: reads the app's database and builds the
  dashboard report.

## Data source

FlyEasy's own baseline runs, started by the owner in the app, using its normal
visible browser at its normal pace. There is no separate research collection.
If Trip.com keeps blocking the app's worker, no new data arrives, and decisions
rest on the evidence already collected.

**Before anything else:** the app currently shows Trip.com as `blocked`. Open
Trip.com in the app's automation browser and check that searches load before
starting any runs.

## Step 1 · Build the candidate strategies into the app (done)

The app's experiment mode (doc 21 in the March uplift) already runs 2–4
baseline strategies back to back when the owner presses **Rerun**, and records
each arm's results. The new strategies were added as arms it runs.

| Arm | What it does | Why it is in the test |
|-----|--------------|----------------------|
| Control | Today's round-trip baseline (even coverage) | Reference |
| S1r Rotating coverage | Even coverage with a different offset each run; departure and trip length sampled separately | Cheapest fix for "every run searches the same 5 pairs". Repeated runs also build up a real price grid over time |
| S5 Weekday sampling | A balanced sample across departure weekday, return weekday and week; fits a simple model; searches the pairs it predicts are cheapest | Tests whether weekday effects can be learnt within a run (H5) |
| S4w Start in the middle | Starts mid-window, steps 7 then 3 then 1 days toward cheaper pairs, restarts from ¼ and ¾ | The owner's "start in the middle" idea (H6) |

### What was built

- **One planner per strategy** in `scripts/automation/lib/date-planners.mjs`.
  Each one picks the next date pair from the results so far. The search worker
  uses these planners for the experiment arms, and the offline simulator
  (`scripts/research/lib/strategies.mjs`) runs the same code.
- **Arms are date-plan variants of the round-trip baseline.** The baseline
  config has a `samplingModeOverride`, set only on experiment arms. Normal
  runs are unchanged.
- **Equal budget.** Control searches its 5-pair sweep plus 6 anchored follow-ups,
  11 searches at "balanced" intensity. Each date-plan arm spends those same 11
  searches on its own plan and skips the anchored follow-up.
- **The experiment suite** (`src/lib/runs/strategy-experiments.ts`) uses the
  session's selected baseline as the champion. The three date-plan arms fill
  the challenger slots first. With 4 arms, the adaptive coverage baseline no
  longer takes part. Arms run in a random order in each suite.
- **Empty results count as missing.** A planner skips an empty or failed search
  and never treats it as expensive. Retrying it later was not built: it would
  give the new arms extra searches that Control does not get.
- **Latest departure date.** The pair generator now also respects
  `departure_end_date`. The session form saves the latest return date in that
  field, so for app-created sessions nothing changes. Departures run up to the
  latest return date minus the shortest trip length.
- **Tests.** Worker tests run each date plan against the fake Trip.com. They
  check that it searches exactly its budget of distinct pairs, stays inside the
  date window, and is labelled correctly. Unit tests cover the planners'
  budgets. A check on a throwaway database confirmed that a suite creates 4 arms
  of 11 searches each.

One-way-first strategies (S3, S3b) need one-way search support in the worker.
They wait until the data from this plan shows they are worth building.
Calendar-first (S2) is dropped: the calendar is untrusted and not recorded.

## Step 2 · Test plan for each period

| | Period A | Period B |
|---|---|---|
| Session dates (form) | Earliest departure **1 Dec 2026**, latest return **21 Jan 2027** | Earliest departure **1 Mar 2027**, latest return **21 Jul 2027** |
| Departures searched | 1 Dec 2026–7 Jan 2027 | 1 Mar–7 Jul 2027 |
| Trip length | 14–21 days | 14–21 days |
| Filters | Chinese airlines only (same as the existing session) | Same |
| Baseline | **Round trip baseline** selected (the default) | Same |
| Experiment mode | On, **4 arms**: Control, Rotating coverage, Weekday sampling, Start in the middle | Same |
| Search intensity | Balanced (11 searches per arm) | Same |
| Suites | 1 per day for 7 days (press **Rerun** once a day) | 1 per day for 7 days |
| Order | Run A's week first: its fares move fastest | After A |
| Cost per suite | 4 arms × 11 searches = 44 searches, about 35–45 minutes | Same |

### How to run it in the app

1. Open Trip.com in the app's automation browser and check that searches load.
   The app showed "blocked" after the earlier collection attempts.
2. Duplicate "Example Guangzhou trip". In the copy's settings, set the dates
   and trip length from the table, and rename it, e.g. "Test · Dec 2026".
3. On the copy's **Search strategy** tab:
   - keep **Round trip baseline** selected;
   - turn on **Enable queued baseline experiment mode**;
   - set the arm count to **4**;
   - save.
4. Press **Rerun** once a day. The four arms queue and run one after another.
5. After each day, run `node scripts/research/build-report.mjs` and the
   dashboard can be refreshed.
6. After 7 suites, repeat steps 2–5 for March–June 2027.

## Step 3 · Analysis

`node scripts/research/build-report.mjs` reads the app's database. The
dashboard then shows:

**Per suite.** The cheapest price each arm found. Each arm's **regret**: how
much more expensive its best price was than the best price any arm found in
that suite. Which arm won.

**Per period, after 7 suites:**
- each arm's win rate;
- each arm's mean regret;
- mean searches per suite.

**Accumulated grid.** Every suite prices up to 44 pairs (fewer where arms overlap), and S1r keeps
choosing new ones. Within a few days the app has priced enough pairs (30 or
more) for the hypothesis analyses to run on real data:
- A1: how much date choice matters;
- A2: weekday effects;
- A3: whether prices change smoothly from day to day, which decides "start in
  the middle".

**Earlier runs.** Price drift and the H8 check (does the outbound list show the
real round-trip price?), from the app's saved flight lists.

### Decision rule

Adopt an arm as the new default baseline if, in **both** periods:
- its mean regret is at least 2 percentage points lower than Control's, **or**
- it wins at least 4 of the 7 suites.

If no arm qualifies, make S1r the default anyway. It costs the same as Control
and fixes the repeated-pairs problem. Then keep running suites, so the
accumulated grid can answer the remaining hypotheses.

### Limitations

- **"Best in suite" is not the true cheapest pair.** A suite covers at most 44 of
  the 248 or 976 pairs. Regret measures which arm is better, not how close any
  arm gets to the true optimum.
- **Small samples.** 7 suites per period separates large differences only. Run
  more suites if the result is close.
- **Arms run about 10 minutes apart, one after another, within a suite.** Prices can drift a little
  in that time. The app chooses the arm order at random for each suite, so the
  drift does not consistently favour one arm.

## Results log

### Suite 1 · Period A · 2026-10-01

Session "Test · Dec 2026": departures 1 Dec 2026 to 7 Jan 2027, 14–21 days,
Chinese airlines only. All 44 searches succeeded, with no blocks. Each arm made
11 searches.

| Arm (run order) | Best fare | Pair | Regret vs suite best |
|-----|----------:|------|-------:|
| Rotating coverage | A$913 | 1 Dec → 19 Dec | 11.5% |
| Start in the middle | A$1,379 | 29 Dec → 15 Jan | 68.4% |
| **Weekday sampling** | **A$819** | 3 Dec → 18/19 Dec | 0% |
| Control (round-trip baseline) | A$913 | 1 Dec → 15/16/19 Dec | 11.5% |

Observations. One suite is not a verdict.

- **Searching near the best pair is what found the cheapest fare.** Weekday
  sampling reached 1 Dec → 19 Dec (A$913) through its model, then tried the
  departure date one day either side: A$844, then A$819. Control's anchored
  follow-up only varies the **return** date for a fixed departure. Its three
  1 Dec probes all came back A$913, so it never tried 2–3 Dec departures.
- **Start in the middle got stuck.** The middle of a December window is
  Christmas, the most expensive part. All 11 searches went on improving that
  region, and the restarts from ¼ and ¾ of the window never ran.
- **Rotating coverage spread its searches too evenly.** It covered the whole
  window and found the cheap region (1 Dec), but kept no budget for a search
  next to the best pair.
- **The prices so far support the date hypotheses.** The 39 pairs priced so far
  pass A1 (the cheapest 10% are 33% below the median), A2 (weekday effects) and
  A3 (smooth from day to day; lag-1 autocorrelation 0.70). That is still a
  sparse sample.

Bug found and fixed. The worker never selected the run's
`strategy_experiment_group_id`, so suites were never summarised in the app (an
existing bug since v1.0.0). This suite's summary was rebuilt once with the
app's own refresh function.
