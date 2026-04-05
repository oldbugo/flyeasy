import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { searchRuns, strategyExecutions } from "@/lib/db/schema/run";

export async function listRunsForSession(sessionId: string) {
  const db = getDb();

  return db
    .select({
      id: searchRuns.id,
      runMode: searchRuns.runMode,
      status: searchRuns.status,
      triggerSource: searchRuns.triggerSource,
      startedAt: searchRuns.startedAt,
      finishedAt: searchRuns.finishedAt,
      totalStrategiesPlanned: searchRuns.totalStrategiesPlanned,
      totalStrategiesExecuted: searchRuns.totalStrategiesExecuted,
      totalCandidatesFound: searchRuns.totalCandidatesFound,
      totalCandidatesVerified: searchRuns.totalCandidatesVerified,
      recoveryState: searchRuns.recoveryState,
      resumeAvailable: searchRuns.resumeAvailable,
      summaryText: searchRuns.summaryText
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .all();
}

export async function getRunById(runId: string) {
  const db = getDb();

  const run = db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();

  if (!run) {
    return null;
  }

  const strategies = db
    .select()
    .from(strategyExecutions)
    .where(eq(strategyExecutions.searchRunId, runId))
    .orderBy(desc(strategyExecutions.priority))
    .all();

  return {
    run,
    strategies
  };
}

export async function listBlockedRuns() {
  const db = getDb();
  const runs = db
    .select({
      id: searchRuns.id,
      sessionId: searchRuns.sessionId,
      status: searchRuns.status,
      recoveryReason: searchRuns.recoveryReason,
      resumeAvailable: searchRuns.resumeAvailable,
      blockedAt: searchRuns.blockedAt
    })
    .from(searchRuns)
    .orderBy(desc(searchRuns.blockedAt))
    .all();

  return runs.filter((run) => run.status === "blocked" || run.resumeAvailable);
}
