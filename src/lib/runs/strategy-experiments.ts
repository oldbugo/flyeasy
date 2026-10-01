import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/db/ids";
import { runAnalysisSnapshots, searchRuns, strategyExperimentGroups } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import {
  DATE_STRATEGY_TEST_ARMS,
  isMarketScanStrategySelection,
  type DateSamplingMode,
  type SearchStrategyBundleSelection
} from "@/lib/search-strategies/catalog";
import { listSessionStrategySelections } from "@/lib/search-strategies/session-strategies";

import { createRunFromSession } from "./create-run-from-session";

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse<T>(value: string | null, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createDeterministicUnitInterval(seed: string) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const slice = hash.slice(0, 12);
  return Number.parseInt(slice, 16) / 16 ** slice.length;
}

type ExperimentArm = {
  armKey: string;
  isChampion: boolean;
  samplingModeOverride: DateSamplingMode | null;
  strategyKey: SearchStrategyBundleSelection["strategyKey"];
  title: string;
};

function shuffleBySeed<T>(values: T[], seed: string, keyOf: (value: T) => string) {
  return [...values].sort(
    (left, right) =>
      createDeterministicUnitInterval(`${seed}:${keyOf(left)}`) -
      createDeterministicUnitInterval(`${seed}:${keyOf(right)}`)
  );
}

// The session's current baseline is the champion. The date-plan arms under
// test (docs/uplifts/2026-10-date-search-strategy/03b) take the challenger
// slots first; other baselines fill any slots left over.
function selectExperimentBaselineArms(
  selections: SearchStrategyBundleSelection[],
  sampleSize: number,
  seed: string
): ExperimentArm[] {
  const baselineSelections = selections.filter(
    (selection) =>
      (selection.strategyKey === "price_first_market_scan" ||
        selection.strategyKey === "adaptive_coverage_market_scan") &&
      selection.compatibility.isCompatible
  );
  const champion =
    baselineSelections.find((selection) => selection.enabled) ?? baselineSelections[0] ?? null;

  if (!champion) {
    return [];
  }

  const toArm = (selection: SearchStrategyBundleSelection): ExperimentArm => ({
    armKey: selection.strategyKey,
    isChampion: selection.strategyKey === champion.strategyKey,
    samplingModeOverride: null,
    strategyKey: selection.strategyKey,
    title: selection.title
  });
  const hasRoundTripBaseline = baselineSelections.some(
    (selection) => selection.strategyKey === "price_first_market_scan"
  );
  const dateArms: ExperimentArm[] = hasRoundTripBaseline
    ? DATE_STRATEGY_TEST_ARMS.map((arm) => ({
        armKey: arm.armKey,
        isChampion: false,
        samplingModeOverride: arm.samplingMode,
        strategyKey: "price_first_market_scan",
        title: arm.title
      }))
    : [];
  const otherBaselines = baselineSelections
    .filter((selection) => selection.strategyKey !== champion.strategyKey)
    .map(toArm);
  const challengers = [
    ...shuffleBySeed(dateArms, seed, (arm) => arm.armKey),
    ...shuffleBySeed(otherBaselines, seed, (arm) => arm.armKey)
  ];
  const selected = [toArm(champion), ...challengers].slice(0, Math.max(0, sampleSize));

  // Run the arms in a random order so price drift during a suite does not
  // consistently favour whichever arm runs first.
  return selected.length < 2 ? [] : shuffleBySeed(selected, `${seed}:order`, (arm) => arm.armKey);
}

function overrideBaselineSelection(
  selections: SearchStrategyBundleSelection[],
  arm: ExperimentArm
): SearchStrategyBundleSelection[] {
  return selections.map((selection) => {
    if (
      selection.strategyKey !== "price_first_market_scan" &&
      selection.strategyKey !== "adaptive_coverage_market_scan"
    ) {
      return selection;
    }

    const enabled = selection.strategyKey === arm.strategyKey;

    if (isMarketScanStrategySelection(selection)) {
      return {
        ...selection,
        config: {
          ...selection.config,
          samplingModeOverride: enabled ? arm.samplingModeOverride : null
        },
        enabled
      };
    }

    return { ...selection, enabled };
  });
}

