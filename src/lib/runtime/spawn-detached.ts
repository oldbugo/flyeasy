import path from "node:path";
import { spawn } from "node:child_process";

export function spawnDetachedNodeScript(scriptRelativePath: string, args: string[] = [], env = {}) {
  const scriptPath = path.join(process.cwd(), scriptRelativePath);
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      ...env
    },
    stdio: "ignore"
  });

  child.unref();
}
