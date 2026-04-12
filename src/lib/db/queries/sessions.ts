import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ensureAiStrategyProposals } from "@/lib/ai/strategy-proposals";
import { getDb } from "@/lib/db/client";
import { ensureExampleSession } from "@/lib/db/seed";
import {
  candidateLegs,
  candidateStopovers,
  itineraryCandidates
} from "@/lib/db/schema/candidate";
import {
  runAnalysisSnapshots,
  searchRuns,
  strategyExperimentGroups
} from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import {
  buildJourneyPreviewRows,
  type JourneyPreviewRow,
  type JourneyPreviewTone
} from "@/lib/journeys/route-preview";
import { resolveCityInput } from "@/lib/locations/catalog";
import { listSessionStrategySelections } from "@/lib/search-strategies/session-strategies";
import {
  formatDateChip,
  formatRelativeCountdown,
  formatRelativePast,
  formatTripLengthDays
} from "@/lib/time/formatting";

export type SessionCardRouteTone = JourneyPreviewTone;

export type SessionCardRouteRow = JourneyPreviewRow;

export type SessionListItem = {
  bestFare: string;
  id: string;
  lastRunFinishedAt: string | null;
  nextRefreshAt: string | null;
  refreshIntervalHours: number;
  isActiveRefresh: boolean;
  isLive: boolean;
  lifecycleState: string;
  monitoringState: string;
  name: string;
  primaryStatusText: string;
  routeRows: SessionCardRouteRow[];
  secondaryStatusText: string;
  stateLabel: string;
};

type BaselineExperimentRunSummary = {
  baselineLabel: string;
  bestFareFirstSeenQueryNumber: number | null;
  cheapestIntentionalMultiCityPrice: number | null;
  cheapestPrice: number | null;
  cityEntryFindingCount: number | null;
  distinctFamilyCount: number | null;
  duplicationRate: number | null;
  familyCoverageAfterHalfBudget: number | null;
  runId: string;
  samplingMode: string | null;
  startedAt: string;
  status?: string;
  strategyExperimentArmKey?: string | null;
  strategyExperimentArmLabel?: string | null;
  totalCandidatesFound: number;
  uniqueObservedStopoverCityCount: number | null;
};

export type BaselineExperimentSuiteSummary = {
  armCount: number;
  arms: Array<BaselineExperimentRunSummary & { finishedAt: string | null }>;
  championArmLabel: string | null;
  conclusionNote: string;
  createdAt: string;
  experimentMode: string;
  groupId: string;
  leaderArmLabel: string | null;
  sampleSize: number;
  status: string;
};

type BaselineExperimentSummaryRecord = {
  aggregateByBaseline: Array<{
    averageBestFareFirstSeenQueryNumber: number | null;
    averageCheapestPrice: number | null;
    averageCityEntryFindingCount: number | null;
    averageDistinctFamilyCount: number | null;
    averageDuplicationRate: number | null;
    averageFamilyCoverageAfterHalfBudget: number | null;
    averageUniqueObservedStopoverCityCount: number | null;
    baselineLabel: string;
    bestObservedCheapestPrice: number | null;
    intentionalMultiCityHitCount: number;
    latestRunAt: string | null;
    runCount: number;
  }>;
  currentReadout: {
    comparedBaselineCount: number;
    leadingBaselineLabel: string | null;
    note: string;
    rationale: string[];
  };
  latestSuite: BaselineExperimentSuiteSummary | null;
  recentRuns: BaselineExperimentRunSummary[];
};

function formatFare(currency: string | null, amount: number | null) {
  if (!currency || amount === null) {
    return "No fare yet";
  }

  return `${currency} ${amount.toLocaleString("en-AU", {
    maximumFractionDigits: 0
  })}`;
}

function formatStateLabel(
  lifecycleState: string,
  monitoringState: string,
  isLive: boolean,
  activeRunStatus: string | null
) {
  if (activeRunStatus === "blocked" || lifecycleState === "needs_attention") {
    return "Needs attention";
  }

  if (isLive && monitoringState === "enabled") {
    return "Live";
  }

  if (lifecycleState === "archived") {
    return "Archived";
  }

  return "Not live";
}

function resolveDestinationCode(cityName: string) {
  return resolveCityInput(cityName)?.code ?? cityName.slice(0, 3).toUpperCase();
}

