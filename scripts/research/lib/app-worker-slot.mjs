// Lets research collection share the app's Trip.com browser profile without
// colliding with app runs. The app's dispatcher only starts a run when the
// worker state is idle, so the collector claims that state while it holds the
// profile, then hands back and asks the dispatcher to start any queued runs.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { resolveFlyEasyAppRoot } from "../../lib/flyeasy-paths.mjs";
import { resolveRuntimeStatePaths, writeWorkerState } from "../../automation/lib/runtime-state.mjs";

const dispatchScriptPath = fileURLToPath(new URL("../../automation/dispatch-run-queue.mjs", import.meta.url));

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  const value = Number(pid);
  if (!Number.isInteger(value) || value <= 0) return false;
  try {
    process.kill(value, 0);
    return true;
  } catch {
    return false;
  }
}

export function readAppWorkerState() {
  return readJson(resolveRuntimeStatePaths().workerStatePath);
}

// Mirrors the dispatcher's own check (dispatch-run-queue.mjs).
export function isAppWorkerBusy(state = readAppWorkerState()) {
  if (state?.status === "blocked") return true;
  return state?.status === "running" && isProcessAlive(state.pid);
}

export function readShowAutomationBrowser() {
  const { workerStatePath } = resolveRuntimeStatePaths();
  const preferences = readJson(path.join(path.dirname(workerStatePath), "automation-preferences.json"));
  return preferences?.showAutomationBrowser ?? true;
}

export function claimAppWorkerSlot(label) {
  if (isAppWorkerBusy()) return false;
  const startedAt = new Date().toISOString();
  writeWorkerState({
    activeRunId: `research:${label}`,
    lastError: null,
    lastHeartbeatAt: startedAt,
    pid: process.pid,
    startedAt,
    status: "running"
  });
  return true;
}

export function heartbeatAppWorkerSlot(label) {
  const state = readAppWorkerState();
  if (state?.activeRunId !== `research:${label}`) return;
  writeWorkerState({ ...state, lastHeartbeatAt: new Date().toISOString() });
}

export function releaseAppWorkerSlot(label, { blockedDetail = null } = {}) {
  const state = readAppWorkerState();
  if (state?.activeRunId === `research:${label}`) {
    writeWorkerState({
      activeRunId: null,
      lastError: blockedDetail,
      lastHeartbeatAt: new Date().toISOString(),
      pid: null,
      startedAt: null,
      status: "idle"
    });
  }

  // Start any app runs that queued while research held the profile. If
  // Trip.com is blocking, leave the queue alone so the app shows the block.
  if (blockedDetail) return;
  try {
    const child = spawn(process.execPath, [dispatchScriptPath], {
      cwd: resolveFlyEasyAppRoot(),
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
  } catch {
    // The app's own scheduler will dispatch on its next tick.
  }
}
