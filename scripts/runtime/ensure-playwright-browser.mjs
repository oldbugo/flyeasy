import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { chromium } from "playwright";

import { ensureFlyEasyPaths, resolveFlyEasyAppRoot } from "../lib/flyeasy-paths.mjs";

function hasInstalledChromium() {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

const paths = ensureFlyEasyPaths();

if (hasInstalledChromium()) {
  console.log(`Playwright Chromium already available at ${chromium.executablePath()}`);
  process.exit(0);
}

const cliPath = path.join(resolveFlyEasyAppRoot(), "node_modules", "playwright", "cli.js");

if (!fs.existsSync(cliPath)) {
  throw new Error(`Playwright CLI not found at ${cliPath}`);
}

const result = spawnSync(process.execPath, [cliPath, "install", "chromium"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ?? paths.playwrightBrowsersDir
  }
});

if (result.status !== 0) {
  throw new Error(`Playwright Chromium install failed with exit code ${result.status ?? "unknown"}`);
}
