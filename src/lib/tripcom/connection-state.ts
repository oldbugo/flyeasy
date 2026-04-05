import fs from "node:fs";
import path from "node:path";

import { ensureFlyEasyPaths, resolveFlyEasyPaths } from "@/lib/runtime/app-paths";

export type TripcomConnectionState =
  | "unknown"
  | "checking"
  | "ready_public"
  | "ready_authenticated"
  | "needs_login"
  | "blocked";

export type TripcomConnectionSnapshot = {
  detail: string;
  lastCheckedAt: string | null;
  lastUrl: string | null;
  state: TripcomConnectionState;
  updatedBy: "automation" | "manual_recovery" | "probe" | "system";
};

export type TripcomConnectionBadge = {
  className: string;
  label: string;
};

function getConnectionStatePath() {
  const paths = ensureFlyEasyPaths(resolveFlyEasyPaths());
  return path.join(paths.rootDir, "runtime", "tripcom-connection.json");
}

function getProofStatePath() {
  const paths = ensureFlyEasyPaths(resolveFlyEasyPaths());
  return path.join(paths.browserStateDir, "session-probe", "proof-state.json");
}

function getDefaultSnapshot(): TripcomConnectionSnapshot {
  return {
    detail: "No Trip.com probe has been recorded yet.",
    lastCheckedAt: null,
    lastUrl: null,
    state: "unknown",
    updatedBy: "system"
  };
}

export function readTripcomConnectionSnapshot(): TripcomConnectionSnapshot {
  const connectionStatePath = getConnectionStatePath();

  if (fs.existsSync(connectionStatePath)) {
    return JSON.parse(fs.readFileSync(connectionStatePath, "utf8")) as TripcomConnectionSnapshot;
  }

  const proofStatePath = getProofStatePath();
  if (fs.existsSync(proofStatePath)) {
    const proofState = JSON.parse(fs.readFileSync(proofStatePath, "utf8")) as {
      lastAuthenticatedAt?: string;
    };

    if (proofState.lastAuthenticatedAt) {
      return {
        detail: "Authenticated Trip.com proof state exists locally.",
        lastCheckedAt: proofState.lastAuthenticatedAt,
        lastUrl: "https://au.trip.com/flights/",
        state: "ready_authenticated",
        updatedBy: "probe"
      };
    }
  }

  return getDefaultSnapshot();
}

export function getTripcomConnectionBadge(snapshot = readTripcomConnectionSnapshot()): TripcomConnectionBadge {
  switch (snapshot.state) {
    case "ready_public":
      return {
        className: "bg-emerald-100 text-emerald-800",
        label: "Trip.com public ready"
      };
    case "ready_authenticated":
      return {
        className: "bg-emerald-100 text-emerald-800",
        label: "Trip.com authenticated"
      };
    case "checking":
      return {
        className: "bg-amber-100 text-amber-800",
        label: "Trip.com checking"
      };
    case "needs_login":
      return {
        className: "bg-amber-100 text-amber-800",
        label: "Trip.com needs recovery"
      };
    case "blocked":
      return {
        className: "bg-rose-100 text-rose-800",
        label: "Trip.com blocked"
      };
    default:
      return {
        className: "bg-slate-200 text-slate-700",
        label: "Trip.com unknown"
      };
  }
}
