// Creates isolated FlyEasy data folders (fresh migrated database plus one
// queued run) and runs the automation scripts against them.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const seed = JSON.parse(
  fs.readFileSync(new URL("../fixtures/db/example-guangzhou-run.json", import.meta.url), "utf8")
);

export const RUN_ID = seed.search_run.id;
export const SESSION_ID = seed.session.id;

function insertRow(db, table, row) {
  const columns = Object.keys(row);
  db.prepare(
    `insert into ${table} (${columns.join(", ")}) values (${columns.map(() => "?").join(", ")})`
  ).run(...columns.map((column) => row[column]));
}

export function createTestDataDir(name, { preferences } = {}) {
  const dataDir = path.join(repoRoot, ".tmp", "tests", `${name}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dataDir, { recursive: true });

  const migration = spawnSync(process.execPath, [path.join(repoRoot, "scripts/db-migrate.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, FLYEASY_DATA_DIR: dataDir }
  });

  if (migration.status !== 0) {
    throw new Error(`Migrations failed: ${migration.stderr || migration.stdout}`);
  }

  const db = new Database(path.join(dataDir, "flyeasy.db"));
  db.pragma("foreign_keys = ON");
  insertRow(db, "session", seed.session);
  insertRow(db, "search_run", seed.search_run);
  insertRow(db, "strategy_execution", seed.strategy_execution);
  db.close();

  if (preferences) {
    fs.mkdirSync(path.join(dataDir, "runtime"), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "runtime", "automation-preferences.json"),
      JSON.stringify(preferences)
    );
  }

  return dataDir;
}

export function automationEnv(dataDir, origin, overrides = {}) {
  const env = {
    ...process.env,
    FLYEASY_AUTOMATION_HEADFUL: "0",
    FLYEASY_DATA_DIR: dataDir,
    FLYEASY_TRIPCOM_ORIGIN: origin,
    ...overrides
  };
  delete env.FLYEASY_RUN_RESUME;
  return env;
}

export function runNodeScript(scriptPath, args, env, timeoutMs = 240_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, scriptPath), ...args], {
      cwd: repoRoot,
      env,
      windowsHide: true
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${scriptPath} timed out after ${timeoutMs}ms.\n${output}`));
    }, timeoutMs);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

export function runWorker(env, timeoutMs) {
  return runNodeScript("scripts/automation/run-baseline-search.mjs", [RUN_ID], env, timeoutMs);
}

export function openDb(dataDir) {
  return new Database(path.join(dataDir, "flyeasy.db"), { readonly: true });
}

export function readRun(dataDir) {
  const db = openDb(dataDir);
  try {
    return db.prepare("select * from search_run where id = ?").get(RUN_ID);
  } finally {
    db.close();
  }
}

export function readQueries(dataDir) {
  const db = openDb(dataDir);
  try {
    return db
      .prepare("select * from query_execution where search_run_id = ? order by priority, started_at")
      .all(RUN_ID);
  } finally {
    db.close();
  }
}

export function readWorkerState(dataDir) {
  const filePath = path.join(dataDir, "runtime", "automation-worker.json");
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

export function listRunArtifacts(dataDir) {
  const runDir = path.join(dataDir, "artifacts", "baseline-runs", RUN_ID);
  return fs.existsSync(runDir) ? fs.readdirSync(runDir) : [];
}

export async function waitFor(check, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await check();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms.`);
}

// Best-effort: a process that is still shutting down can hold files open on
// Windows, and a leftover folder under .tmp/ should never fail a test.
export function removeDataDir(dataDir) {
  try {
    fs.rmSync(dataDir, { force: true, maxRetries: 10, recursive: true, retryDelay: 300 });
  } catch (error) {
    console.warn(`Could not remove test data ${dataDir}: ${error.message}`);
  }
}
