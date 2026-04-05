import { spawn } from "node:child_process";
import http from "node:http";

const url = "http://127.0.0.1:3000";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

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

const web = spawn(npmCmd, ["run", "dev"], {
  stdio: "inherit",
  shell: false
});

const shutdown = () => {
  if (!web.killed) {
    web.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await waitForUrl(url, 60_000);

  const electron = spawn(npmCmd, ["run", "electron"], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      FLYEASY_RENDERER_URL: url
    }
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
