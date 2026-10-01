# 02 · Candidate Strategies

## Notation and cost model

- `D`: allowed departure dates (n of them). `R`: possible return dates (m).
  `P`: valid (d, r) pairs whose duration is inside the session's range.
- **Screen**: one round-trip results page, outbound list only, with no
  branch clicks. Reads the cheapest round-trip "from" price for the pair.
  Assumed to cost about 10–20 s; spike P0.2 confirms this and confirms the
  price matches the full extraction.
- **OW load**: one one-way results page. Gives the full one-way flight list for
  that date, the cheapest fare per airline (`airlineFilters`), the cheapest
  fare per transit city (`transferFilters`) and a daily one-way calendar
  (`GetLowPriceInCalender`).
- **Verify**: full extraction of one pair, as today (about 40–60 s). This step
  produces bookable candidates.
- Cost is counted in **page loads**. Verifications are counted separately,
  because every strategy ends with K verifications (default K = 5).

| Window | n (depart) | m (return) | \|P\| |
|--------|----:|----:|-----:|
| A: depart 1–31 Dec 2026, 14–21 days | 31 | 38 | 248 |
| B: depart 1 Mar–30 Jun 2027, 14–21 days | 122 | 129 | 976 |

## Hypotheses the strategies depend on

Each strategy is only as good as the hypothesis under it. Doc 03 tests each
hypothesis directly against the ground truth grid.

| ID | Hypothesis | If true, it favours |
|----|-----------|----------------|
| H1 | Price varies strongly across date pairs (top-decile pairs ≥ 15% cheaper than the median) | Any targeted strategy is worth building |
| H2 | Trip.com's calendar prices are accurate (within 5% of the live price) and cover most days | S2 Calendar-first |
| H3 | Round-trip price ranks follow one-way out + one-way return price ranks (Spearman ≥ 0.7) | S3 One-way decomposition |
| H4 | H3 holds much better per airline than overall (round-trip fares need the same airline both ways) | S3b Airline-aware decomposition |
| H5 | Weekday effects are strong and stable (some departure or return weekdays are always cheaper) | S5 Structured sampling |
| H6 | The price surface is locally smooth, with few separate cheap regions (high lag-1 autocorrelation) | S4 Middle-start pattern search |
| H7 | For a fixed departure, price depends more on the return date's weekday than on trip length | S3/S5 separable models |
| H8 | The cheapest outbound-stage price equals the cheapest fully extracted round-trip price | S6 Screen-then-verify (all strategies) |
| H9 | Pair *rankings* stay stable over several days even when price *levels* drift | Reusing priors across runs; multi-day ground truth collection |

## Strategies

### S0 · Exhaustive grid (oracle). Research only

Screen every pair in `P`. This is the ground truth that every other strategy
is scored against. **Cost:** \|P\| screens (A: 248, B: 976). It is never a
product strategy.

### S1 · Even coverage (control)

Today's baseline, re-run inside the replay simulator with the same budget as
the other arms. Variant S1r uses a random offset each run so that repeated
runs cover different pairs (quick win QW1 below).
**Cost:** budget-defined (5–7 verifies today).

### S2 · Calendar-first. Depends on H2

1. Load one one-way outbound page and one one-way return page. Read the daily
   lowest-price calendar for both directions. If the calendar does not span the
   whole window, load more pages.
2. Optionally load one round-trip page near the middle of the window and read
   the sparse departure×return calendar grid.
3. Score every pair in `P` as `cal_out(d) + cal_ret(r)`. Where the round-trip
   grid has a price for a cell, use that price instead.
4. Screen the top 3K pairs, then verify the top K.

**Cost:** about 2–6 loads + 3K screens + K verifies. This is by far the
cheapest if H2 holds.
**Risk:** calendar prices come from Trip.com's cache and can be stale. The
round-trip grid is mostly `-1`. Any `-1` must count as unknown, not as
expensive.

### S3 · One-way decomposition ("single flights first"). Depends on H3

1. Load the one-way outbound page for every date in `D`, and the one-way return
   page for every date in `R`.
2. Score each pair as `ow_out(d) + ow_ret(r)` and rank all of `P`.
3. Screen the top 3K, verify the top K.

**S3b, airline-aware (H4).** Use `airlineFilters` to get the cheapest fare per
airline per date, then score each pair as
`min over airlines a of [ow_out_a(d) + ow_ret_a(r)]`. This directly encodes
the hypothesis that "a particular airline's flight on a particular date is
cheap". It also accounts for round-trip fares that require the same airline
both ways.

**S3c, calendar-seeded.** Use S2's calendar to choose which dates are worth a
real one-way load: the cheapest 40% of days in each direction, plus every
day with a `-1` gap. This cuts the cost by more than half.