function formatRefreshCadence(refreshIntervalHours: number) {
  return `Full refresh every ${refreshIntervalHours} hour${refreshIntervalHours === 1 ? "" : "s"}`;
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

function averageNumber(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numbers.length === 0) {
    return null;
  }

  return Number((numbers.reduce((total, value) => total + value, 0) / numbers.length).toFixed(4));
}

function compareMetric(left: number | null, right: number | null, direction: "higher" | "lower") {
  if (left === null || right === null) {
    return 0;
  }

  if (Math.abs(left - right) < 0.0001) {
    return 0;
  }

  if (direction === "lower") {
    return left < right ? 1 : -1;
  }

  return left > right ? 1 : -1;
}

function buildBaselineExperimentSummary(
  runs: BaselineExperimentRunSummary[]
): BaselineExperimentSummaryRecord {
  const aggregateByBaseline = [...runs.reduce((map, run) => {
    const current = map.get(run.baselineLabel) ?? [];
    current.push(run);
    map.set(run.baselineLabel, current);
    return map;
  }, new Map<string, typeof runs>()).entries()]
    .map(([baselineLabel, baselineRuns]) => ({
      averageBestFareFirstSeenQueryNumber: averageNumber(
        baselineRuns.map((run) => run.bestFareFirstSeenQueryNumber)
      ),
      averageCheapestPrice: averageNumber(baselineRuns.map((run) => run.cheapestPrice)),
      averageCityEntryFindingCount: averageNumber(
        baselineRuns.map((run) => run.cityEntryFindingCount)
      ),
      averageDistinctFamilyCount: averageNumber(
        baselineRuns.map((run) => run.distinctFamilyCount)
      ),
      averageDuplicationRate: averageNumber(baselineRuns.map((run) => run.duplicationRate)),
      averageFamilyCoverageAfterHalfBudget: averageNumber(
        baselineRuns.map((run) => run.familyCoverageAfterHalfBudget)
      ),
      averageUniqueObservedStopoverCityCount: averageNumber(
        baselineRuns.map((run) => run.uniqueObservedStopoverCityCount)
      ),
      baselineLabel,
      bestObservedCheapestPrice: averageNumber(
        baselineRuns
          .map((run) => run.cheapestPrice)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
          .sort((left, right) => left - right)
          .slice(0, 1)
      ),
      intentionalMultiCityHitCount: baselineRuns.filter(
        (run) => typeof run.cheapestIntentionalMultiCityPrice === "number"
      ).length,
      latestRunAt: baselineRuns[0]?.startedAt ?? null,
      runCount: baselineRuns.length
    }))
    .sort((left, right) => right.runCount - left.runCount || left.baselineLabel.localeCompare(right.baselineLabel));

  if (aggregateByBaseline.length < 2) {
    return {
      aggregateByBaseline,
      currentReadout: {
        comparedBaselineCount: aggregateByBaseline.length,
        leadingBaselineLabel: null,
        note:
          aggregateByBaseline.length === 0
            ? "No baseline experiment runs have been recorded for this session yet."
            : "Run the other baseline on the same session to start a meaningful comparison.",
        rationale: []
      },
      latestSuite: null,
      recentRuns: runs
    };
  }

  const [left, right] = aggregateByBaseline;
  let leftWins = 0;
  let rightWins = 0;
  const leftRationale: string[] = [];
  const rightRationale: string[] = [];
  const comparisons: Array<{
    direction: "higher" | "lower";
    formatter: (value: number | null) => string;
    leftValue: number | null;
    label: string;
    rightValue: number | null;
  }> = [
    {
      direction: "lower",
      formatter: (value) => (value === null ? "not recorded" : `query ${Math.round(value)}`),
      label: "best-fare discovery",
      leftValue: left.averageBestFareFirstSeenQueryNumber,
      rightValue: right.averageBestFareFirstSeenQueryNumber
    },
    {
      direction: "lower",
      formatter: (value) =>
        value === null
          ? "not recorded"
          : `AUD ${Math.round(value).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`,
      label: "cheapest fare",
      leftValue: left.averageCheapestPrice,
      rightValue: right.averageCheapestPrice
    },
    {
      direction: "higher",
      formatter: (value) => (value === null ? "not recorded" : `${Math.round(value * 100)}%`),
      label: "half-budget family coverage",
      leftValue: left.averageFamilyCoverageAfterHalfBudget,
      rightValue: right.averageFamilyCoverageAfterHalfBudget
    },
    {
      direction: "higher",
      formatter: (value) => (value === null ? "not recorded" : `${value.toFixed(1)} families`),
      label: "distinct family count",
      leftValue: left.averageDistinctFamilyCount,
      rightValue: right.averageDistinctFamilyCount
    },
    {
      direction: "higher",
      formatter: (value) => (value === null ? "not recorded" : `${value.toFixed(1)} city clues`),
      label: "stopover clue count",
      leftValue: left.averageUniqueObservedStopoverCityCount,
      rightValue: right.averageUniqueObservedStopoverCityCount
    }
  ];

  for (const comparison of comparisons) {
    const outcome = compareMetric(comparison.leftValue, comparison.rightValue, comparison.direction);
    if (outcome > 0) {
      leftWins += 1;
      leftRationale.push(
        `${comparison.label} ${comparison.formatter(comparison.leftValue)} vs ${comparison.formatter(comparison.rightValue)}`
      );
    } else if (outcome < 0) {
      rightWins += 1;
      rightRationale.push(
        `${comparison.label} ${comparison.formatter(comparison.rightValue)} vs ${comparison.formatter(comparison.leftValue)}`
      );
    }
  }

  const leadingBaselineLabel =
    leftWins === rightWins ? null : leftWins > rightWins ? left.baselineLabel : right.baselineLabel;

  return {
    aggregateByBaseline,
    currentReadout: {
      comparedBaselineCount: aggregateByBaseline.length,
      leadingBaselineLabel,
      note:
        leadingBaselineLabel === null
          ? "The current sample is too mixed to call a clear baseline winner yet."
          : `${leadingBaselineLabel} is currently ahead on this session, but keep alternating the two baselines on the same settings to confirm the lead holds.`,
      rationale:
        leadingBaselineLabel === left.baselineLabel
          ? leftRationale.slice(0, 3)
          : leadingBaselineLabel === right.baselineLabel
            ? rightRationale.slice(0, 3)
            : []
    },
    latestSuite: null,
    recentRuns: runs
  };
}

