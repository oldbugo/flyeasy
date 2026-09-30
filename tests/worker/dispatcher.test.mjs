// Runs the queue dispatcher, which starts the worker as a detached process.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";

import { startFakeTripcom } from "../support/fake-tripcom.mjs";
import {
  automationEnv,
  createTestDataDir,
  readRun,
  removeDataDir,
  RUN_ID,
  runNodeScript,
  waitFor
} from "../support/test-env.mjs";

const TEST_TIMEOUT = { timeout: 240_000 };
const dataDirs = [];

after(() => {
  if (!process.env.FLYEASY_KEEP_TEST_DATA) {
    dataDirs.forEach(removeDataDir);
  }
});

test("dispatches a queued run, logs worker output, and the run completes", TEST_TIMEOUT, async () => {
  const fake = await startFakeTripcom();
  const dataDir = createTestDataDir("dispatcher", { preferences: { showAutomationBrowser: false } });
  dataDirs.push(dataDir);

  try {
    const { code } = await runNodeScript(
      "scripts/automation/dispatch-run-queue.mjs",
      [],
      automationEnv(dataDir, fake.origin)
    );
    assert.equal(code, 0);

    const run = await waitFor(
      () => {
        const current = readRun(dataDir);
        return ["completed", "failed", "blocked"].includes(current.status) ? current : null;
      },
      { timeoutMs: 180_000 }
    );
    assert.equal(run.status, "completed", run.failure_reason ?? "");

    const log = fs.readFileSync(path.join(dataDir, "runtime", "worker-logs", `${RUN_ID}.log`), "utf8");
    assert.match(log, /Starting worker/);
  } finally {
    await fake.close();
  }
});

test("a worker marked running with a dead process does not block the queue", TEST_TIMEOUT, async () => {
  const fake = await startFakeTripcom({ mode: "blocked" });
  const dataDir = createTestDataDir("dispatcher-stale", { preferences: { showAutomationBrowser: false } });
  dataDirs.push(dataDir);
  fs.writeFileSync(
    path.join(dataDir, "runtime", "automation-worker.json"),
    JSON.stringify({ activeRunId: "run_gone", pid: 999_999_999, status: "running" })
  );

  try {
    await runNodeScript("scripts/automation/dispatch-run-queue.mjs", [], automationEnv(dataDir, fake.origin));
    const run = await waitFor(
      () => {
        const current = readRun(dataDir);
        return current.status !== "queued" && current.status !== "running" ? current : null;
      },
      { timeoutMs: 120_000 }
    );

    assert.equal(run.status, "blocked", "the queued run was started despite the stale worker state");
  } finally {
    await fake.close();
  }
});
