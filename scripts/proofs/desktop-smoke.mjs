import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { _electron as electron } from "playwright";

const executablePath = path.resolve("release/win-unpacked/FlyEasy.exe");
const dataDir = path.resolve(".tmp", `desktop-smoke-${Date.now()}`);
fs.mkdirSync(dataDir, { recursive: true });

// Reuse an installed browser cache when provided, keeping test data isolated.
if (process.env.FLYEASY_SMOKE_BROWSER_CACHE) {
  fs.symlinkSync(
    path.resolve(process.env.FLYEASY_SMOKE_BROWSER_CACHE),
    path.join(dataDir, "playwright-browsers"),
    "junction"
  );
}

const env = { ...process.env, FLYEASY_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
delete env.FLYEASY_RENDERER_URL;
const desktop = await electron.launch({ executablePath, env, timeout: 60_000 });
let serverUrl;
try {
  const page = await desktop.firstWindow();
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:/, { timeout: 120_000 });
  serverUrl = new URL(page.url()).origin;
  await page.getByRole("navigation").getByRole("link", { name: "Settings", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.flyeasyDesktop?.runtime), "electron");
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  for (const route of ["/sessions/new", "/settings", "/"]) {
    const response = await page.goto(`${serverUrl}${route}`);
    assert.equal(response.status(), 200, route);
    assert.ok((await page.locator("body").innerText()).length > 100, route);
  }
  assert.ok(fs.existsSync(path.join(dataDir, "flyeasy.db")));
  await page.screenshot({ path: path.join(dataDir, "desktop.png") });
  console.log(`Desktop startup, preload, SQLite, and routes passed. Screenshot: ${dataDir}/desktop.png`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  const closeTimeout = setTimeout(() => desktop.process().kill(), 10_000);
  try {
    await desktop.close();
  } finally {
    clearTimeout(closeTimeout);
  }
}
if (serverUrl) {
  await assert.rejects(fetch(serverUrl, { signal: AbortSignal.timeout(5_000) }));
  console.log("Desktop shutdown stopped the bundled server.");
}