function extractBaselineExperimentRunSummary(
  run: {
    id: string;
    startedAt: string;
    status?: string;
    strategyExperimentArmKey?: string | null;
    strategyExperimentArmLabel?: string | null;
    totalCandidatesFound: number;
  },
  snapshots: Array<{
    analysisType: string;
    summaryJson: string | null;
  }>
): BaselineExperimentRunSummary {
  const efficiencySnapshot =
    snapshots.find((snapshot) => snapshot.analysisType === "baseline_execution_efficiency") ?? null;
  const efficiencySummary = safeJsonParse<{
    baselineLabel?: string | null;
    bestFareFirstSeenQueryNumber?: number | null;
    cheapestPrice?: number | null;
    distinctFamilyCount?: number | null;
    duplicationRate?: number | null;
    familyCoverageAfterHalfBudget?: number | null;
    samplingMode?: string | null;
    uniqueObservedStopoverCityCount?: number | null;
  }>(efficiencySnapshot?.summaryJson ?? null, {});
  const handoffSummary = safeJsonParse<{
    cityEntryFindings?: Array<unknown>;
  }>(
    snapshots.find((snapshot) => snapshot.analysisType === "baseline_followup_handoff")?.summaryJson ?? null,
    {}
  );
  const multiCitySummary = safeJsonParse<{
    cheapestMultiCityCandidate?: {
      displayedAmount?: number | null;
    } | null;
  }>(
    snapshots.find((snapshot) => snapshot.analysisType === "multi_city_verification_results")?.summaryJson ?? null,
    {}
  );
  const anchoredMultiCitySummary = safeJsonParse<{
    cheapestMultiCityCandidate?: {
      displayedAmount?: number | null;
    } | null;
  }>(
    snapshots.find((snapshot) => snapshot.analysisType === "anchored_multi_city_results")?.summaryJson ?? null,
    {}
  );

  return {
    baselineLabel:
      efficiencySummary.baselineLabel ?? (
        efficiencySummary.samplingMode === "adaptive_coverage"
          ? "Adaptive coverage baseline"
          : run.strategyExperimentArmLabel ?? "Round trip baseline"
      ),
    bestFareFirstSeenQueryNumber:
      typeof efficiencySummary.bestFareFirstSeenQueryNumber === "number"
        ? efficiencySummary.bestFareFirstSeenQueryNumber
        : null,
    cheapestIntentionalMultiCityPrice:
      typeof anchoredMultiCitySummary.cheapestMultiCityCandidate?.displayedAmount === "number"
        ? anchoredMultiCitySummary.cheapestMultiCityCandidate.displayedAmount
        : typeof multiCitySummary.cheapestMultiCityCandidate?.displayedAmount === "number"
          ? multiCitySummary.cheapestMultiCityCandidate.displayedAmount
        : null,
    cheapestPrice:
      typeof efficiencySummary.cheapestPrice === "number" ? efficiencySummary.cheapestPrice : null,
    cityEntryFindingCount: Array.isArray(handoffSummary.cityEntryFindings)
      ? handoffSummary.cityEntryFindings.length
      : null,
    distinctFamilyCount:
      typeof efficiencySummary.distinctFamilyCount === "number"
        ? efficiencySummary.distinctFamilyCount
        : null,
    duplicationRate:
      typeof efficiencySummary.duplicationRate === "number" ? efficiencySummary.duplicationRate : null,
    familyCoverageAfterHalfBudget:
      typeof efficiencySummary.familyCoverageAfterHalfBudget === "number"
        ? efficiencySummary.familyCoverageAfterHalfBudget
        : null,
    runId: run.id,
    samplingMode: efficiencySummary.samplingMode ?? null,
    startedAt: run.startedAt,
    status: run.status,
    strategyExperimentArmKey: run.strategyExperimentArmKey ?? null,
    strategyExperimentArmLabel: run.strategyExperimentArmLabel ?? null,
    totalCandidatesFound: run.totalCandidatesFound,
    uniqueObservedStopoverCityCount:
      typeof efficiencySummary.uniqueObservedStopoverCityCount === "number"
        ? efficiencySummary.uniqueObservedStopoverCityCount
        : null
  };
}