**Cost:** n + m loads (A: 69, B: 251) + 3K screens + K verifies. S3c costs
about 0.4·(n+m) loads.
**Risk:** round-trip prices are often not the sum of two one-way fares, and
can be far below it on Chinese carriers. H3 only needs the *ranks* to agree,
not the prices.

### S4 · Middle-start pattern search ("start in the middle"). Depends on H6

1. Start at the middle departure date with the middle duration.
2. Screen the neighbours at step sizes {7, 3, 1} days, first along the
   departure date, then along the return date. Move to the cheapest neighbour.
   Halve the step when no neighbour is cheaper.
3. Restart from 2–3 more starting points (¼, ½ and ¾ of the window) to avoid
   getting stuck in one local minimum.
4. Verify the K best pairs seen.

**Variant S4w, weekly first.** First search with steps of 7 days, which keeps
the weekday fixed and finds the cheapest *week*. Then search ±1–3 days to find
the cheapest *weekday* inside that week. This works with weekly periodicity
(H5) instead of against it.

**Cost:** about 15–30 screens per start point, + K verifies.
**Risk:** fare surfaces are often spiky, with weekday effects and airline
schedules. A pure bisection or hill-climb gets stuck on one-off cheap days.
The data decides this: if lag-1 autocorrelation is low, S4 should be dropped.

### S5 · Structured sampling with an additive model. Depends on H5 and H7

1. Screen a small balanced design, for example a Latin-square-style sample in
   which every departure weekday × return weekday × week-of-window combination
   is covered at least once. That is about 21–35 screens.
2. Fit `price ≈ μ + dep_weekday + ret_weekday + dep_week + duration_bucket`
   (robust least squares).
3. Predict every pair in `P`, screen the top 2K predicted pairs, verify K.

**Cost:** about 25–45 screens + K verifies, and the cost barely grows with the
window size. That makes it attractive for window B.

### S6 · Screen-then-verify (execution layer for all strategies). Depends on H8

This is not a separate way of choosing dates. It changes how *every* strategy
spends its budget: screen many pairs cheaply with an outbound-only load, then
run full branch extraction only for the best K. This is the successive-halving
idea that doc 18 deferred because no cheap preview stage existed. The
`FlightListSearchSSE` response and the outbound "from" price are that preview.
If H8 holds, a budget that buys 5 verifies today buys about 15–20 screens plus
3 verifies.

### S7 · Model-guided active search. Research arm

Fit a surrogate model. Start with S5's additive model, then try a Gaussian
process with a weekly-periodic kernel. Choose each next screen by expected
improvement, seeding the model with S2's calendar prices.
Evaluated offline only at first. It will be adopted only if it clearly beats
S8 on regret.

### S8 · Hybrid (expected winner, to be confirmed by data)

1. **Prior:** S2 calendars (about 2–6 loads).
2. **Candidates:** S3c airline-aware one-way loads on the cheapest days.
3. **Shortlist:** the top 3K pairs by airline-aware score, plus the best 2 pairs
   from S5's model to cover calendar gaps.
4. **Local search:** S4w around the best 2–3 shortlisted pairs (±1–3 days).
5. **Verify:** full extraction of the top K.

The point of doc 03 is to find out which of these stages actually earn their
cost. Any stage that does not improve regret in the offline replay is dropped.

## Expected cost comparison (before data)

| Strategy | A loads (screens + OW) | B loads | Verifies |
|----------|-------:|-------:|---:|
| S0 Exhaustive | 248 | 976 | n/a |
| S1 Even coverage (today, balanced) | 0 | 0 | 5 + 6 anchor follow-ups |
| S2 Calendar-first | ~20 | ~22 | 5 |
| S3 One-way decomposition | ~84 | ~266 | 5 |
| S3c Calendar-seeded one-way | ~45 | ~120 | 5 |
| S4w Middle-start, 3 restarts | ~60 | ~75 | 5 |
| S5 Structured sampling | ~40 | ~50 | 5 |
| S8 Hybrid | ~60 | ~130 | 5 |

The costs for B show why the method matters most for long windows: S5 and S2
barely grow with window size, while S0 and S3 grow linearly.

## Quick wins (independent of the research)

These are cheap, low-risk changes worth making in parallel:

- **QW1. Rotating coverage.** Give `sampleEvenly` a per-run random offset, or
  use a low-discrepancy sequence, and sample over the departure and duration
  dimensions separately. Repeated runs then cover new pairs instead of the
  same 5.
- **QW2. Capture everything we already download.** Record every
  `FlightListSearchSSE` and `GetLowPriceInCalender` response, with no
  three-sample cap, in a research store outside the app database.
- **QW3. Treat empty results as missing, not expensive.** Retry empty pairs
  later in the run, and never let an empty result count as a high price or a
  zero reward.
- **QW4. Price-only reward.** In the adaptive baseline, replace the reward with
  improvement over the best price so far, relative to the run's median price.
  Drop the hard-coded `2200`.
