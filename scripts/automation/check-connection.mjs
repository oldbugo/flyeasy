import { chromium } from "playwright";

import { ensureFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { collectConnectionObservation } from "./lib/tripcom-browser.mjs";
import { writeConnectionState } from "./lib/runtime-state.mjs";

const headless = process.env.FLYEASY_CONNECTION_HEADFUL === "1" ? false : true;
const manualLogin = process.env.FLYEASY_CONNECTION_ALLOW_MANUAL_LOGIN === "1";
const timeoutMs = Number(process.env.FLYEASY_CONNECTION_TIMEOUT_MS ?? 60_000);

const paths = ensureFlyEasyPaths();
const browserStateDir = `${paths.browserStateDir}/app`;

writeConnectionState({
  detail: "Trip.com connection check is running.",
  lastCheckedAt: new Date().toISOString(),
  lastUrl: null,
  state: "checking",
  updatedBy: "probe"
});

const context = await chromium.launchPersistentContext(browserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto("https://au.trip.com/flights/", {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });

  let observation = await collectConnectionObservation(page, context);

  if (manualLogin && !headless) {
    await page.waitForTimeout(180_000);
    observation = await collectConnectionObservation(page, context);
  }

  writeConnectionState({
    detail: observation.classification.detail,
    lastCheckedAt: new Date().toISOString(),
    lastUrl: observation.tripcomUrl,
    state: observation.classification.state,
    updatedBy: manualLogin ? "manual_recovery" : "probe"
  });
} catch (error) {
  writeConnectionState({
    detail: error instanceof Error ? error.message : "Trip.com connection check failed.",
    lastCheckedAt: new Date().toISOString(),
    lastUrl: "https://au.trip.com/flights/",
    state: "blocked",
    updatedBy: "probe"
  });
} finally {
  await context.close();
}
