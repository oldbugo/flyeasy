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

## Step 1 · Build the candidate strategies into the app

The app's experiment mode (doc 21 in the March uplift) already runs 2–4
baseline strategies back to back when the owner presses **Rerun**, and records
each arm's results. The work is to add the new strategies as baselines it can
choose from.

| Arm | What it does | Why it is in the test |
|-----|--------------|----------------------|
| Control | Today's round-trip baseline (even coverage) | Reference |
| S1r Rotating coverage | Even coverage with a different offset each run; departure and trip length sampled separately | Cheapest fix for "every run searches the same 5 pairs". Repeated runs also build up a real price grid over time |
| S5 Weekday sampling | A balanced sample across departure weekday, return weekday and week; fits a simple model; searches the pairs it predicts are cheapest | Tests whether weekday effects can be learnt within a run (H5) |
| S4w Start in the middle | Starts mid-window, steps 7 then 3 then 1 days toward cheaper pairs, restarts from ¼ and ¾ | The owner's "start in the middle" idea (H6) |

Also in this step:

- **Empty results are treated as missing** (QW3). They get one retry later in the
  run and are never scored as expensive.
- **The date window respects `departure_end_date`.** Today the pair generator
  ignores it (doc 03a), so a December session would also search January
  departures.
- **Every arm gets the same budget**, about 8 date pairs. That way a win comes
  from better choices of pair, not from searching more.

One-way-first strategies (S3, S3b) need one-way search support in the worker.
They wait until the data from this plan shows they are worth building.
Calendar-first (S2) is dropped: the calendar is untrusted and not recorded.

## Step 2 · Test plan for each period

| | Period A | Period B |
|---|---|---|
| Session | MEL → Guangzhou, departures 1–31 Dec 2026 | MEL → Guangzhou, departures 1 Mar–30 Jun 2027 |
| Trip length | 14–21 days | 14–21 days |
| Filters | Chinese airlines only (same as the existing session) | Same |
| Experiment mode | On, 4 arms: Control, S1r, S5, S4w | Same |
| Suites | 1 per day for 7 days (press **Rerun** once a day) | 1 per day for 7 days |
| Order | Run A's week first: its fares move fastest | After A |
| Cost per suite | 4 arms × ~8 pairs ≈ 32 searches, about 30 minutes | Same |

The owner creates both sessions in the app (copy "Example Guangzhou trip" and
change the dates and trip length) and presses **Rerun** each day.

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

**Accumulated grid.** Every suite prices around 30 pairs, and S1r keeps
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

- **"Best in suite" is not the true cheapest pair.** A suite covers about 32 of
  the 248 or 976 pairs. Regret measures which arm is better, not how close any
  arm gets to the true optimum.
- **Small samples.** 7 suites per period separates large differences only. Run
  more suites if the result is close.
- **Arms run about 30 minutes apart within a suite.** Prices can drift a little
  in that time. The app chooses the arm order at random for each suite, so the
  drift does not consistently favour one arm.
