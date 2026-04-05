import fs from "node:fs";
import path from "node:path";

import { ensureFlyEasyPaths, resolveFlyEasyPaths } from "@/lib/runtime/app-paths";

export type AutomationWorkerStatus = "blocked" | "failed" | "idle" | "running";

export type AutomationWorkerSnapshot = {
  activeRunId: string | null;
  lastError: string | null;
  lastHeartbeatAt: string | null;
  startedAt: string | null;
  status: AutomationWorkerStatus;
};

function getWorkerSnapshotPath() {
  const paths = ensureFlyEasyPaths(resolveFlyEasyPaths());
  return path.join(paths.rootDir, "runtime", "automation-worker.json");
}

export function getAutomationWorkerSnapshot(): AutomationWorkerSnapshot {
  const workerSnapshotPath = getWorkerSnapshotPath();

  if (!fs.existsSync(workerSnapshotPath)) {
    return {
      activeRunId: null,
      lastError: null,
      lastHeartbeatAt: null,
      startedAt: null,
      status: "idle"
    };
  }

  return JSON.parse(fs.readFileSync(workerSnapshotPath, "utf8")) as AutomationWorkerSnapshot;
}