function buildBaselineExperimentSuiteSummary(props: {
  arms: Array<BaselineExperimentRunSummary & { finishedAt: string | null }>;
  championArmLabel: string | null;
  createdAt: string;
  experimentMode: string;
  groupId: string;
  sampleSize: number;
}) {
  const { arms } = props;
  const hasActiveArms = arms.some((arm) => ["queued", "running", "paused", "blocked"].includes(arm.status ?? ""));
  const completedArms = arms.filter((arm) => arm.status === "completed");
  const cancelledArms = arms.filter((arm) => arm.status === "cancelled");

  const sortedCompletedArms = [...completedArms].sort((left, right) => {
    const cheapestDelta =
      (typeof left.cheapestPrice === "number" ? left.cheapestPrice : Number.POSITIVE_INFINITY) -
      (typeof right.cheapestPrice === "number" ? right.cheapestPrice : Number.POSITIVE_INFINITY);
    if (Math.abs(cheapestDelta) > 0.0001) {
      return cheapestDelta;
    }

    const bestFareQueryDelta =
      (typeof left.bestFareFirstSeenQueryNumber === "number"
        ? left.bestFareFirstSeenQueryNumber
        : Number.POSITIVE_INFINITY) -
      (typeof right.bestFareFirstSeenQueryNumber === "number"
        ? right.bestFareFirstSeenQueryNumber
        : Number.POSITIVE_INFINITY);
    if (Math.abs(bestFareQueryDelta) > 0.0001) {
      return bestFareQueryDelta;
    }

    const coverageDelta =
      (typeof right.familyCoverageAfterHalfBudget === "number"
        ? right.familyCoverageAfterHalfBudget
        : Number.NEGATIVE_INFINITY) -
      (typeof left.familyCoverageAfterHalfBudget === "number"
        ? left.familyCoverageAfterHalfBudget
        : Number.NEGATIVE_INFINITY);
    if (Math.abs(coverageDelta) > 0.0001) {
      return coverageDelta;
    }

    return left.baselineLabel.localeCompare(right.baselineLabel);
  });

  const leader = sortedCompletedArms[0] ?? null;
  const status = hasActiveArms
    ? "running"
    : completedArms.length === arms.length
      ? "completed"
      : completedArms.length > 0
        ? "partial"
        : cancelledArms.length === arms.length
          ? "cancelled"
          : "failed";
  const conclusionNote =
    leader && completedArms.length > 1
      ? `${leader.baselineLabel} is currently leading this experiment suite on the recorded arm results.`
      : hasActiveArms
        ? "This experiment suite is still running. Wait for all arms to finish before treating the comparison as meaningful."
        : "The experiment suite has not produced enough completed arm results to call a leader yet.";

  return {
    armCount: arms.length,
    arms,
    championArmLabel: props.championArmLabel,
    conclusionNote,
    createdAt: props.createdAt,
    experimentMode: props.experimentMode,
    groupId: props.groupId,
    leaderArmLabel: leader?.baselineLabel ?? null,
    sampleSize: props.sampleSize,
    status
  } satisfies BaselineExperimentSuiteSummary;
}

