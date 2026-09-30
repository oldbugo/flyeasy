import assert from "node:assert/strict";
import path from "node:path";

import Database from "better-sqlite3";
import { chromium } from "playwright";

const baseUrl = process.env.FLYEASY_BASE_URL ?? "http://127.0.0.1:3010";
const dbPath = path.resolve(
  process.env.FLYEASY_PROOF_DB_PATH ?? ".tmp/dev-lifecycle-data/flyeasy.db"
);
const safeProofRoot = path.resolve(".tmp");

assert.ok(
  dbPath.startsWith(`${safeProofRoot}${path.sep}`),
  `Lifecycle proof must use a database below ${safeProofRoot}`
);

const db = new Database(dbPath);
const run = db
  .prepare(
    `select id, session_id as sessionId, status, finished_at as finishedAt,
            summary_text as summaryText
     from search_run
     where status = 'completed'
     order by created_at desc
     limit 1`
  )
  .get();

assert.ok(run, "The proof database needs at least one completed run.");

const setRunState = db.prepare(
  `update search_run
   set status = ?, finished_at = ?, summary_text = ?
   where id = ?`
);
const browser = await chromium.launch({ headless: true });

try {
  setRunState.run("running", null, "Lifecycle proof run is active.", run.id);

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/sessions/${run.sessionId}/results`);
  await page.getByRole("button", { name: "Stop current run", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Lifecycle proof run is active." }).waitFor();

  setRunState.run("completed", run.finishedAt, run.summaryText, run.id);

  await page.getByRole("heading", { name: run.summaryText }).waitFor({ timeout: 15_000 });
  await page
    .getByRole("button", { name: "Stop current run", exact: true })
    .waitFor({ state: "detached", timeout: 15_000 });

  console.log("Completed-run UI refreshed and removed the stale stop control.");
} finally {
  setRunState.run(run.status, run.finishedAt, run.summaryText, run.id);
  db.close();
  await browser.close();
}
