import {
  ensureAiStrategyProposals,
  listAcceptedAiStrategyPlans,
  markAcceptedAiProposalsApplied
} from "@/lib/ai/strategy-proposals";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/db/ids";
import { searchRuns, strategyExecutions } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import { listSessionStrategySelections } from "@/lib/search-strategies/session-strategies";
import type { SearchStrategyBundleSelection } from "@/lib/search-strategies/catalog";
import { planStrategiesForSession } from "@/lib/runs/plan-strategies";

function nowIso() {
  return new Date().toISOString();
}

type CreateRunOptions = {
  experimentMetadata?: {
    armKey: string;
    armLabel: string;
    groupId: string;
  };
  runMode?: "interactive" | "monitoring";
  strategySelectionsOverride?: SearchStrategyBundleSelection[];
  triggerSource?: "manual" | "scheduled" | "rerank_only" | "debug";
};

export async function createRunFromSession(sessionId: string, options: CreateRunOptions = {}) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    return null;
  }

  await ensureAiStrategyProposals(session);
  const strategySelections = options.strategySelectionsOverride ?? listSessionStrategySelections(session.id, session);
  const activeStrategies = strategySelections.filter(
    (selection) => selection.isRequired || (selection.enabled && selection.compatibility.isCompatible)
  );
  const plannedStrategies = planStrategiesForSession(session, strategySelections);
  const acceptedAiStrategies = await listAcceptedAiStrategyPlans(sessionId);
  const allStrategies = [
    ...plannedStrategies.map((strategy) => ({ ...strategy, proposalId: null, sourceType: "system" as const })),
    ...acceptedAiStrategies
  ];
  const runId = createId("run");
  const timestamp = nowIso();
  const runMode = options.runMode ?? "interactive";
  const triggerSource = options.triggerSource ?? "manual";
  const isScheduledMonitoring = runMode === "monitoring" && triggerSource === "scheduled";

  db.insert(searchRuns)
    .values({
      id: runId,
      sessionId,
      runMode,
      status: "queued",
      triggerSource,
      strategyExperimentGroupId: options.experimentMetadata?.groupId ?? null,
      strategyExperimentArmKey: options.experimentMetadata?.armKey ?? null,
      strategyExperimentArmLabel: options.experimentMetadata?.armLabel ?? null,
      startedAt: timestamp,
      finishedAt: null,
      searchSnapshotJson: JSON.stringify({
        bookingMode: session.bookingMode,
        departureStartDate: session.departureStartDate,
        durationMaxDays: session.durationMaxDays,
        durationMinDays: session.durationMinDays,
        latestReturnDate: session.returnEndDate ?? session.departureEndDate,
        maxStops: session.maxStops,
        originAirport: session.originAirport,
        outboundDestinationCity: session.outboundDestinationCity,
        requireIncludedCheckedBaggage: session.requireIncludedCheckedBaggage,
        restrictToChineseAirlines: session.restrictToChineseAirlines,
        returnDestinationAirport: session.returnDestinationAirport,
        returnOriginCity: session.returnOriginCity,
        returnOriginMode: session.returnOriginMode,
        searchIntensity: session.searchIntensity,
        stopDurationMaxDays: session.stopDurationMaxDays,
        stopDurationMinDays: session.stopDurationMinDays
      }),
      totalStrategiesPlanned: allStrategies.length,
      totalStrategiesExecuted: 0,
      totalCandidatesFound: 0,
      totalCandidatesVerified: 0,
      bestCandidateId: null,
      summaryText: `${
        isScheduledMonitoring
          ? "Scheduled monitoring run queued automatically"
          : "Run created from the session workspace"
        }${options.experimentMetadata ? ` as experiment arm ${options.experimentMetadata.armLabel}` : ""} with ${activeStrategies.length} selected strategy cluster${activeStrategies.length === 1 ? "" : "s"} producing ${allStrategies.length} planned strategi${allStrategies.length === 1 ? "y" : "es"}${acceptedAiStrategies.length > 0 ? `, including ${acceptedAiStrategies.length} accepted suggestion${acceptedAiStrategies.length === 1 ? "" : "s"}` : ""}. The run will compile the session's enabled strategy clusters into a bounded search program before execution.`,
      failureReason: null,
      recoveryState: "not_required",
      recoveryType: null,
      recoveryReason: null,
      blockedAt: null,
      resumeAvailable: false,
      resumeMode: null,
      resumeCheckpointJson: null,
      recoveryCompletedAt: null,
      createdAt: timestamp
    })
    .run();

  db.insert(strategyExecutions)
    .values(
      allStrategies.map((strategy, index) => ({
        id: createId("strategy"),
        searchRunId: runId,
        parentStrategyExecutionId: null,
        strategyType: strategy.strategyType,
        sourceType: strategy.sourceType,
        priority: index,
        reason: strategy.reason,
        strategyPayloadJson: JSON.stringify(strategy.strategyPayload),
        status: "queued" as const,
        estimatedSearchCost: strategy.estimatedSearchCost,
        actualSearchCost: null,
        startedAt: timestamp,
        finishedAt: null,
        candidateCount: 0,
        verifiedCandidateCount: 0,
        bestCandidateId: null,
        failureReason: null
      }))
    )
    .run();

  await markAcceptedAiProposalsApplied(
    sessionId,
    acceptedAiStrategies.map((strategy) => strategy.proposalId),
    runId
  );

  db.update(sessions)
    .set({
      isLive: session.monitoringState === "enabled",
      lifecycleState: session.monitoringState === "enabled" ? "live_running" : session.lifecycleState,
      lastRunStartedAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(sessions.id, sessionId))
    .run();

  return {
    runId,
    sessionId
  };
}
