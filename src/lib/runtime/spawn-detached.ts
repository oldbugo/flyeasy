import path from "node:path";
import { spawn } from "node:child_process";

import { resolveFlyEasyAppRoot } from "./app-paths";

export function spawnDetachedNodeScript(scriptRelativePath: string, args: string[] = [], env = {}) {
  const appRoot = resolveFlyEasyAppRoot();
  const scriptPath = path.join(appRoot, scriptRelativePath);
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: appRoot,
    detached: true,
    env: {
      ...process.env,
      ...env
    },
    stdio: "ignore"
  });

  child.unref();
}
