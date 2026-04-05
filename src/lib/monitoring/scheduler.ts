import { and, asc, desc, eq, inArray, isNotNull, lte } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { searchRuns } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import { createRunFromSession } from "@/lib/runs/create-run-from-session";
import { startTripcomBaselineRun } from "@/lib/tripcom/automation";

type DueSession = {
  id: string;
  name: string;
};

function nowIso() {
  return new Date().toISOString();
}

function hasActiveRun(sessionId: string) {
  const db = getDb();
  const activeRun = db
    .select({ id: searchRuns.id })
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.sessionId, sessionId),
        inArray(searchRuns.status, ["queued", "running", "blocked", "paused"])
      )
    )
    .orderBy(desc(searchRuns.startedAt))
    .get();

  return Boolean(activeRun);
}

function listDueSessions() {
  const db = getDb();

  return db
    .select({
      id: sessions.id,
      name: sessions.name
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.monitoringState, "enabled"),
        eq(sessions.isLive, true),
        isNotNull(sessions.nextRefreshAt),
        lte(sessions.nextRefreshAt, nowIso())
      )
    )
    .orderBy(asc(sessions.nextRefreshAt))
    .all() as DueSession[];
}

export async function queueDueMonitoringRuns() {
  const dueSessions = listDueSessions();
  const queuedRunIds: string[] = [];
  const skippedSessionIds: string[] = [];

  for (const session of dueSessions) {
    if (hasActiveRun(session.id)) {
      skippedSessionIds.push(session.id);
      continue;
    }

    const createdRun = await createRunFromSession(session.id, {
      runMode: "monitoring",
      triggerSource: "scheduled"
    });

    if (!createdRun) {
      skippedSessionIds.push(session.id);
      continue;
    }

    startTripcomBaselineRun(createdRun.runId);
    queuedRunIds.push(createdRun.runId);
  }

  return {
    queuedRunIds,
    skippedSessionIds
  };
}
