import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import {
  ensureFlyEasyPaths,
  resolveBetterSqliteBindingPath,
  resolveFlyEasyAppRoot
} from "../lib/flyeasy-paths.mjs";
import { resolveRuntimeStatePaths } from "./lib/runtime-state.mjs";

const args = process.argv.slice(2);
const isResume = args[0] === "--resume";
const targetRunId = isResume ? args[1] ?? null : args[0] ?? null;
const paths = ensureFlyEasyPaths();
const runtimeDir = path.join(paths.rootDir, "runtime");
const queueLockPath = path.join(runtimeDir, "automation-queue.lock");
const workerScriptPath = fileURLToPath(new URL("./run-baseline-search.mjs", import.meta.url));
const ORPHANED_RUNNING_RUN_GRACE_MS = Number(
  process.env.FLYEASY_ORPHANED_RUNNING_RUN_GRACE_MS ?? 5 * 60_000
);

fs.mkdirSync(runtimeDir, { recursive: true });

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readAutomationPreferences() {
  const filePath = path.join(runtimeDir, "automation-preferences.json");

  if (!fs.existsSync(filePath)) {
    return {
      showAutomationBrowser: true
    };
  }

  return safeJsonParse(fs.readFileSync(filePath, "utf8"), {
    showAutomationBrowser: true
  });
}

