import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureFlyEasyPaths } from "./lib/flyeasy-paths.mjs";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close((error) => error ? reject(error) : resolve(port));
  });
});
const url = `http://127.0.0.1:${port}`;

function waitForUrl(targetUrl, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(targetUrl, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${targetUrl}`));
          return;
        }

        setTimeout(tick, 500);
      });
    };

    tick();
  });
}

// Use FlyEasy's own browser folder, as the packaged app does, instead of
// Playwright's shared default (which some terminals cannot read).
const { playwrightBrowsersDir } = ensureFlyEasyPaths();
const runtimeEnv = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? playwrightBrowsersDir
};
const browserSetup = spawnSync(
  process.execPath,
  [path.join(appRoot, "scripts/runtime/ensure-playwright-browser.mjs")],
  { cwd: appRoot, env: runtimeEnv, stdio: "inherit", windowsHide: true }
);

if (browserSetup.status !== 0) {
  console.error("Could not prepare Playwright Chromium for the automation worker.");
  process.exit(browserSetup.status ?? 1);
}

const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: appRoot,
  env: runtimeEnv,
  stdio: "inherit",
  windowsHide: true
});

let electron;
const shutdown = () => {
  if (!web.killed) {
    web.kill();
  }
  if (electron && !electron.killed) {
    electron.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
web.on("error", (error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});
web.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 1);
});

try {
  await waitForUrl(url, 60_000);

  const electronEnv = { ...runtimeEnv, FLYEASY_RENDERER_URL: url };
  delete electronEnv.ELECTRON_RUN_AS_NODE;
  electron = spawn(require("electron"), [path.join(appRoot, "src/desktop/main/main.mjs")], {
    cwd: appRoot,
    stdio: "inherit",
    windowsHide: true,
    env: electronEnv
  });

  electron.on("error", (error) => {
    console.error(error);
    shutdown();
    process.exit(1);
  });

  electron.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
} catch (error) {
  shutdown();
  console.error(error);
  process.exit(1);
}