function buildStatusCopy(row: {
  isLive: boolean;
  lastRunFinishedAt: string | null;
  lifecycleState: string;
  monitoringState: string;
  nextRefreshAt: string | null;
  refreshIntervalHours: number;
}, activeRun: {
  failureReason: string | null;
  status: string;
  summaryText: string | null;
} | null) {
  if (activeRun?.status === "running") {
    return {
      isActiveRefresh: true,
      primaryStatusText: "Refresh running now",
      secondaryStatusText:
        activeRun.summaryText ?? "Trip.com is collecting updated fares right now."
    };
  }

  if (activeRun?.status === "queued") {
    return {
      isActiveRefresh: true,
      primaryStatusText: "Refresh queued",
      secondaryStatusText: activeRun.summaryText ?? "The next Trip.com run is queued locally."
    };
  }

  if (activeRun?.status === "blocked" || row.lifecycleState === "needs_attention") {
    return {
      isActiveRefresh: false,
      primaryStatusText: "Needs attention",
      secondaryStatusText:
        activeRun?.failureReason ??
        "Trip.com interrupted the last run and manual recovery is required."
    };
  }

  if (row.lifecycleState === "archived") {
    return {
      isActiveRefresh: false,
      primaryStatusText: "Archived",
      secondaryStatusText: "This session is stored for reference and will not refresh."
    };
  }

  if (row.monitoringState === "enabled" && row.isLive) {
    return {
      isActiveRefresh: false,
      primaryStatusText: formatRelativeCountdown(row.nextRefreshAt),
      secondaryStatusText: `${formatRelativePast(row.lastRunFinishedAt)}. ${formatRefreshCadence(row.refreshIntervalHours)}.`
    };
  }

  if (row.lastRunFinishedAt) {
    return {
      isActiveRefresh: false,
      primaryStatusText: formatRelativePast(row.lastRunFinishedAt),
      secondaryStatusText: `Monitoring is off. ${formatRefreshCadence(row.refreshIntervalHours)} once live.`
    };
  }

  return {
    isActiveRefresh: false,
    primaryStatusText: "Ready for first run",
    secondaryStatusText: `Monitoring is off. ${formatRefreshCadence(row.refreshIntervalHours)} once live.`
  };
}

