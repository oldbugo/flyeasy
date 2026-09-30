// Loads every app page from the production build, as a plain browser and as
// the Electron window, and fails on any console or page error (for example
// React hydration mismatches, which only show up in the running app).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { startFakeTripcom } from "../support/fake-tripcom.mjs";
import {
  automationEnv,
  createTestDataDir,
  openDb,
  readRun,
  removeDataDir,
  repoRoot,
  RUN_ID,
  runWorker,
  SESSION_ID,
  waitFor
} from "../support/test-env.mjs";

const ELECTRON_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) FlyEasy Electron/41.10.7 Chrome/145.0.0.0 Safari/537.36";

let fake;
let dataDir;
let server;
let serverOutput = "";
let baseUrl;
let browser;
let candidateId;

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

before(async () => {
  assert.ok(
    fs.existsSync(path.join(repoRoot, ".next", "BUILD_ID")),
    "Run `npm run build` first (npm test and npm run test:app do this automatically)."
  );

  fake = await startFakeTripcom();
  dataDir = createTestDataDir("app-pages", { preferences: { showAutomationBrowser: false } });
  await runWorker(automationEnv(dataDir, fake.origin));
  assert.equal(readRun(dataDir).status, "completed", "seed run should complete against the fake site");

  const db = openDb(dataDir);
  candidateId = db
    .prepare("select id from itinerary_candidate where search_run_id = ? limit 1")
    .get(RUN_ID).id;
  db.close();

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [path.join(repoRoot, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: repoRoot,
      // The fake origin keeps any automation the pages trigger away from Trip.com.
      env: automationEnv(dataDir, fake.origin, { NODE_ENV: "production" }),
      windowsHide: true
    }
  );
  server.stdout.on("data", (chunk) => (serverOutput += chunk));
  server.stderr.on("data", (chunk) => (serverOutput += chunk));

  await waitFor(
    async () => {
      const response = await fetch(`${baseUrl}/settings`).catch(() => null);
      return response?.ok;
    },
    { timeoutMs: 60_000 }
  );

  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    // Wait for the exit so Windows releases the database file before cleanup.
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  await fake?.close();
  if (dataDir && !process.env.FLYEASY_KEEP_TEST_DATA) {
    removeDataDir(dataDir);
  }
});

const pages = () => [
  "/",
  "/settings",
  "/sessions/new",
  `/sessions/${SESSION_ID}`,
  `/sessions/${SESSION_ID}/results`,
  `/sessions/${SESSION_ID}/history`,
  `/sessions/${SESSION_ID}/compare`,
  `/sessions/${SESSION_ID}/review`,
  `/sessions/${SESSION_ID}/strategy`,
  `/sessions/${SESSION_ID}/settings`,
  `/sessions/${SESSION_ID}/runs/${RUN_ID}`,
  `/sessions/${SESSION_ID}/candidates/${candidateId}`
];

async function newContext(asElectron) {
  const context = await browser.newContext(asElectron ? { userAgent: ELECTRON_USER_AGENT } : {});

  if (asElectron) {
    // Mirrors what the Electron preload script exposes to the page.
    await context.addInitScript(() => {
      window.flyeasyDesktop = { quitApp: async () => ({ ok: true }), runtime: "electron" };
    });
  }

  return context;
}

async function visit(context, route) {
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text().split("\n")[0]}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message.split("\n")[0]}`));

  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  return { page, problems, status: response?.status() };
}

for (const asElectron of [false, true]) {
  const label = asElectron ? "in the Electron window" : "in a plain browser";

  test(`every page loads without errors ${label}`, { timeout: 180_000 }, async () => {
    const context = await newContext(asElectron);
    const failures = [];

    try {
      for (const route of pages()) {
        const { page, problems, status } = await visit(context, route);
        if (status !== 200) {
          failures.push(`${route}: HTTP ${status}`);
        }
        failures.push(...problems.map((problem) => `${route}: ${problem}`));
        await page.close();
      }
    } finally {
      await context.close();
    }

    assert.deepEqual(failures, [], `${failures.join("\n")}\n\nServer output:\n${serverOutput.slice(-2000)}`);
  });
}

test("the Quit button appears only in the Electron window", { timeout: 60_000 }, async () => {
  for (const asElectron of [false, true]) {
    const context = await newContext(asElectron);
    const { page } = await visit(context, "/");
    const quitButtons = await page.getByRole("button", { name: /Quit/ }).count();
    await context.close();

    assert.equal(quitButtons, asElectron ? 1 : 0, asElectron ? "Electron window" : "plain browser");
  }
});

test("the Results page shows the fares found by the worker", { timeout: 60_000 }, async () => {
  const context = await newContext(true);
  const { page } = await visit(context, `/sessions/${SESSION_ID}/results`);
  const text = await page.locator("body").innerText();
  await context.close();

  assert.match(text, /1,982/, "cheapest fare from the fake sweep");
  assert.match(text, /2 of 2 searches finished/);
});
