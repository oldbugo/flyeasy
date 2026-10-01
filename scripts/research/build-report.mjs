// Builds research/fare-grid/report.json: collection status, analyses A1–A8
// and strategy replay for each period, plus evidence from the app's own run
// history. Synthetic-grid sections test the simulator only and are labelled.
//
// Usage: node scripts/research/build-report.mjs [--quick]

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { resolveFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { runAllAnalyses } from "./lib/analyses.mjs";
import { crossCheckAppRuns, summarizeVerifySpike } from "./lib/cross-check.mjs";
import { buildSyntheticGrid, gridCoverage, loadCollectedGrid } from "./lib/fare-grid.mjs";
import { findFlightListPayload, parseFlightListPayload, summarizeFlightList } from "./lib/parse-flight-list.mjs";
import { PERIODS } from "./lib/periods.mjs";
import { buildSubWindows, replayStrategies } from "./lib/replay.mjs";

const quick = process.argv.includes("--quick");
const researchRoot = path.resolve(process.env.FLYEASY_RESEARCH_DIR ?? "research/fare-grid");

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function collectionStatus(periodKey) {
  const periodDir = path.join(researchRoot, periodKey);
  const datasets = {};
  for (const dataset of ["rt_grid", "ow_out", "ow_ret", "sentinel", "verify", "calendar"]) {
    const records = readJsonl(path.join(periodDir, `${dataset}.jsonl`));
    const byStatus = {};
    for (const record of records) {
      const status = record.status ?? (dataset === "calendar" ? "captured" : "unknown");
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
    datasets[dataset] = {
      byStatus,
      lastObservedAt: records.map((record) => record.observedAt).filter(Boolean).sort().pop() ?? null,
      records: records.length
    };
  }
  const blocks = ["rt_grid", "ow_out", "ow_ret", "sentinel", "verify"]
    .flatMap((dataset) => readJsonl(path.join(periodDir, `${dataset}.jsonl`)))
    .filter((record) => record.status === "blocked")
    .map((record) => ({ key: record.key, observedAt: record.observedAt, text: record.pageState?.text?.trim() ?? null }));
  return { blocks, datasets };
}

// The app's existing runs: the same pairs re-queried over time.
function appRunEvidence() {
  const paths = resolveFlyEasyPaths();
  if (!fs.existsSync(paths.dbPath)) return null;
  const db = new Database(paths.dbPath, { fileMustExist: true, readonly: true });

  try {
    const rows = db
      .prepare(
        `select q.search_run_id run_id, q.started_at,
                json_extract(q.query_input_json, '$.departDate') depart_date,
                json_extract(q.query_input_json, '$.returnDate') return_date,
                json_extract(q.result_summary_json, '$.cheapestPrice') price,
                q.status
         from query_execution q
         where q.query_type = 'direct_round_trip'
         order by q.started_at`
      )
      .all();

    const runs = [...new Set(rows.map((row) => row.run_id))].map((runId) => ({
      runId,
      startedAt: rows.find((row) => row.run_id === runId).started_at
    }));
    const pairKeys = [...new Set(rows.map((row) => `${row.depart_date}_${row.return_date}`))].sort();
    const universe = db
      .prepare("select departure_start_date s, departure_end_date e, duration_min_days dmin, duration_max_days dmax from session")
      .all();

    // H8 early evidence: price-sorted outbound captures vs recorded verified prices.
    const screenChecks = [];
    const runsDir = path.join(paths.artifactsDir, "baseline-runs");
    if (fs.existsSync(runsDir)) {
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
          screenChecks.push({
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
    }

    return {
      pairs: pairKeys.map((key) => ({
        key,
        prices: runs.map((run) => {
          const row = rows.find((entry) => entry.run_id === run.runId && `${entry.depart_date}_${entry.return_date}` === key);
          return row ? row.price ?? null : null;
        })
      })),
      queryCount: rows.length,
      runs,
      screenChecks,
      sessions: universe
    };
  } finally {
    db.close();
  }
}

const report = { generatedAt: new Date().toISOString(), periods: {} };

for (const [periodKey, period] of Object.entries(PERIODS)) {
  const status = collectionStatus(periodKey);
  const collected = loadCollectedGrid(path.join(researchRoot, periodKey), period);
  const collectedCoverage = gridCoverage(collected);
  const hasCollected = collectedCoverage.rtPriced >= collectedCoverage.pairCount * 0.5;

  const synthetic = buildSyntheticGrid(period, { seed: periodKey === "A" ? 11 : 23 });
  const windows = buildSubWindows(synthetic, {
    count: quick ? 12 : periodKey === "A" ? 50 : 150,
    maxDays: periodKey === "A" ? 31 : 60,
    minDays: periodKey === "A" ? 10 : 14,
    seed: periodKey === "A" ? 5 : 9
  });

  // How wrong can the calendar be before calendar-first stops helping?
  // Same synthetic fares each time; only the calendar quality changes.
  const calendarSensitivity = [
    { calendarError: 0.05, label: "5% error" },
    { calendarError: 0.15, label: "15% error" },
    { calendarError: 0.3, label: "30% error" },
    { calendarError: 0.15, calendarMissesSales: true, label: "15% error, misses sale fares" }
  ].map((scenario) => ({
    ...scenario,
    results: replayStrategies(
      buildSyntheticGrid(period, { ...scenario, seed: periodKey === "A" ? 11 : 23 }),
      { budgets: [20, 40], seeds: quick ? 1 : 2, strategyNames: ["S2_calendar", "S1r_rotating", "S5_structured"], windows }
    )
  }));

  report.periods[periodKey] = {
    collected: {
      analyses: hasCollected ? runAllAnalyses(collected) : null,
      coverage: collectedCoverage,
      replay: hasCollected
        ? replayStrategies(collected, {
            seeds: quick ? 1 : 3,
            windows: buildSubWindows(collected, {
              count: periodKey === "A" ? 50 : 300,
              maxDays: periodKey === "A" ? 31 : 60,
              minDays: periodKey === "A" ? 10 : 14,
              seed: 3
            })
          })
        : null
    },
    label: period.label,
    status,
    synthetic: {
      analyses: runAllAnalyses(synthetic),
      calendarSensitivity,
      coverage: gridCoverage(synthetic),
      replay: replayStrategies(synthetic, { seeds: quick ? 1 : 3, windows }),
      windowCount: windows.length
    }
  };
  console.log(`[report] period ${periodKey}: collected ${collectedCoverage.rtPriced}/${collectedCoverage.pairCount} pairs, synthetic replay on ${windows.length} windows`);
}

report.appRuns = appRunEvidence();

// Cross-check research screens against every app run (monitoring and manual).
function appQueriesForCrossCheck() {
  const paths = resolveFlyEasyPaths();
  if (!fs.existsSync(paths.dbPath)) return [];
  const db = new Database(paths.dbPath, { fileMustExist: true, readonly: true });
  try {
    return db
      .prepare(
        `select json_extract(q.query_input_json, '$.departDate') departDate,
                json_extract(q.query_input_json, '$.returnDate') returnDate,
                json_extract(q.result_summary_json, '$.cheapestPrice') price,
                q.started_at startedAt, r.run_mode runMode, s.name sessionName,
                s.restrict_to_chinese_airlines restrictChinese,
                s.require_included_checked_baggage requireBaggage
         from query_execution q
         join search_run r on r.id = q.search_run_id
         join session s on s.id = r.session_id
         where q.query_type = 'direct_round_trip'
           and q.status = 'completed'`
      )
      .all()
      .map((row) => ({ ...row, price: row.price === null ? null : Number(row.price), requireBaggage: Boolean(row.requireBaggage), restrictChinese: Boolean(row.restrictChinese) }));
  } finally {
    db.close();
  }
}

const researchRecords = Object.keys(PERIODS).flatMap((periodKey) =>
  ["rt_grid", "sentinel", "verify"].flatMap((dataset) => readJsonl(path.join(researchRoot, periodKey, `${dataset}.jsonl`)))
);
report.crossCheck = crossCheckAppRuns(researchRecords, appQueriesForCrossCheck());
report.verifySpike = Object.fromEntries(
  Object.keys(PERIODS).map((periodKey) => [
    periodKey,
    summarizeVerifySpike(readJsonl(path.join(researchRoot, periodKey, "verify.jsonl")))
  ])
);

fs.mkdirSync(researchRoot, { recursive: true });
const reportPath = path.join(researchRoot, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report), "utf8");
console.log(`[report] wrote ${reportPath} (${Math.round(fs.statSync(reportPath).size / 1024)} KB)`);
