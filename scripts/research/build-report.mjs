// Builds research/fare-grid/report.json from FlyEasy's own runs, plus a
// synthetic-grid simulator self-test. No Trip.com access: everything here
// reads data the app has already recorded.
//
//   - appRuns:      every direct-sweep query, per pair and run (drift, coverage)
//   - periods.X.app:         a grid of the latest price per pair in the period,
//                            and the hypothesis analyses once enough pairs exist
//   - periods.X.experiments: experiment suites (strategy arms run back to back)
//                            scored against the best price any arm found
//   - periods.X.synthetic:   simulator self-test on invented fares
//
// Usage: node scripts/research/build-report.mjs [--quick]

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { resolveFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { runAllAnalyses } from "./lib/analyses.mjs";
import { buildAppRunGrid, buildSyntheticGrid, gridCoverage, pairKey } from "./lib/fare-grid.mjs";
import { findFlightListPayload, parseFlightListPayload, summarizeFlightList } from "./lib/parse-flight-list.mjs";
import { PERIODS } from "./lib/periods.mjs";
import { buildSubWindows, replayStrategies } from "./lib/replay.mjs";

const quick = process.argv.includes("--quick");
const researchRoot = path.resolve(process.env.FLYEASY_RESEARCH_DIR ?? "research/fare-grid");
// Only prices found under the same filters are comparable. This matches the
// existing session: Chinese airlines only, checked baggage not required.
const FARE_FILTER = { requireBaggage: false, restrictChinese: true };
const MIN_PAIRS_FOR_ANALYSIS = 30;
// The calendar strategy (S2) is excluded: the app does not record calendar
// prices and they are not trusted.
const SIMULATED_STRATEGIES = [
  "S1_even",
  "S1r_rotating",
  "S3_one_way",
  "S3b_airline_one_way",
  "S4w_middle_pattern",
  "S5_structured",
  "S8_hybrid"
];

function readAppQueries(db) {
  return db
    .prepare(
      `select q.id queryId, q.search_run_id runId, q.started_at startedAt, q.status,
              json_extract(q.query_input_json, '$.departDate') departDate,
              json_extract(q.query_input_json, '$.returnDate') returnDate,
              json_extract(q.result_summary_json, '$.cheapestPrice') price,
              r.run_mode runMode, r.trigger_source triggerSource,
              r.strategy_experiment_group_id groupId,
              r.strategy_experiment_arm_key armKey,
              r.strategy_experiment_arm_label armLabel,
              s.name sessionName,
              s.restrict_to_chinese_airlines restrictChinese,
              s.require_included_checked_baggage requireBaggage
       from query_execution q
       join strategy_execution se on se.id = q.strategy_execution_id
       join search_run r on r.id = q.search_run_id
       join session s on s.id = r.session_id
       where q.query_type = 'direct_round_trip'
         -- Only the baseline's own searches (sweep and anchored follow-up), so
         -- every experiment arm is scored on the same 11-search budget.
         and se.strategy_type in ('packaged_direct_sweep', 'packaged_departure_anchor_followup')
       order by q.started_at`
    )
    .all()
    .map((row) => ({
      ...row,
      price: row.price === null || row.price === undefined ? null : Number(row.price),
      requireBaggage: Boolean(row.requireBaggage),
      restrictChinese: Boolean(row.restrictChinese)
    }));
}

function matchesFareFilter(row) {
  return row.restrictChinese === FARE_FILTER.restrictChinese && row.requireBaggage === FARE_FILTER.requireBaggage;
}

// The app's runs so far: which pairs were priced, run by run.
function summarizeRunHistory(queries) {
  const runs = [...new Set(queries.map((row) => row.runId))].map((runId) => ({
    runId,
    startedAt: queries.find((row) => row.runId === runId).startedAt
  }));
  const pairKeys = [...new Set(queries.map((row) => pairKey(row.departDate, row.returnDate)))].sort();
  return {
    pairs: pairKeys.map((key) => ({
      key,
      prices: runs.map((run) => {
        const row = queries.find((entry) => entry.runId === run.runId && pairKey(entry.departDate, entry.returnDate) === key);
        return row ? row.price ?? null : null;
      })
    })),
    queryCount: queries.length,
    runs
  };
}

// H8 evidence from the app's own saved flight-list responses.
function screenChecks(db, artifactsDir) {
  const checks = [];
  const runsDir = path.join(artifactsDir, "baseline-runs");
  if (!fs.existsSync(runsDir)) return checks;
  for (const runDir of fs.readdirSync(runsDir)) {
    for (const file of fs.readdirSync(path.join(runsDir, runDir)).filter((name) => name.endsWith("flight-list-1.json"))) {
      const queryId = file.match(/(query_[0-9a-f]+)/)?.[1];
      const query = db
        .prepare("select json_extract(result_summary_json, '$.cheapestPrice') price, query_input_json input from query_execution where id = ?")
        .get(queryId);
      const summary = summarizeFlightList(
        parseFlightListPayload(findFlightListPayload(JSON.parse(fs.readFileSync(path.join(runsDir, runDir, file), "utf8"))))
      );
      if (!summary || !query) continue;
      const input = JSON.parse(query.input);
      checks.push({
        departDate: input.departDate,
        orderBy: summary.orderBy,
        returnDate: input.returnDate,
        run: runDir.slice(-6),
        screenAny: summary.cheapest.any,
        screenChinese: summary.cheapest.chinese_airlines,
        verified: query.price
      });
    }
  }
  return checks;
}

// Experiment suites: arms of one suite run back to back on the same session,
// so each arm is scored against the best price any arm in that suite found.
// A suite belongs to the period its earliest searched departure falls in. All
// of a suite's searches count, including departures past the period's end:
// app sessions set the latest departure to the latest return date, so a
// December session also searches early-January departures.
function summarizeExperiments(queries, period) {
  const groupStart = new Map();
  for (const row of queries) {
    if (!row.groupId || !row.departDate) continue;
    const current = groupStart.get(row.groupId);
    if (!current || row.departDate < current) groupStart.set(row.groupId, row.departDate);
  }
  const inPeriod = (groupId) => {
    const start = groupStart.get(groupId);
    return Boolean(start) && start >= period.departureStart && start <= period.departureEnd;
  };
  const groups = new Map();
  for (const row of queries) {
    if (!row.groupId || !inPeriod(row.groupId)) continue;
    if (!groups.has(row.groupId)) groups.set(row.groupId, new Map());
    const arms = groups.get(row.groupId);
    const arm = arms.get(row.armKey) ?? { armKey: row.armKey, armLabel: row.armLabel, best: null, queries: 0, startedAt: row.startedAt };
    arm.queries += 1;
    if (Number.isFinite(row.price) && (arm.best === null || row.price < arm.best)) arm.best = row.price;
    arms.set(row.armKey, arm);
  }

  const suites = [...groups.entries()].map(([groupId, arms]) => {
    const prices = [...arms.values()].map((arm) => arm.best).filter(Number.isFinite);
    const suiteBest = prices.length ? Math.min(...prices) : null;
    return {
      arms: [...arms.values()].map((arm) => ({
        ...arm,
        regret: suiteBest && Number.isFinite(arm.best) ? Number((arm.best / suiteBest - 1).toFixed(4)) : null,
        won: suiteBest !== null && arm.best === suiteBest
      })),
      groupId,
      startedAt: [...arms.values()].map((arm) => arm.startedAt).sort()[0],
      suiteBest
    };
  });

  const byArm = new Map();
  for (const suite of suites) {
    for (const arm of suite.arms) {
      const entry = byArm.get(arm.armKey) ?? { armKey: arm.armKey, armLabel: arm.armLabel, queries: 0, regrets: [], suites: 0, wins: 0 };
      entry.suites += 1;
      entry.queries += arm.queries;
      if (arm.won) entry.wins += 1;
      if (arm.regret !== null) entry.regrets.push(arm.regret);
      byArm.set(arm.armKey, entry);
    }
  }

  return {
    arms: [...byArm.values()].map(({ regrets, ...entry }) => ({
      ...entry,
      meanQueries: entry.suites ? Number((entry.queries / entry.suites).toFixed(1)) : null,
      meanRegret: regrets.length ? Number((regrets.reduce((sum, value) => sum + value, 0) / regrets.length).toFixed(4)) : null,
      winRate: entry.suites ? Number((entry.wins / entry.suites).toFixed(3)) : null
    })),
    suites: suites.sort((left, right) => String(left.startedAt).localeCompare(String(right.startedAt)))
  };
}

const paths = resolveFlyEasyPaths();
const db = fs.existsSync(paths.dbPath) ? new Database(paths.dbPath, { fileMustExist: true, readonly: true }) : null;
const queries = db ? readAppQueries(db) : [];
const comparable = queries.filter((row) => row.status === "completed" && matchesFareFilter(row));

const report = {
  appRuns: db ? { ...summarizeRunHistory(queries), screenChecks: screenChecks(db, paths.artifactsDir) } : null,
  fareFilter: FARE_FILTER,
  generatedAt: new Date().toISOString(),
  periods: {}
};
db?.close();

for (const [periodKey, period] of Object.entries(PERIODS)) {
  const appGrid = buildAppRunGrid(comparable, period);
  const appCoverage = gridCoverage(appGrid);
  const synthetic = buildSyntheticGrid(period, { seed: periodKey === "A" ? 11 : 23 });
  const windows = buildSubWindows(synthetic, {
    count: quick ? 12 : periodKey === "A" ? 50 : 150,
    maxDays: periodKey === "A" ? 31 : 60,
    minDays: periodKey === "A" ? 10 : 14,
    seed: periodKey === "A" ? 5 : 9
  });

  report.periods[periodKey] = {
    app: {
      analyses: appCoverage.rtPriced >= MIN_PAIRS_FOR_ANALYSIS ? runAllAnalyses(appGrid) : null,
      coverage: appCoverage,
      minPairsForAnalysis: MIN_PAIRS_FOR_ANALYSIS
    },
    experiments: summarizeExperiments(comparable, period),
    label: period.label,
    synthetic: {
      analyses: runAllAnalyses(synthetic),
      coverage: gridCoverage(synthetic),
      replay: replayStrategies(synthetic, { seeds: quick ? 1 : 3, strategyNames: SIMULATED_STRATEGIES, windows }),
      windowCount: windows.length
    }
  };
  console.log(
    `[report] period ${periodKey}: ${appCoverage.rtPriced}/${appCoverage.pairCount} pairs priced by app runs, ` +
      `${report.periods[periodKey].experiments.suites.length} experiment suites, synthetic replay on ${windows.length} windows`
  );
}

fs.mkdirSync(researchRoot, { recursive: true });
const reportPath = path.join(researchRoot, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report), "utf8");
console.log(`[report] wrote ${reportPath} (${Math.round(fs.statSync(reportPath).size / 1024)} KB)`);
