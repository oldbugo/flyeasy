// Creates one monitoring session per research period by copying an existing
// session (same route, filters and strategy settings), the way the app's
// "Duplicate" action does, then setting the period's dates and turning on
// 12-hourly monitoring. Monitoring runs only happen while the desktop app is
// open. Re-running the script skips periods that already have a session.
//
// Usage: node scripts/research/create-monitoring-sessions.mjs [sourceSessionId]

import crypto from "node:crypto";

import Database from "better-sqlite3";

import { resolveFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { PERIODS, addDays } from "./lib/periods.mjs";

const REFRESH_INTERVAL_HOURS = 12;
const db = new Database(resolveFlyEasyPaths().dbPath, { fileMustExist: true });
const sourceId = process.argv[2] ?? null;
const source = sourceId
  ? db.prepare("select * from session where id = ?").get(sourceId)
  : db.prepare("select * from session where name not like 'Research ·%' order by created_at asc limit 1").get();

if (!source) {
  console.error("No source session found to copy.");
  process.exit(2);
}

const now = new Date();
const created = [];

for (const [key, period] of Object.entries(PERIODS)) {
  const name = `Research · ${period.label}`;
  if (db.prepare("select id from session where name = ?").get(name)) {
    console.log(`[sessions] "${name}" already exists; skipped.`);
    continue;
  }

  // Stagger the first runs so the two sessions do not queue at once.
  const firstRefresh = new Date(now.getTime() + (key === "A" ? 5 : 90) * 60_000).toISOString();
  const row = {
    ...source,
    created_at: now.toISOString(),
    current_best_candidate_id: null,
    departure_end_date: period.departureEnd,
    departure_start_date: period.departureStart,
    duration_max_days: period.durationMax,
    duration_min_days: period.durationMin,
    id: `session_${crypto.randomUUID().replace(/-/g, "")}`,
    is_live: 1,
    last_run_finished_at: null,
    last_run_started_at: null,
    last_successful_run_id: null,
    lifecycle_state: "live_idle",
    monitoring_state: "enabled",
    name,
    next_refresh_at: firstRefresh,
    refresh_interval_hours: REFRESH_INTERVAL_HOURS,
    return_end_date: addDays(period.departureEnd, period.durationMax),
    updated_at: now.toISOString()
  };
  if ("return_start_date" in source) {
    row.return_start_date = source.return_start_date ? addDays(period.departureStart, period.durationMin) : null;
  }

  const columns = Object.keys(source);
  db.prepare(
    `insert into session (${columns.join(", ")}) values (${columns.map((column) => `@${column}`).join(", ")})`
  ).run(Object.fromEntries(columns.map((column) => [column, row[column]])));
  created.push({ firstRefresh, id: row.id, name });
}

db.close();
for (const session of created) {
  console.log(`[sessions] created "${session.name}" (${session.id}); first monitoring run due ${session.firstRefresh}`);
}