function readWorkerState() {
  const { workerStatePath } = resolveRuntimeStatePaths();

  if (!fs.existsSync(workerStatePath)) {
    return null;
  }

  return safeJsonParse(fs.readFileSync(workerStatePath, "utf8"), null);
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(baseIso, minutes) {
  return new Date(new Date(baseIso).getTime() + minutes * 60_000).toISOString();
}

function parseIsoMs(value) {
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isProcessAlive(pid) {
  const normalizedPid = Number(pid);

  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
    return false;
  }

  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch {
    return false;
  }
}

function isWorkerStateActive(workerState) {
  if (workerState?.status === "blocked") {
    return true;
  }

  return workerState?.status === "running" && isProcessAlive(workerState.pid);
}

function usesTripcomWorker(strategyPayloadJson) {
  const payload = safeJsonParse(strategyPayloadJson, {});
  return payload?.engine === "tripcom_live";
}

function listLiveRunsByStatus(db, statuses) {
  return db
    .prepare(
      `select sr.id, sr.session_id as sessionId, sr.status, sr.created_at as createdAt, sr.started_at as startedAt,
              s.monitoring_state as monitoringState, s.refresh_interval_hours as refreshIntervalHours,
              se.strategy_payload_json as strategyPayloadJson
       from search_run sr
       join session s
         on s.id = sr.session_id
       join strategy_execution se
         on se.search_run_id = sr.id
        and se.priority = 0
       where sr.status in (${statuses.map(() => "?").join(", ")})
       order by sr.created_at asc, sr.id asc`
    )
    .all(...statuses)
    .filter((row) => usesTripcomWorker(row.strategyPayloadJson));
}

function reconcileOrphanedRunningRuns(db, workerState) {
  if (isWorkerStateActive(workerState)) {
    return 0;
  }

  const runningLiveRuns = listLiveRunsByStatus(db, ["running"]);
  const timestamp = nowIso();
  let reconciledCount = 0;

  for (const run of runningLiveRuns) {
    const startedAtMs = parseIsoMs(run.startedAt ?? run.createdAt);

    if (
      startedAtMs !== null &&
      Date.now() - startedAtMs < ORPHANED_RUNNING_RUN_GRACE_MS
    ) {
      continue;
    }

    const message =
      "The live worker queue found this run marked as running, but no active Trip.com worker was present. The run was failed automatically so queued runs could continue.";

    db.prepare(
      `update strategy_execution
       set status = 'failed',
           finished_at = ?,
           failure_reason = ?
       where search_run_id = ?
         and status = 'running'`
    ).run(timestamp, message, run.id);

    db.prepare(
      `update strategy_execution
       set status = 'cancelled',
           finished_at = ?,
           failure_reason = ?
       where search_run_id = ?
         and status = 'queued'`
    ).run(timestamp, "Run cancelled after orphaned worker reconciliation.", run.id);

    db.prepare(
      `update search_run
       set status = 'failed',
           finished_at = ?,
           summary_text = 'Trip.com baseline automation failed.',
           failure_reason = ?,
           recovery_state = 'not_required',
           recovery_type = null,
           recovery_reason = null,
           blocked_at = null,
           resume_available = 0,
           resume_mode = null,
           resume_checkpoint_json = null,
           recovery_completed_at = null
       where id = ?`
    ).run(timestamp, message, run.id);

    db.prepare(
      `update session
       set lifecycle_state = ?,
           is_live = ?,
           next_refresh_at = ?,
           updated_at = ?
       where id = ?`
    ).run(
      run.monitoringState === "enabled" ? "live_idle" : "not_live",
      run.monitoringState === "enabled" ? 1 : 0,
      run.monitoringState === "enabled"
        ? addMinutes(timestamp, Number(run.refreshIntervalHours ?? 12) * 60)
        : null,
      timestamp,
      run.sessionId
    );

    reconciledCount += 1;
  }

  return reconciledCount;
}

function selectNextQueuedRun(db, preferredRunId = null) {
  const queuedRuns = listLiveRunsByStatus(db, ["queued"]);

  if (preferredRunId) {
    return queuedRuns.find((row) => row.id === preferredRunId) ?? null;
  }

  return queuedRuns[0] ?? null;
}

function selectBlockedRun(db, runId) {
  if (!runId) {
    return null;
  }

  const row = db
    .prepare(
      `select sr.id, sr.status, se.strategy_payload_json as strategyPayloadJson
       from search_run sr
       join strategy_execution se
         on se.search_run_id = sr.id
        and se.priority = 0
       where sr.id = ?`
    )
    .get(runId);

  if (!row || row.status !== "blocked" || !usesTripcomWorker(row.strategyPayloadJson)) {
    return null;
  }

  return row;
}

function claimRun(db, runId, resumeRequested) {
  const summaryText = resumeRequested
    ? "Manual recovery confirmed. Waiting for the live worker queue to resume this run."
    : "Queued run claimed by the live worker queue. Launching Trip.com automation.";
  const result = db
    .prepare(
      `update search_run
       set status = 'running',
           summary_text = ?,
           failure_reason = null,
           finished_at = null
       where id = ?
         and status = ?`
    )
    .run(summaryText, runId, resumeRequested ? "blocked" : "queued");

  return result.changes > 0;
}

function spawnWorker(runId, resumeRequested) {
  const preferences = readAutomationPreferences();
  // Keep worker output so crashes outside the worker's own error handling can be diagnosed.
  const logDir = path.join(runtimeDir, "worker-logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(path.join(logDir, `${runId}.log`), "a");

  try {
    fs.writeSync(logFd, `\n[${nowIso()}] Starting worker${resumeRequested ? " (resume)" : ""}\n`);
    const child = spawn(process.execPath, [workerScriptPath, runId], {
      cwd: resolveFlyEasyAppRoot(),
      detached: true,
      env: {
        ...process.env,
        FLYEASY_AUTOMATION_HEADFUL: preferences.showAutomationBrowser ? "1" : "0",
        FLYEASY_CAPTURE_SUCCESS_SCREENSHOTS: preferences.captureSuccessScreenshots ? "1" : "0",
        ...(resumeRequested ? { FLYEASY_RUN_RESUME: "1" } : {})
      },
      stdio: ["ignore", logFd, logFd],
      windowsHide: true
    });

    child.unref();
  } finally {
    fs.closeSync(logFd);
  }
}

function main() {
  const workerState = readWorkerState();

  if (isWorkerStateActive(workerState)) {
    return;
  }

  const db = new Database(paths.dbPath, {
    nativeBinding: resolveBetterSqliteBindingPath()
  });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  try {
    reconcileOrphanedRunningRuns(db, workerState);

    const activeLiveRuns = listLiveRunsByStatus(db, ["running", "blocked"]);

    if (activeLiveRuns.length > 0) {
      return;
    }

    const targetRun = isResume ? selectBlockedRun(db, targetRunId) : selectNextQueuedRun(db, targetRunId);

    if (!targetRun) {
      return;
    }

    if (!claimRun(db, targetRun.id, isResume)) {
      return;
    }

    spawnWorker(targetRun.id, isResume);
  } finally {
    db.close();
  }
}

let queueLockFd = null;

try {
  queueLockFd = fs.openSync(queueLockPath, "wx");
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    process.exit(0);
  }

  throw error;
}

try {
  main();
} finally {
  if (queueLockFd !== null) {
    fs.closeSync(queueLockFd);
  }
  fs.rmSync(queueLockPath, { force: true });
}