export async function listSessionsForDashboard(): Promise<SessionListItem[]> {
  await ensureExampleSession();

  const db = getDb();
  const rows = db
    .select({
      currentBestCandidateId: sessions.currentBestCandidateId,
      id: sessions.id,
      isLive: sessions.isLive,
      lastRunFinishedAt: sessions.lastRunFinishedAt,
      lifecycleState: sessions.lifecycleState,
      monitoringState: sessions.monitoringState,
      name: sessions.name,
      nextRefreshAt: sessions.nextRefreshAt,
      originAirport: sessions.originAirport,
      outboundDestinationCity: sessions.outboundDestinationCity,
      departureStartDate: sessions.departureStartDate,
      refreshIntervalHours: sessions.refreshIntervalHours,
      bestCurrency: itineraryCandidates.displayedDisplayCurrency,
      bestAmount: itineraryCandidates.displayedDisplayAmount
    })
    .from(sessions)
    .leftJoin(itineraryCandidates, eq(itineraryCandidates.id, sessions.currentBestCandidateId))
    .orderBy(desc(sessions.updatedAt))
    .all();

  const bestCandidateIds = rows
    .map((row) => row.currentBestCandidateId)
    .filter((value): value is string => Boolean(value));

  const legs = bestCandidateIds.length
    ? db
        .select()
        .from(candidateLegs)
        .where(inArray(candidateLegs.itineraryCandidateId, bestCandidateIds))
        .orderBy(candidateLegs.legIndex)
        .all()
    : [];
  const stopovers = bestCandidateIds.length
    ? db
        .select()
        .from(candidateStopovers)
        .where(inArray(candidateStopovers.itineraryCandidateId, bestCandidateIds))
        .orderBy(candidateStopovers.stopIndex)
        .all()
    : [];

  const legsByCandidateId = new Map<string, typeof legs>();
  const stopoversByCandidateId = new Map<string, typeof stopovers>();

  for (const leg of legs) {
    const current = legsByCandidateId.get(leg.itineraryCandidateId) ?? [];
    current.push(leg);
    legsByCandidateId.set(leg.itineraryCandidateId, current);
  }

  for (const stopover of stopovers) {
    const current = stopoversByCandidateId.get(stopover.itineraryCandidateId) ?? [];
    current.push(stopover);
    stopoversByCandidateId.set(stopover.itineraryCandidateId, current);
  }

  return rows.map((row) => {
    const activeRun = db
      .select({
        failureReason: searchRuns.failureReason,
        status: searchRuns.status,
        summaryText: searchRuns.summaryText
      })
      .from(searchRuns)
      .where(eq(searchRuns.sessionId, row.id))
      .orderBy(desc(searchRuns.startedAt))
      .get();
    const bestCandidateLegs = row.currentBestCandidateId
      ? legsByCandidateId.get(row.currentBestCandidateId) ?? []
      : [];
    const bestCandidateStopovers = row.currentBestCandidateId
      ? stopoversByCandidateId.get(row.currentBestCandidateId) ?? []
      : [];
    const firstLeg = bestCandidateLegs[0];
    const returnLeg =
      bestCandidateLegs.find((leg) => leg.segmentGroup === "return") ??
      bestCandidateLegs[bestCandidateLegs.length - 1];
    const statusCopy = buildStatusCopy(row, activeRun ?? null);
    const routeRows = buildJourneyPreviewRows({
      departureStartDate: row.departureStartDate,
      fallbackDestinationLabel: row.outboundDestinationCity,
      legs: bestCandidateLegs.map((leg) => ({
        arrivalAt: leg.arrivalAt,
        departureAt: leg.departureAt,
        destinationAirport: leg.destinationAirport,
        originAirport: leg.originAirport
      })),
      originAirport: row.originAirport
    });

    return {
      id: row.id,
      lastRunFinishedAt: row.lastRunFinishedAt,
      nextRefreshAt: row.nextRefreshAt,
      refreshIntervalHours: row.refreshIntervalHours,
      isActiveRefresh: statusCopy.isActiveRefresh,
      isLive: row.isLive,
      lifecycleState: row.lifecycleState,
      monitoringState: row.monitoringState,
      name: row.name,
      stateLabel: formatStateLabel(
        row.lifecycleState,
        row.monitoringState,
        row.isLive,
        activeRun?.status ?? null
      ),
      bestFare: formatFare(row.bestCurrency, row.bestAmount),
      routeRows,
      primaryStatusText: statusCopy.primaryStatusText,
      secondaryStatusText: statusCopy.secondaryStatusText
    };
  });
}

export async function countSessions() {
  await ensureExampleSession();

  const db = getDb();
  const result = db.select({ count: sql<number>`count(*)` }).from(sessions).get();

  return result?.count ?? 0;
}

