import { app, BrowserWindow, ipcMain } from "electron";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDesktopPaths, resolveDesktopPaths } from "../bootstrap/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, "..", "preload", "preload.cjs");
const schedulerIntervalMs = 60_000;
const rendererRetryDelayMs = 1_500;
const isDevRenderer = Boolean(process.env.FLYEASY_RENDERER_URL);

let schedulerInterval;
let shutdownStarted = false;
let mainWindow;
let nextServerProcess;
let rendererRetryTimeout;
let captureInFlight = false;
let rendererUrl = process.env.FLYEASY_RENDERER_URL ?? null;
let schedulerTickUrl = rendererUrl ? new URL("/api/monitoring/tick", rendererUrl).toString() : null;
let runtimeStartupPromise;

if (process.env.FLYEASY_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}

function getDesktopDebugPath() {
  const paths = ensureDesktopPaths(app);
  return path.join(paths.rootDir, "desktop-debug.log");
}

function appendDesktopDebug(message) {
  try {
    fs.appendFileSync(getDesktopDebugPath(), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Debug logging should never break the desktop shell.
  }
}

async function captureDesktopWindow(tag = "desktop-capture") {
  if (!mainWindow || mainWindow.isDestroyed() || captureInFlight) {
    return;
  }

  captureInFlight = true;
  const paths = ensureDesktopPaths(app);
  const filename = `${tag}.png`;
  const filePath = path.join(paths.rootDir, filename);

  const attemptCapture = async (attempt) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    try {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      const image = await mainWindow.capturePage();
      fs.writeFileSync(filePath, image.toPNG());
      appendDesktopDebug(`desktop capture written path=${filePath}`);
      return true;
    } catch (error) {
      appendDesktopDebug(`desktop-capture-error attempt=${attempt} ${String(error)}`);
      return false;
    }
  };

  const attempts = [0, 250, 750];
  for (let i = 0; i < attempts.length; i += 1) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempts[i]));
    }

    if (await attemptCapture(i + 1)) {
      captureInFlight = false;
      return;
    }
  }

  captureInFlight = false;
}

async function tickMonitoringScheduler() {
  if (!schedulerTickUrl) {
    return;
  }

  try {
    await fetch(schedulerTickUrl, {
      method: "POST"
    });
  } catch {
    // The local Next server may still be booting. Try again on the next tick.
  }
}

function startMonitoringScheduler() {
  if (!schedulerTickUrl || schedulerInterval) {
    return;
  }

  void tickMonitoringScheduler();
  schedulerInterval = setInterval(() => {
    void tickMonitoringScheduler();
  }, schedulerIntervalMs);
}

function stopMonitoringScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = undefined;
  }
}

function stopRendererRetryLoop() {
  if (rendererRetryTimeout) {
    clearTimeout(rendererRetryTimeout);
    rendererRetryTimeout = undefined;
  }
}

