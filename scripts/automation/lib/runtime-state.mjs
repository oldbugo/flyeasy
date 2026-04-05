import fs from "node:fs";
import path from "node:path";

import { ensureFlyEasyPaths } from "../../lib/flyeasy-paths.mjs";

export function resolveRuntimeStatePaths() {
  const paths = ensureFlyEasyPaths();
  const runtimeDir = path.join(paths.rootDir, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });

  return {
    connectionStatePath: path.join(runtimeDir, "tripcom-connection.json"),
    workerStatePath: path.join(runtimeDir, "automation-worker.json")
  };
}

export function writeConnectionState(snapshot) {
  const { connectionStatePath } = resolveRuntimeStatePaths();
  fs.writeFileSync(connectionStatePath, JSON.stringify(snapshot, null, 2), "utf8");
}

export function writeWorkerState(snapshot) {
  const { workerStatePath } = resolveRuntimeStatePaths();
  fs.writeFileSync(workerStatePath, JSON.stringify(snapshot, null, 2), "utf8");
}