export async function createBaselineExperimentSuite(sessionId: string) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session || session.strategyExperimentMode !== "baseline_parallel_random") {
    return null;
  }

  const strategySelections = listSessionStrategySelections(session.id, session);
  const randomSeed = crypto.randomUUID();
  const selectedArms = selectExperimentBaselineArms(
    strategySelections,
    session.strategyExperimentSampleSize,
    randomSeed
  );

  if (selectedArms.length < 2) {
    return null;
  }

  const timestamp = nowIso();
  const groupId = createId("strategy_experiment");
  const champion = selectedArms.find((arm) => arm.isChampion) ?? null;

  db.insert(strategyExperimentGroups)
    .values({
      id: groupId,
      sessionId,
      experimentMode: "baseline_parallel_random",
      status: "running",
      sampleSize: selectedArms.length,
      championStrategyKey: champion?.strategyKey ?? null,
      selectedStrategyKeysJson: JSON.stringify(selectedArms.map((arm) => arm.armKey)),
      randomSeed,
      summaryJson: null,
      startedAt: timestamp,
      finishedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();

  const runs = [];

  for (const arm of selectedArms) {
    const createdRun = await createRunFromSession(sessionId, {
      experimentMetadata: {
        armKey: arm.armKey,
        armLabel: arm.title,
        groupId
      },
      strategySelectionsOverride: overrideBaselineSelection(strategySelections, arm)
    });

    if (createdRun) {
      runs.push({
        ...createdRun,
        armKey: arm.armKey,
        armLabel: arm.title
      });
    }
  }

  return runs.length > 0
    ? {
        championArmLabel: champion?.title ?? null,
        groupId,
        runs
      }
    : null;
}

export function refreshStrategyExperimentGroup(groupId: string) {
  const db = getDb();
  const group = db
    .select()
    .from(strategyExperimentGroups)
    .where(eq(strategyExperimentGroups.id, groupId))
    .get();

  if (!group) {
    return null;
  }

  const runs = db
    .select({
      finishedAt: searchRuns.finishedAt,
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status,
      strategyExperimentArmKey: searchRuns.strategyExperimentArmKey,
      strategyExperimentArmLabel: searchRuns.strategyExperimentArmLabel
    })
    .from(searchRuns)
    .where(eq(searchRuns.strategyExperimentGroupId, groupId))
    .all();

  if (runs.length === 0) {
    return null;
  }

  const snapshots = db
    .select({
      analysisType: runAnalysisSnapshots.analysisType,
      searchRunId: runAnalysisSnapshots.searchRunId,
      summaryJson: runAnalysisSnapshots.summaryJson
    })
    .from(runAnalysisSnapshots)
    .where(inArray(runAnalysisSnapshots.searchRunId, runs.map((run) => run.id)))
    .all();
  const snapshotsByRun = snapshots.reduce((map, snapshot) => {
    const current = map.get(snapshot.searchRunId) ?? [];
    current.push(snapshot);
    map.set(snapshot.searchRunId, current);
    return map;
  }, new Map<string, typeof snapshots>());
  const armSummaries = runs.map((run) => {
    const runSnapshots = snapshotsByRun.get(run.id) ?? [];
    const efficiencySummary = safeJsonParse<{
      baselineLabel?: string | null;
      bestFareFirstSeenQueryNumber?: number | null;
      cheapestPrice?: number | null;
      familyCoverageAfterHalfBudget?: number | null;
      samplingMode?: string | null;
    }>(
      runSnapshots.find((snapshot) => snapshot.analysisType === "baseline_execution_efficiency")
        ?.summaryJson ?? null,
      {}
    );

    return {
      armKey: run.strategyExperimentArmKey ?? null,
      armLabel:
        efficiencySummary.baselineLabel ??
        run.strategyExperimentArmLabel ??
        (efficiencySummary.samplingMode === "adaptive_coverage"
          ? "Adaptive coverage baseline"
          : "Round trip baseline"),
      bestFareFirstSeenQueryNumber:
        typeof efficiencySummary.bestFareFirstSeenQueryNumber === "number"
          ? efficiencySummary.bestFareFirstSeenQueryNumber
          : null,
      cheapestPrice:
        typeof efficiencySummary.cheapestPrice === "number" ? efficiencySummary.cheapestPrice : null,
      familyCoverageAfterHalfBudget:
        typeof efficiencySummary.familyCoverageAfterHalfBudget === "number"
          ? efficiencySummary.familyCoverageAfterHalfBudget
          : null,
      finishedAt: run.finishedAt,
      runId: run.id,
      startedAt: run.startedAt,
      status: run.status
    };
  });

  const leader = [...armSummaries]
    .filter((arm) => arm.status === "completed")
    .sort((left, right) => {
      const cheapestDelta =
        (typeof left.cheapestPrice === "number" ? left.cheapestPrice : Number.POSITIVE_INFINITY) -
        (typeof right.cheapestPrice === "number" ? right.cheapestPrice : Number.POSITIVE_INFINITY);
      if (Math.abs(cheapestDelta) > 0.0001) {
        return cheapestDelta;
      }

      const bestFareDelta =
        (typeof left.bestFareFirstSeenQueryNumber === "number"
          ? left.bestFareFirstSeenQueryNumber
          : Number.POSITIVE_INFINITY) -
        (typeof right.bestFareFirstSeenQueryNumber === "number"
          ? right.bestFareFirstSeenQueryNumber
          : Number.POSITIVE_INFINITY);
      if (Math.abs(bestFareDelta) > 0.0001) {
        return bestFareDelta;
      }

      return (
        (typeof right.familyCoverageAfterHalfBudget === "number"
          ? right.familyCoverageAfterHalfBudget
          : Number.NEGATIVE_INFINITY) -
        (typeof left.familyCoverageAfterHalfBudget === "number"
          ? left.familyCoverageAfterHalfBudget
          : Number.NEGATIVE_INFINITY)
      );
    })[0] ?? null;
  const hasActiveRuns = runs.some((run) => ["queued", "running", "paused", "blocked"].includes(run.status));
  const completedRuns = runs.filter((run) => run.status === "completed");
  const cancelledRuns = runs.filter((run) => run.status === "cancelled");
  const status = hasActiveRuns
    ? "running"
    : completedRuns.length === runs.length
      ? "completed"
      : completedRuns.length > 0
        ? "partial"
        : cancelledRuns.length === runs.length
          ? "cancelled"
          : "failed";
  const timestamp = nowIso();

  db.update(strategyExperimentGroups)
    .set({
      finishedAt: hasActiveRuns ? null : timestamp,
      status,
      summaryJson: JSON.stringify({
        armCount: armSummaries.length,
        arms: armSummaries,
        conclusionNote: leader
          ? `${leader.armLabel} is currently leading this experiment suite on the recorded arm results.`
          : hasActiveRuns
            ? "The experiment suite is still running."
            : "No completed arm has produced a clear leader yet.",
        leaderArmLabel: leader?.armLabel ?? null,
        updatedAt: timestamp
      }),
      updatedAt: timestamp
    })
    .where(eq(strategyExperimentGroups.id, groupId))
    .run();

  return {
    armCount: armSummaries.length,
    leaderArmLabel: leader?.armLabel ?? null,
    status
  };
}