function scheduleRendererReconnect() {
  if (shutdownStarted || rendererRetryTimeout || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  rendererRetryTimeout = setTimeout(() => {
    rendererRetryTimeout = undefined;

    if (!mainWindow || mainWindow.isDestroyed() || shutdownStarted) {
      return;
    }

    void loadRenderer(mainWindow);
  }, rendererRetryDelayMs);
}

async function loadRenderer(window) {
  if (!rendererUrl) {
    showLoadingFallback(window);
    return;
  }

  try {
    await window.loadURL(rendererUrl);
    stopRendererRetryLoop();
  } catch {
    showLoadingFallback(window);
    scheduleRendererReconnect();
  }
}

function showLoadingFallback(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const loadingMarkup = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>FlyEasy</title>
        <style>
          :root { color-scheme: light; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #edf2f7;
            color: #102033;
            font-family: Inter, "Segoe UI", Arial, sans-serif;
          }
          .card {
            width: min(520px, calc(100vw - 48px));
            border: 1px solid #d6dee8;
            border-radius: 28px;
            background: #ffffff;
            padding: 28px;
            box-shadow: 0 2px 12px rgba(16, 32, 51, 0.06);
          }
          .eyebrow {
            margin: 0 0 10px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #0c6b58;
          }
          h1 {
            margin: 0;
            font-size: 28px;
            line-height: 1.1;
          }
          p {
            margin: 12px 0 0;
            font-size: 14px;
            line-height: 1.7;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <p class="eyebrow">FlyEasy</p>
          <h1>Reloading the desktop workspace</h1>
          <p>The local UI is reconnecting. On first launch, FlyEasy may also take a little longer while it prepares the browser automation runtime.</p>
        </div>
      </body>
    </html>
  `;

  appendDesktopDebug("showing loading fallback");
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingMarkup)}`);
}

function cleanupFlyeasySupportProcesses() {
  if (process.platform !== "win32" || app.isPackaged || !isDevRenderer) {
    return;
  }

  const workspacePath = process.cwd().replace(/\\/g, "\\\\");
  const script = `
    $workspace = '${workspacePath}';
    $currentPid = ${process.pid};
    $targets = Get-CimInstance Win32_Process | Where-Object {
      $_.ProcessId -ne $currentPid -and
      $_.Name -in @('node.exe', 'cmd.exe') -and
      $_.CommandLine -like "*$workspace*" -and
      (
        $_.CommandLine -like '*next*dev*' -or
        $_.CommandLine -like '*start-server.js*' -or
        $_.CommandLine -like '*scripts\\\\automation\\\\*' -or
        $_.CommandLine -like '*npm run dev*'
      )
    };
    foreach ($target in $targets) {
      Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue;
    }
  `;

  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: "ignore"
    });
  } catch {
    // If cleanup fails, still allow the app to quit normally.
  }
}

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

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error("Unable to determine an available localhost port."));
          return;
        }

        resolve(port);
      });
    });
  });
}

function getPackagedAppRoot() {
  return path.join(process.resourcesPath, "app-dist");
}

function getPackagedNodeExecutablePath() {
  return path.join(process.resourcesPath, "app-dist-runtime", "node", "node.exe");
}

function getPackagedServerScriptPath() {
  return path.join(getPackagedAppRoot(), "server.js");
}

function getPackagedRuntimeScriptPath(scriptRelativePath) {
  return path.join(getPackagedAppRoot(), scriptRelativePath);
}

function getNodeRuntimeEnv(overrides = {}) {
  const runtimeEnv =
    app.isPackaged && fs.existsSync(getPackagedNodeExecutablePath())
      ? {}
      : { ELECTRON_RUN_AS_NODE: "1" };

  return {
    ...process.env,
    ...runtimeEnv,
    ...overrides
  };
}

function getNodeExecutablePath() {
  const packagedNodePath = getPackagedNodeExecutablePath();

  if (app.isPackaged && fs.existsSync(packagedNodePath)) {
    return packagedNodePath;
  }

  return process.execPath;
}

function stopPackagedServer() {
  if (!nextServerProcess || nextServerProcess.killed) {
    nextServerProcess = undefined;
    return;
  }

  nextServerProcess.kill();
  nextServerProcess = undefined;
}

