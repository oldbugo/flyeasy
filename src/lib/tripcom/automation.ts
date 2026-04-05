import { spawnDetachedNodeScript } from "@/lib/runtime/spawn-detached";

export function startTripcomConnectionCheck() {
  spawnDetachedNodeScript("scripts/automation/check-connection.mjs");
}

export function startTripcomManualRecovery() {
  spawnDetachedNodeScript("scripts/automation/check-connection.mjs", [], {
    FLYEASY_CONNECTION_ALLOW_MANUAL_LOGIN: "1",
    FLYEASY_CONNECTION_HEADFUL: "1"
  });
}

export function dispatchTripcomRunQueue() {
  spawnDetachedNodeScript("scripts/automation/dispatch-run-queue.mjs");
}

export function startTripcomBaselineRun(_runId: string) {
  dispatchTripcomRunQueue();
}

export function resumeTripcomRun(runId: string) {
  spawnDetachedNodeScript("scripts/automation/dispatch-run-queue.mjs", ["--resume", runId]);
}