export async function getSessionById(sessionId: string) {
  await ensureExampleSession();

  const db = getDb();
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) {
    return null;
  }

  const aiProposals = await ensureAiStrategyProposals(session);
  const strategySelections = listSessionStrategySelections(session.id, session);

  const currentBestCandidate = session.currentBestCandidateId
    ? db
        .select({
          id: itineraryCandidates.id,
          displayedDisplayAmount: itineraryCandidates.displayedDisplayAmount,
          displayedDisplayCurrency: itineraryCandidates.displayedDisplayCurrency,
          latestVerificationStatus: itineraryCandidates.latestVerificationStatus
        })
        .from(itineraryCandidates)
        .where(eq(itineraryCandidates.id, session.currentBestCandidateId))
        .get()
    : null;
  const latestRun = db
    .select({
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status,
      summaryText: searchRuns.summaryText
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .get() ?? null;
  const activeRuns = db
    .select({
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status,
      summaryText: searchRuns.summaryText
    })
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.sessionId, sessionId),
        inArray(searchRuns.status, ["queued", "running", "blocked", "paused"])
      )
    )
    .all()
    .sort((left, right) => {
      const statusOrder: Record<string, number> = {
        running: 0,
        blocked: 1,
        paused: 2,
        queued: 3
      };
      const statusDelta =
        (statusOrder[left.status] ?? Number.MAX_SAFE_INTEGER) -
        (statusOrder[right.status] ?? Number.MAX_SAFE_INTEGER);

      if (statusDelta !== 0) {
        return statusDelta;
      }

      return left.startedAt.localeCompare(right.startedAt);
    });
  const latestAnalysisSnapshots = latestRun
    ? db
        .select({
          analysisType: runAnalysisSnapshots.analysisType,
          createdAt: runAnalysisSnapshots.createdAt,
          summaryJson: runAnalysisSnapshots.summaryJson
        })
        .from(runAnalysisSnapshots)
        .where(eq(runAnalysisSnapshots.searchRunId, latestRun.id))
        .orderBy(desc(runAnalysisSnapshots.createdAt))
        .all()
    : [];
  const recentCompletedRuns = db
    .select({
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      strategyExperimentArmKey: searchRuns.strategyExperimentArmKey,
      strategyExperimentArmLabel: searchRuns.strategyExperimentArmLabel,
      status: searchRuns.status,
      totalCandidatesFound: searchRuns.totalCandidatesFound
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .limit(16)
    .all()
    .filter((run) => run.status === "completed");
  const latestExperimentGroup = db
    .select({
      championStrategyKey: strategyExperimentGroups.championStrategyKey,
      createdAt: strategyExperimentGroups.createdAt,
      experimentMode: strategyExperimentGroups.experimentMode,
      groupId: strategyExperimentGroups.id,
      sampleSize: strategyExperimentGroups.sampleSize,
      status: strategyExperimentGroups.status,
      summaryJson: strategyExperimentGroups.summaryJson
    })
    .from(strategyExperimentGroups)
    .where(eq(strategyExperimentGroups.sessionId, sessionId))
    .orderBy(desc(strategyExperimentGroups.createdAt))
    .get() ?? null;
  const latestExperimentRuns = latestExperimentGroup
    ? db
        .select({
          finishedAt: searchRuns.finishedAt,
          id: searchRuns.id,
          startedAt: searchRuns.startedAt,
          status: searchRuns.status,
          strategyExperimentArmKey: searchRuns.strategyExperimentArmKey,
          strategyExperimentArmLabel: searchRuns.strategyExperimentArmLabel,
          totalCandidatesFound: searchRuns.totalCandidatesFound
        })
        .from(searchRuns)
        .where(eq(searchRuns.strategyExperimentGroupId, latestExperimentGroup.groupId))
        .orderBy(desc(searchRuns.startedAt))
        .all()
    : [];
  const experimentRunIds = recentCompletedRuns.map((run) => run.id);
  const baselineExperimentSnapshots = experimentRunIds.length
    ? db
        .select({
          analysisType: runAnalysisSnapshots.analysisType,
          createdAt: runAnalysisSnapshots.createdAt,
          searchRunId: runAnalysisSnapshots.searchRunId,
          summaryJson: runAnalysisSnapshots.summaryJson
        })
        .from(runAnalysisSnapshots)
        .where(inArray(runAnalysisSnapshots.searchRunId, experimentRunIds))
        .orderBy(desc(runAnalysisSnapshots.createdAt))
        .all()
    : [];
  const latestExperimentRunIds = latestExperimentRuns.map((run) => run.id);
  const latestExperimentSnapshots = latestExperimentRunIds.length
    ? db
        .select({
          analysisType: runAnalysisSnapshots.analysisType,
          createdAt: runAnalysisSnapshots.createdAt,
          searchRunId: runAnalysisSnapshots.searchRunId,
          summaryJson: runAnalysisSnapshots.summaryJson
        })
        .from(runAnalysisSnapshots)
        .where(inArray(runAnalysisSnapshots.searchRunId, latestExperimentRunIds))
        .orderBy(desc(runAnalysisSnapshots.createdAt))
        .all()
    : [];
  const experimentSnapshotsByRun = baselineExperimentSnapshots.reduce((map, snapshot) => {
    const current = map.get(snapshot.searchRunId) ?? [];
    current.push(snapshot);
    map.set(snapshot.searchRunId, current);
    return map;
  }, new Map<string, typeof baselineExperimentSnapshots>());
  const latestExperimentSnapshotsByRun = latestExperimentSnapshots.reduce((map, snapshot) => {
    const current = map.get(snapshot.searchRunId) ?? [];
    current.push(snapshot);
    map.set(snapshot.searchRunId, current);
    return map;
  }, new Map<string, typeof latestExperimentSnapshots>());
  const findLatestAnalysis = (analysisType: string) =>
    latestAnalysisSnapshots.find((snapshot) => snapshot.analysisType === analysisType) ?? null;
  const recentBaselineRuns = recentCompletedRuns
    .map((run) => {
      const snapshots = experimentSnapshotsByRun.get(run.id) ?? [];

      if (!snapshots.some((snapshot) => snapshot.analysisType === "baseline_execution_efficiency")) {
        return null;
      }

      return extractBaselineExperimentRunSummary(run, snapshots);
    })
    .filter((run): run is NonNullable<typeof run> => Boolean(run));
  const baselineExperiment = buildBaselineExperimentSummary(recentBaselineRuns);
  const latestSuite =
    latestExperimentGroup && latestExperimentRuns.length > 0
      ? buildBaselineExperimentSuiteSummary({
          arms: latestExperimentRuns.map((run) => ({
            ...extractBaselineExperimentRunSummary(
              run,
              latestExperimentSnapshotsByRun.get(run.id) ?? []
            ),
            finishedAt: run.finishedAt
          })),
          championArmLabel:
            latestExperimentRuns.find(
              (run) => run.strategyExperimentArmKey === latestExperimentGroup.championStrategyKey
            )?.strategyExperimentArmLabel ?? null,
          createdAt: latestExperimentGroup.createdAt,
          experimentMode: latestExperimentGroup.experimentMode,
          groupId: latestExperimentGroup.groupId,
          sampleSize: latestExperimentGroup.sampleSize
        })
      : null;
  baselineExperiment.latestSuite = latestSuite;

  return {
    aiProposals,
    activeRunCount: activeRuns.length,
    baselineExperiment,
    currentActiveRun: activeRuns[0] ?? null,
    currentBestCandidate,
    hasRunnableActiveRun: activeRuns.some(
      (activeRun) => activeRun.status === "queued" || activeRun.status === "running"
    ),
    latestRun,
    latestStrategyEvidence: {
      baselineExecutionEfficiency: (() => {
        const snapshot = findLatestAnalysis("baseline_execution_efficiency");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      baselineFollowupHandoff: (() => {
        const snapshot = findLatestAnalysis("baseline_followup_handoff");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      baselineReturnOptionExpansion: (() => {
        const snapshot = findLatestAnalysis("baseline_return_option_expansion");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      alternateReturnCitySummary: (() => {
        const snapshot = findLatestAnalysis("alternate_return_city_summary");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      anchoredMultiCityResults: (() => {
        const snapshot = findLatestAnalysis("anchored_multi_city_results");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      multiCityLongStopFollowup: (() => {
        const snapshot = findLatestAnalysis("multi_city_long_stop_followup");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      multiCityLongStopValidation: (() => {
        const snapshot = findLatestAnalysis("multi_city_long_stop_validation");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      multiCityVerificationRank: (() => {
        const snapshot = findLatestAnalysis("multi_city_verification_rank");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      multiCityVerificationResults: (() => {
        const snapshot = findLatestAnalysis("multi_city_verification_results");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })(),
      pass1MarketScan: (() => {
        const snapshot = findLatestAnalysis("pass1_market_scan");
        return snapshot
          ? {
              createdAt: snapshot.createdAt,
              summary: safeJsonParse(snapshot.summaryJson, null)
            }
          : null;
      })()
    },
    preferences: [],
    strategySelections,
    session
  };
}