function runNodeScript(scriptPath, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const nodeExecutablePath = getNodeExecutablePath();
    const child = spawn(nodeExecutablePath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: getNodeRuntimeEnv(envOverrides),
      windowsHide: true,
      stdio: "ignore"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Node script failed with exit code ${code ?? "unknown"}: ${scriptPath}`));
    });
  });
}

async function startRuntimeBackend() {
  if (rendererUrl) {
    startMonitoringScheduler();
    return;
  }

  if (runtimeStartupPromise) {
    await runtimeStartupPromise;
    return;
  }

  runtimeStartupPromise = (async () => {
    const paths = ensureDesktopPaths(app);
    const appRoot = getPackagedAppRoot();
    const serverScriptPath = getPackagedServerScriptPath();
    const browserSetupScriptPath = getPackagedRuntimeScriptPath(
      path.join("scripts", "runtime", "ensure-playwright-browser.mjs")
    );

    await runNodeScript(browserSetupScriptPath, {
      FLYEASY_APP_ROOT: appRoot,
      FLYEASY_DATA_DIR: paths.rootDir,
      PLAYWRIGHT_BROWSERS_PATH: paths.playwrightBrowsersDir
    });

    const port = await findAvailablePort();
    const nextUrl = `http://127.0.0.1:${port}`;
    const nodeExecutablePath = getNodeExecutablePath();
    const child = spawn(nodeExecutablePath, [serverScriptPath], {
      cwd: appRoot,
      windowsHide: true,
      env: getNodeRuntimeEnv({
        FLYEASY_APP_ROOT: appRoot,
        FLYEASY_DATA_DIR: paths.rootDir,
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        PLAYWRIGHT_BROWSERS_PATH: paths.playwrightBrowsersDir,
        PORT: String(port)
      }),
      stdio: "ignore"
    });

    child.on("exit", (code) => {
      appendDesktopDebug(`next-server-exit code=${code ?? "unknown"}`);
      nextServerProcess = undefined;
      rendererUrl = null;
      schedulerTickUrl = null;
      stopMonitoringScheduler();

      if (!shutdownStarted) {
        void startRuntimeBackend().catch((error) => {
          appendDesktopDebug(`runtime-restart-error ${String(error)}`);
        });
      }
    });

    child.on("error", (error) => {
      appendDesktopDebug(`next-server-error ${String(error)}`);
    });

    nextServerProcess = child;
    await waitForUrl(nextUrl, 60_000);
    rendererUrl = nextUrl;
    schedulerTickUrl = new URL("/api/monitoring/tick", rendererUrl).toString();
    startMonitoringScheduler();

    if (mainWindow && !mainWindow.isDestroyed()) {
      void loadRenderer(mainWindow);
    }
  })();

  try {
    await runtimeStartupPromise;
  } finally {
    runtimeStartupPromise = undefined;
  }
}

function shutdownEverything() {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  stopRendererRetryLoop();
  stopMonitoringScheduler();
  stopPackagedServer();
  cleanupFlyeasySupportProcesses();
}

app.setPath("userData", resolveDesktopPaths(app).rootDir);

ipcMain.handle("flyeasy:quit-app", () => {
  shutdownEverything();
  app.quit();
  return { ok: true };
});

ipcMain.handle("flyeasy:capture-ui", async () => {
  await captureDesktopWindow("desktop-capture");
  return { ok: true };
});

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#edf2f7",
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    appendDesktopDebug("window closed");
    stopRendererRetryLoop();
    mainWindow = undefined;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame) {
      return;
    }

    // Ignore aborts triggered by normal dev-server redirects/reloads.
    if (errorCode === -3) {
      return;
    }

    appendDesktopDebug(`did-fail-load code=${errorCode} url=${_validatedURL}`);
    showLoadingFallback(mainWindow);
    scheduleRendererReconnect();
  });

  mainWindow.webContents.on("render-process-gone", () => {
    appendDesktopDebug("render-process-gone");
    showLoadingFallback(mainWindow);
    scheduleRendererReconnect();
  });

  mainWindow.webContents.on("unresponsive", () => {
    appendDesktopDebug("renderer unresponsive");
    showLoadingFallback(mainWindow);
    scheduleRendererReconnect();
  });

  mainWindow.webContents.on("did-finish-load", async () => {
    stopRendererRetryLoop();
    appendDesktopDebug(`did-finish-load url=${mainWindow?.webContents.getURL() ?? "unknown"}`);

    try {
      const summary = await mainWindow.webContents.executeJavaScript(`
        ({
          bodyTextLength: document.body?.innerText?.length ?? 0,
          bodyTextSnippet: (document.body?.innerText ?? "").slice(0, 240),
          childCount: document.body?.children?.length ?? 0,
          readyState: document.readyState,
          title: document.title
        })
      `);
      appendDesktopDebug(`renderer-summary ${JSON.stringify(summary)}`);
    } catch (error) {
      appendDesktopDebug(`renderer-summary-error ${String(error)}`);
    }

    // Capture is handled after the window is ready to show.
  });

  appendDesktopDebug(`loading renderer url=${rendererUrl}`);
  showLoadingFallback(mainWindow);
  void loadRenderer(mainWindow);

  return mainWindow;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = createWindow();
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  });

  app.whenReady().then(() => {
    ensureDesktopPaths(app);
    createWindow();
    void startRuntimeBackend().catch((error) => {
      appendDesktopDebug(`runtime-startup-error ${String(error)}`);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  shutdownEverything();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  shutdownEverything();
});
