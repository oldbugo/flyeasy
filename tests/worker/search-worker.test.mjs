// Runs the real search worker against a local fake Trip.com.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";

import { startFakeTripcom } from "../support/fake-tripcom.mjs";
import {
  automationEnv,
  createTestDataDir,
  listRunArtifacts,
  readQueries,
  readRun,
  readWorkerState,
  removeDataDir,
  runWorker
} from "../support/test-env.mjs";

const TEST_TIMEOUT = { timeout: 240_000 };
const dataDirs = [];
const newDataDir = (name) => {
  const dataDir = createTestDataDir(name);
  dataDirs.push(dataDir);
  return dataDir;
};

after(() => {
  if (!process.env.FLYEASY_KEEP_TEST_DATA) {
    dataDirs.forEach(removeDataDir);
  }
});

async function withFake(mode, fn) {
  const fake = await startFakeTripcom({ mode });
  try {
    return await fn(fake);
  } finally {
    await fake.close();
  }
}

test("completes a direct sweep and records fares", TEST_TIMEOUT, () =>
  withFake("normal", async (fake) => {
    const dataDir = newDataDir("worker-success");
    const { code, output } = await runWorker(automationEnv(dataDir, fake.origin));
    const run = readRun(dataDir);
    const queries = readQueries(dataDir);

    assert.equal(code, 0, output);
    assert.equal(run.status, "completed", run.failure_reason ?? output);
    assert.equal(run.total_candidates_found, 8);
    assert.equal(queries.length, 2, "two date pairs searched");
    assert.ok(queries.every((query) => query.status === "completed"));
    // Same cheapest fare the real Sept 8 run recorded from this saved page.
    assert.ok(queries.every((query) => JSON.parse(query.result_summary_json).cheapestPrice === 1982));
    assert.equal(readWorkerState(dataDir).status, "idle");
  }));

test("loads each results page once per date pair (goes back between outbound branches)", TEST_TIMEOUT, () =>
  withFake("normal", async (fake) => {
    const dataDir = newDataDir("worker-page-loads");
    await runWorker(automationEnv(dataDir, fake.origin));

    assert.equal(readRun(dataDir).status, "completed");
    assert.equal(fake.requestCounts["/flights/showfarefirst"], 2);
    assert.equal(fake.requestCounts["/flights/showfarenext"], 4, "two outbound branches per date pair");
  }));

test("reloads the search when going back cannot reach the outbound list", TEST_TIMEOUT, () =>
  withFake("select-replaces-history", async (fake) => {
    const dataDir = newDataDir("worker-reload-fallback");
    await runWorker(automationEnv(dataDir, fake.origin));

    assert.equal(readRun(dataDir).status, "completed");
    assert.equal(readRun(dataDir).total_candidates_found, 8, "same fares as the go-back path");
    assert.equal(fake.requestCounts["/flights/showfarefirst"], 4, "one reload per extra branch");
  }));

test("skips success screenshots by default but saves flight-data samples", TEST_TIMEOUT, () =>
  withFake("normal", async (fake) => {
    const dataDir = newDataDir("worker-artifacts");
    await runWorker(automationEnv(dataDir, fake.origin));
    const files = listRunArtifacts(dataDir);

    assert.equal(files.filter((file) => file.endsWith(".png")).length, 0);
    assert.equal(files.filter((file) => file.endsWith("-flight-list-1.json")).length, 1);
    assert.equal(files.filter((file) => /-flight-list-\d\.json$/.test(file)).length, 3, "capped at 3");
  }));

test("saves success screenshots when the setting is on", TEST_TIMEOUT, () =>
  withFake("normal", async (fake) => {
    const dataDir = newDataDir("worker-screenshots");
    await runWorker(
      automationEnv(dataDir, fake.origin, { FLYEASY_CAPTURE_SUCCESS_SCREENSHOTS: "1" })
    );
    const screenshots = listRunArtifacts(dataDir).filter((file) => file.endsWith(".png"));

    assert.equal(readRun(dataDir).status, "completed");
    assert.ok(screenshots.some((file) => file.includes("outbound-results")));
    assert.ok(screenshots.some((file) => file.includes("return-results-branch")));
  }));

test("stops quickly as blocked when Trip.com blocks the home page", TEST_TIMEOUT, () =>
  withFake("blocked", async (fake) => {
    const dataDir = newDataDir("worker-blocked-home");
    const started = Date.now();
    await runWorker(automationEnv(dataDir, fake.origin));
    const run = readRun(dataDir);

    assert.equal(run.status, "blocked");
    assert.equal(run.resume_available, 1);
    assert.match(run.failure_reason, /whaleguard/);
    assert.equal(readWorkerState(dataDir).status, "blocked");
    assert.ok(Date.now() - started < 60_000, "blocked runs should not wait for timeouts");
  }));

test("stops the whole run as blocked when a results page is blocked", TEST_TIMEOUT, () =>
  withFake("results-blocked", async (fake) => {
    const dataDir = newDataDir("worker-blocked-results");
    await runWorker(automationEnv(dataDir, fake.origin));
    const run = readRun(dataDir);
    const queries = readQueries(dataDir);

    assert.equal(run.status, "blocked");
    assert.equal(queries.length, 1, "no further date pairs are attempted after a block");
    assert.equal(queries[0].status, "blocked");
  }));

test("fails with a clear message when the browser cannot start", TEST_TIMEOUT, () =>
  withFake("normal", async (fake) => {
    const dataDir = newDataDir("worker-no-browser");
    const emptyBrowsers = path.join(dataDir, "empty-browsers");
    fs.mkdirSync(emptyBrowsers, { recursive: true });
    const { output } = await runWorker(
      automationEnv(dataDir, fake.origin, { PLAYWRIGHT_BROWSERS_PATH: emptyBrowsers })
    );
    const run = readRun(dataDir);

    assert.equal(run.status, "failed");
    assert.match(run.failure_reason, /Playwright Chromium is not installed/);
    assert.match(output, /failed: Could not start the automation browser/, "error is logged");
    assert.equal(readWorkerState(dataDir).status, "failed");
  }));

test("records timeout evidence when results never load", TEST_TIMEOUT, () =>
  withFake("no-results-ever", async (fake) => {
    const dataDir = newDataDir("worker-timeout");
    await runWorker(automationEnv(dataDir, fake.origin, { FLYEASY_AUTOMATION_TIMEOUT_MS: "6000" }));
    const queries = readQueries(dataDir);

    assert.equal(readRun(dataDir).status, "failed");
    assert.ok(queries.length >= 1);
    assert.match(queries[0].failure_reason, /Timed out waiting for outbound Trip\.com results/);
    assert.match(queries[0].failure_reason, /Flight cards on page: 0\. Evidence: timeout-outbound-\d+\.png/);
    assert.ok(listRunArtifacts(dataDir).some((file) => /^timeout-outbound-\d+\.png$/.test(file)));
  }));
