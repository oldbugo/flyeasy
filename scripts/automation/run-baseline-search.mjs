import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { chromium } from "playwright";

import {
  ensureFlyEasyPaths,
  resolveBetterSqliteBindingPath,
  resolveFlyEasyAppRoot
} from "../lib/flyeasy-paths.mjs";
import { writeConnectionState, writeWorkerState } from "./lib/runtime-state.mjs";
import {
  buildAlternateReturnCityTargets as buildAlternateReturnCityTargetsFromEvidence,
  buildAnchoredMultiCityResultsSummary as buildAnchoredMultiCityResultsSummaryFromEvidence,
  buildBaselineFollowupHandoff as buildBaselineFollowupHandoffFromEvidence,
  buildMultiCityVerificationFollowupTargets as buildMultiCityVerificationFollowupTargetsFromEvidence,
  buildMultiCityVerificationResultsSummary as buildMultiCityVerificationResultsSummaryFromEvidence,
  buildMultiCityVerificationSeedBoard as buildMultiCityVerificationSeedBoardFromEvidence,
  buildRecommendationDateCoverageTargets as buildRecommendationDateCoverageTargetsFromEvidence,
  buildLongStopFollowupTargets as buildLongStopFollowupTargetsFromEvidence,
  buildLongStopValidationSummary as buildLongStopValidationSummaryFromEvidence,
  buildMultiCityVerificationEvidence as buildMultiCityVerificationEvidenceFromEvidence,
  buildPreferredSignalSets as buildPreferredSignalSetsFromEvidence,
  collectRecordedStopoverEvidence as collectRecordedStopoverEvidenceFromEvidence
} from "./lib/search-evidence.mjs";
import {
  captureStageArtifacts,
  collectConnectionObservation,
  detectNoResultsState,
  inferStopCount,
  parseStopoverFilterOptions,
  parseVisibleCards
} from "./lib/tripcom-browser.mjs";
import { isChinaBasedAirline } from "./lib/china-based-airlines.mjs";

const runId = process.argv[2];
const isResume = process.env.FLYEASY_RUN_RESUME === "1";
const forceBlocked = process.env.FLYEASY_FORCE_BLOCKED === "1";
const timeoutMs = Number(process.env.FLYEASY_AUTOMATION_TIMEOUT_MS ?? 180_000);
const headless = process.env.FLYEASY_AUTOMATION_HEADFUL === "1" ? false : true;
const directCardScanLimit = Math.max(24, Number(process.env.FLYEASY_DIRECT_CARD_SCAN_LIMIT ?? 80));
const returnCardScanLimit = Math.max(18, Number(process.env.FLYEASY_RETURN_CARD_SCAN_LIMIT ?? 60));
const expandedReturnCardScanLimit = Math.max(
  18,
  Number(process.env.FLYEASY_EXPANDED_RETURN_CARD_SCAN_LIMIT ?? 48)
);
const scheduleSimilarityBucketMinutes = Math.max(
  30,
  Number(process.env.FLYEASY_CARD_SCHEDULE_BUCKET_MINUTES ?? 90)
);
const suspiciousEmptyResultRetryLimit = Math.max(
  0,
  Number(process.env.FLYEASY_SUSPICIOUS_EMPTY_RESULT_RETRY_LIMIT ?? 1)
);
const familyCoverageDateBucketDays = Math.max(
  2,
  Number(process.env.FLYEASY_FAMILY_COVERAGE_DATE_BUCKET_DAYS ?? 3)
);
const cityCatalog = JSON.parse(
  fs.readFileSync(new URL("../../src/lib/locations/data/cities.json", import.meta.url), "utf8")
);
const dispatchQueueScriptPath = fileURLToPath(new URL("./dispatch-run-queue.mjs", import.meta.url));
const historicalDatePairEvidenceCache = new Map();

if (!runId) {
  throw new Error("runId argument is required.");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(baseIso, minutes) {
  return new Date(new Date(baseIso).getTime() + minutes * 60_000).toISOString();
}

function addDays(baseDate, days) {
  return new Date(new Date(`${baseDate}T00:00:00.000Z`).getTime() + days * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
}

function guessAirportCode(cityOrAirport) {
  const map = {
    Beijing: "PEK",
    CAN: "CAN",
    Guangzhou: "CAN",
    Qingdao: "TAO",
    Melbourne: "MEL",
    MEL: "MEL",
    PVG: "PVG",
    SHA: "SHA",
    Shanghai: "SHA"
  };

  return map[cityOrAirport] ?? String(cityOrAirport).slice(0, 3).toUpperCase();
}

function parseStopoverDurationMinutes(stopText) {
  if (!stopText) {
    return 0;
  }

  const hoursAndMinutesMatch = stopText.match(/(\d+)\s*h\s*(\d+)\s*m/i);

  if (hoursAndMinutesMatch) {
    return Number(hoursAndMinutesMatch[1]) * 60 + Number(hoursAndMinutesMatch[2]);
  }

  const hoursOnlyMatch = stopText.match(/(\d+)\s*h/i);

  if (hoursOnlyMatch) {
    return Number(hoursOnlyMatch[1]) * 60;
  }

  const minutesOnlyMatch = stopText.match(/(\d+)\s*m/i);

  if (minutesOnlyMatch) {
    return Number(minutesOnlyMatch[1]);
  }

  return 0;
}

function parseCardDurationMinutes(value, fallbackMinutes = 240) {
  const parsed = parseStopoverDurationMinutes(value);
  return parsed > 0 ? parsed : fallbackMinutes;
}

function resolveCityCode(cityOrAirport) {
  const normalized = String(cityOrAirport).trim().toLowerCase();
  const matched = cityCatalog.find(
    (entry) =>
      entry.code.toLowerCase() === normalized ||
      entry.displayName.toLowerCase() === normalized ||
      entry.aliases.some((alias) => alias.toLowerCase() === normalized)
  );

  return matched?.code ?? guessAirportCode(cityOrAirport);
}

function resolveKnownCityCode(cityOrAirport) {
  const normalized = String(cityOrAirport).trim().toLowerCase();
  const matched = cityCatalog.find(
    (entry) =>
      entry.code.toLowerCase() === normalized ||
      entry.displayName.toLowerCase() === normalized ||
      entry.aliases.some((alias) => alias.toLowerCase() === normalized)
  );

  return matched?.code ?? null;
}

function resolveCityName(cityCode) {
  return cityCatalog.find((entry) => entry.code === cityCode)?.displayName ?? cityCode;
}

function isMainlandChinaCity(cityCode) {
  return (
    cityCatalog.find((entry) => entry.code === cityCode)?.country === "China"
  );
}

function buildTripcomDirectResultsUrl({ originAirport, destinationCityCode, departDate, returnDate }) {
  const params = new URLSearchParams({
    acity: destinationCityCode.toLowerCase(),
    class: "y",
    curr: "AUD",
    dcity: originAirport.toLowerCase(),
    ddate: departDate,
    locale: "en-AU",
    lowpricesource: "searchform",
    nonstoponly: "off",
    quantity: "1",
    rdate: returnDate,
    searchboxarg: "t",
    triptype: "rt"
  });

  return `https://au.trip.com/flights/showfarefirst?${params.toString()}`;
}

function buildTripcomAnchoredMultiCityResultsUrl({
  departDate,
  destinationCityCode,
  finalReturnAirport,
  finalReturnDate,
  originAirport,
  stopoverCityCode,
  stopoverDepartDate
}) {
  const params = new URLSearchParams({
    class: "y",
    curr: "AUD",
    locale: "en-AU",
    lowpricesource: "searchform",
    multacity0: stopoverCityCode.toLowerCase(),
    multacity1: destinationCityCode.toLowerCase(),
    multacity2: finalReturnAirport.toLowerCase(),
    multdcity0: originAirport.toLowerCase(),
    multdcity1: stopoverCityCode.toLowerCase(),
    multdcity2: destinationCityCode.toLowerCase(),
    multddate0: departDate,
    multddate1: stopoverDepartDate,
    multddate2: finalReturnDate,
    nonstoponly: "off",
    quantity: "1",
    searchboxarg: "t",
    triptype: "mt"
  });

  return `https://au.trip.com/flights/showfarefirst?${params.toString()}`;
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sampleEvenly(values, limit) {
  if (values.length <= limit) {
    return values;
  }

  if (limit <= 1) {
    return [values[0]];
  }

  const sampled = [];
  const seen = new Set();

  for (let index = 0; index < limit; index += 1) {
    const sampledIndex = Math.round((index * (values.length - 1)) / (limit - 1));
    const item = values[sampledIndex];
    const key = JSON.stringify(item);

    if (seen.has(key)) {
      continue;
    }

    sampled.push(item);
    seen.add(key);
  }

  return sampled;
}

function buildDatePairKey(pair) {
  return `${pair.departDate}__${pair.returnDate}`;
}

function readDateOrdinal(dateValue) {
  const timestamp = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.round(timestamp / (24 * 60 * 60_000));
}

function getDateDistanceDays(leftDate, rightDate) {
  const leftOrdinal = readDateOrdinal(leftDate);
  const rightOrdinal = readDateOrdinal(rightDate);

  if (!Number.isFinite(leftOrdinal) || !Number.isFinite(rightOrdinal)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(leftOrdinal - rightOrdinal);
}

function compareIsoDates(leftDate, rightDate) {
  const leftOrdinal = readDateOrdinal(leftDate);
  const rightOrdinal = readDateOrdinal(rightDate);

  if (!Number.isFinite(leftOrdinal) || !Number.isFinite(rightOrdinal)) {
    return 0;
  }

  return leftOrdinal - rightOrdinal;
}

function enumerateAnchoredMultiCityStopDates({
  departDate,
  limit,
  maxStopDays,
  minStopDays,
  returnDate,
  runSeed
}) {
  const effectiveMinStopDays = Math.max(0, Number(minStopDays ?? 0));
  const effectiveMaxStopDays = Math.max(effectiveMinStopDays, Number(maxStopDays ?? effectiveMinStopDays));
  const lastEligibleDate = addDays(returnDate, -1);
  const startDate = addDays(departDate, effectiveMinStopDays);
  const endDate =
    compareIsoDates(addDays(departDate, effectiveMaxStopDays), lastEligibleDate) <= 0
      ? addDays(departDate, effectiveMaxStopDays)
      : lastEligibleDate;

  if (compareIsoDates(startDate, endDate) > 0) {
    return [];
  }

  const dates = [];
  for (let cursorDate = startDate; compareIsoDates(cursorDate, endDate) <= 0; cursorDate = addDays(cursorDate, 1)) {
    dates.push(cursorDate);
  }

  const sampled = sampleEvenly(dates, Math.max(1, Number(limit ?? 1)));
  const ordered = [...sampled].sort((left, right) => {
    const midpoint = (readDateOrdinal(startDate) + readDateOrdinal(endDate)) / 2;
    const leftDistance = Math.abs(Number(readDateOrdinal(left) ?? midpoint) - midpoint);
    const rightDistance = Math.abs(Number(readDateOrdinal(right) ?? midpoint) - midpoint);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    const leftJitter = createDeterministicUnitInterval(`${runSeed}:${left}`);
    const rightJitter = createDeterministicUnitInterval(`${runSeed}:${right}`);
    if (leftJitter !== rightJitter) {
      return leftJitter - rightJitter;
    }

    return left.localeCompare(right);
  });

  return ordered;
}

function normalizeScoreMapEntries(values) {
  const entries = [...values.entries()];
  if (entries.length === 0) {
    return new Map();
  }

  const maxScore = Math.max(...entries.map(([, value]) => Number(value ?? 0)), 1);
  return new Map(entries.map(([key, value]) => [key, Number((Number(value ?? 0) / maxScore).toFixed(4))]));
}

function collectHistoricalDatePairSignals(db, sessionId) {
  const rows = db
    .prepare(
      `select
         substr(outbound_leg.departure_at, 1, 10) as depart_date,
         substr(return_leg.departure_at, 1, 10) as return_date,
         min(c.displayed_display_amount) as cheapest_price
       from search_run r
       inner join strategy_execution se
         on se.search_run_id = r.id
       inner join itinerary_candidate c
         on c.strategy_execution_id = se.id
       left join candidate_leg outbound_leg
         on outbound_leg.itinerary_candidate_id = c.id
        and outbound_leg.segment_group = 'outbound'
        and outbound_leg.leg_index = 0
       left join candidate_leg return_leg
         on return_leg.itinerary_candidate_id = c.id
        and return_leg.segment_group = 'return'
        and return_leg.leg_index = 1
       where r.session_id = ?
         and r.status = 'completed'
         and se.status = 'completed'
         and se.strategy_type in ('packaged_direct_sweep', 'packaged_departure_anchor_followup')
         and outbound_leg.departure_at is not null
         and return_leg.departure_at is not null
       group by depart_date, return_date
       order by cheapest_price asc
       limit 24`
    )
    .all(sessionId);

  const departureScores = new Map();
  const returnScores = new Map();

  rows.forEach((row, index) => {
    const weight = Math.max(1, 24 - index);

    if (row.depart_date) {
      departureScores.set(
        row.depart_date,
        Number(departureScores.get(row.depart_date) ?? 0) + weight
      );
    }

    if (row.return_date) {
      returnScores.set(
        row.return_date,
        Number(returnScores.get(row.return_date) ?? 0) + weight
      );
    }
  });

  return {
    departureScores: normalizeScoreMapEntries(departureScores),
    pairScores: normalizeScoreMapEntries(
      new Map(rows.map((row, index) => [`${row.depart_date}__${row.return_date}`, Math.max(1, 24 - index)]))
    ),
    returnScores: normalizeScoreMapEntries(returnScores)
  };
}

function getHistoricalDatePairEvidence(db, sessionId, departDate, returnDate) {
  const cacheKey = `${sessionId}__${departDate}__${returnDate}`;

  if (historicalDatePairEvidenceCache.has(cacheKey)) {
    return historicalDatePairEvidenceCache.get(cacheKey);
  }

  const evidence =
    db
      .prepare(
        `select
           count(*) as candidate_count,
           min(c.displayed_display_amount) as cheapest_price
         from search_run r
         inner join strategy_execution se
           on se.search_run_id = r.id
         inner join itinerary_candidate c
           on c.strategy_execution_id = se.id
         left join candidate_leg outbound_leg
           on outbound_leg.itinerary_candidate_id = c.id
          and outbound_leg.segment_group = 'outbound'
          and outbound_leg.leg_index = 0
         left join candidate_leg return_leg
           on return_leg.itinerary_candidate_id = c.id
          and return_leg.segment_group = 'return'
          and return_leg.leg_index = 1
         where r.session_id = ?
           and r.status = 'completed'
           and se.status = 'completed'
           and se.strategy_type in ('packaged_direct_sweep', 'packaged_departure_anchor_followup')
           and substr(outbound_leg.departure_at, 1, 10) = ?
           and substr(return_leg.departure_at, 1, 10) = ?`
      )
      .get(sessionId, departDate, returnDate) ?? null;

  const normalizedEvidence = {
    candidateCount: Number(evidence?.candidate_count ?? 0),
    cheapestPrice: Number.isFinite(Number(evidence?.cheapest_price))
      ? Number(evidence.cheapest_price)
      : null
  };

  historicalDatePairEvidenceCache.set(cacheKey, normalizedEvidence);
  return normalizedEvidence;
}

function createAdaptiveDirectSweepPlanner({ allPairs, limit, runSeed, seedSweepLimit, sessionSignals }) {
  const pairUniverse = allPairs.length > 0 ? allPairs : [];
  const effectiveLimit = Math.max(1, Math.min(limit, pairUniverse.length || limit));
  const seedLimit = Math.max(1, Math.min(seedSweepLimit, effectiveLimit));
  const seedPairs = sampleEvenly(pairUniverse, seedLimit);
  const uniqueDepartureDates = [...new Set(pairUniverse.map((pair) => pair.departDate))];
  const bucketCount = Math.max(
    1,
    Math.min(uniqueDepartureDates.length || 1, Math.max(seedLimit, Math.min(effectiveLimit, 4)))
  );
  const departureToBucket = new Map();

  uniqueDepartureDates.forEach((departDate, index) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor((index * bucketCount) / Math.max(uniqueDepartureDates.length, 1))
    );
    departureToBucket.set(departDate, bucketIndex);
  });

  return {
    bestPair: null,
    bucketStats: new Map(
      Array.from({ length: bucketCount }, (_, index) => [
        index,
        { rewardSum: 0, sampleCount: 0 }
      ])
    ),
    departureToBucket,
    pairUniverse,
    sampledPairKeys: new Set(),
    seedPairs,
    sessionSignals,
    totalLimit: effectiveLimit,
    totalSelections: 0,
    runSeed
  };
}

function computeDirectSweepQueryReward(queryResult) {
  const createdCandidates = Array.isArray(queryResult?.createdCandidates)
    ? queryResult.createdCandidates
    : [];

  if (createdCandidates.length === 0) {
    return 0;
  }

  const cheapestPrice = Math.min(
    ...createdCandidates.map((candidate) => Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY))
  );
  const distinctFamilies = new Set(
    createdCandidates.map((candidate) => candidate.candidateFamilyId).filter(Boolean)
  ).size;
  const stopoverRichCandidates = createdCandidates.filter(
    (candidate) => Number(candidate.stopCount ?? 0) > 0
  ).length;
  const priceReward = Number.isFinite(cheapestPrice)
    ? Math.max(0, 2200 - cheapestPrice) / 120
    : 0;

  return Number(
    (
      priceReward +
      distinctFamilies * 1.25 +
      Math.min(2, stopoverRichCandidates * 0.25)
    ).toFixed(4)
  );
}

function recordAdaptiveDirectSweepOutcome(planner, pair, queryResult) {
  const pairKey = buildDatePairKey(pair);
  const bucketIndex = planner.departureToBucket.get(pair.departDate) ?? 0;
  const bucketState = planner.bucketStats.get(bucketIndex) ?? {
    rewardSum: 0,
    sampleCount: 0
  };
  const reward = computeDirectSweepQueryReward(queryResult);
  const cheapestPrice = Array.isArray(queryResult?.createdCandidates) && queryResult.createdCandidates.length > 0
    ? Math.min(
        ...queryResult.createdCandidates.map((candidate) =>
          Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY)
        )
      )
    : Number.POSITIVE_INFINITY;

  bucketState.rewardSum += reward;
  bucketState.sampleCount += 1;
  planner.bucketStats.set(bucketIndex, bucketState);
  planner.sampledPairKeys.add(pairKey);
  planner.totalSelections += 1;

  if (
    !planner.bestPair ||
    cheapestPrice < Number(planner.bestPair.cheapestPrice ?? Number.POSITIVE_INFINITY)
  ) {
    planner.bestPair = {
      cheapestPrice,
      departDate: pair.departDate,
      returnDate: pair.returnDate
    };
  }
}

function selectNextAdaptiveDirectSweepPair(planner) {
  let bestPair = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const pair of planner.pairUniverse) {
    const pairKey = buildDatePairKey(pair);

    if (planner.sampledPairKeys.has(pairKey)) {
      continue;
    }

    const bucketIndex = planner.departureToBucket.get(pair.departDate) ?? 0;
    const bucketState = planner.bucketStats.get(bucketIndex) ?? {
      rewardSum: 0,
      sampleCount: 0
    };
    const historicalDepartureScore =
      Number(planner.sessionSignals.departureScores.get(pair.departDate) ?? 0);
    const historicalReturnScore =
      Number(planner.sessionSignals.returnScores.get(pair.returnDate) ?? 0);
    const bucketMeanReward =
      bucketState.sampleCount > 0 ? bucketState.rewardSum / bucketState.sampleCount : 0;
    const explorationBonus =
      bucketState.sampleCount === 0
        ? 2.5
        : Math.sqrt(Math.log(planner.totalSelections + 2) / bucketState.sampleCount);
    const coverageBonus = bucketState.sampleCount === 0 ? 2 : Math.max(0, 1 - bucketState.sampleCount * 0.3);
    const proximityBonus = planner.bestPair
      ? Math.max(0, 4 - getDateDistanceDays(pair.departDate, planner.bestPair.departDate)) * 0.7 +
        Math.max(0, 4 - getDateDistanceDays(pair.returnDate, planner.bestPair.returnDate)) * 0.35
      : 0;
    const historicalBonus = historicalDepartureScore * 0.8 + historicalReturnScore * 0.4;
    const jitter = createDeterministicUnitInterval(`${planner.runSeed}:${pairKey}`) * 0.2;
    const score =
      bucketMeanReward * 1.5 +
      explorationBonus * 2.25 +
      coverageBonus +
      proximityBonus +
      historicalBonus +
      jitter;

    if (score > bestScore) {
      bestScore = score;
      bestPair = pair;
    }
  }

  return bestPair;
}

function buildBaselineExecutionEfficiencySummary({
  directSweepLimit,
  executedQueryCount,
  pairUniverseCount,
  samplingMode,
  seedSweepLimit,
  outcomes,
  candidates
}) {
  const candidateRows = Array.isArray(candidates) ? candidates : [];
  const outcomeRows = Array.isArray(outcomes) ? outcomes : [];
  const distinctFamilyIds = new Set(
    candidateRows.map((candidate) => candidate.candidateFamilyId).filter(Boolean)
  );
  const cheapestPrice =
    candidateRows.length > 0
      ? Math.min(
          ...candidateRows.map((candidate) =>
            Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY)
          )
        )
      : Number.POSITIVE_INFINITY;
  const bestFareFirstSeen =
    outcomeRows.find(
      (outcome) =>
        Number.isFinite(cheapestPrice) &&
        Number(outcome.cheapestPrice ?? Number.POSITIVE_INFINITY) === cheapestPrice
    ) ?? null;
  const halfBudgetCount = Math.max(1, Math.ceil(Math.max(executedQueryCount, 0) / 2));
  const familyCoverageAt = (queryCount) => {
    if (distinctFamilyIds.size === 0) {
      return null;
    }

    const seenFamilies = new Set();
    outcomeRows.slice(0, queryCount).forEach((outcome) => {
      (outcome.familyIds ?? []).forEach((familyId) => {
        if (familyId) {
          seenFamilies.add(familyId);
        }
      });
    });

    return Number((seenFamilies.size / distinctFamilyIds.size).toFixed(4));
  };
  const observedStopoverCityCodes = new Set(
    outcomeRows.flatMap((outcome) => outcome.observedStopoverCityCodes ?? []).filter(Boolean)
  );
  const safeCheapestPrice = Number.isFinite(cheapestPrice) ? cheapestPrice : null;
  const effectiveSeedSweepLimit =
    samplingMode === "adaptive_coverage"
      ? Math.max(1, Math.min(Number(seedSweepLimit ?? 0), executedQueryCount))
      : executedQueryCount;

  return {
    analysisType: "baseline_execution_efficiency",
    analysedAt: nowIso(),
    baselineLabel:
      samplingMode === "adaptive_coverage" ? "Adaptive coverage baseline" : "Round trip baseline",
    samplingMode,
    directSweepLimit: Number(directSweepLimit ?? executedQueryCount),
    pairUniverseCount: Number(pairUniverseCount ?? 0),
    executedQueryCount,
    initialSeedSweepLimit:
      samplingMode === "adaptive_coverage" ? Number(seedSweepLimit ?? 0) : null,
    seedSweepQueryCount: effectiveSeedSweepLimit,
    adaptiveQueryCount:
      samplingMode === "adaptive_coverage"
        ? Math.max(0, executedQueryCount - effectiveSeedSweepLimit)
        : 0,
    candidateCount: candidateRows.length,
    distinctFamilyCount: distinctFamilyIds.size,
    duplicationRate:
      candidateRows.length > 0
        ? Number((1 - distinctFamilyIds.size / candidateRows.length).toFixed(4))
        : null,
    cheapestPrice: safeCheapestPrice,
    bestFareFirstSeenPriority: bestFareFirstSeen?.priority ?? null,
    bestFareFirstSeenQueryNumber:
      typeof bestFareFirstSeen?.priority === "number" ? bestFareFirstSeen.priority + 1 : null,
    bestFareDiscoveryPhase: bestFareFirstSeen?.selectionPhase ?? null,
    familyCoverageAfterHalfBudget: familyCoverageAt(halfBudgetCount),
    familyCoverageAtBestFareDiscovery:
      typeof bestFareFirstSeen?.priority === "number"
        ? familyCoverageAt(bestFareFirstSeen.priority + 1)
        : null,
    uniqueObservedStopoverCityCount: observedStopoverCityCodes.size,
    queryOutcomes: outcomeRows.map((outcome) => ({
      candidateCount: outcome.candidateCount,
      cheapestPrice: outcome.cheapestPrice,
      departDate: outcome.departDate,
      distinctFamilyCount: outcome.distinctFamilyCount,
      observedStopoverCityCount: outcome.observedStopoverCityCount,
      priority: outcome.priority,
      returnDate: outcome.returnDate,
      rewardScore: outcome.rewardScore,
      selectionPhase: outcome.selectionPhase
    }))
  };
}

function enumerateDatePairs(runRow, limit) {
  const durationMin = Math.max(1, Number(runRow.duration_min_days ?? 7));
  const durationMax = Math.max(durationMin, Number(runRow.duration_max_days ?? durationMin));
  const latestReturnDate = runRow.return_end_date ?? runRow.departure_end_date;
  const lastPossibleDeparture = addDays(latestReturnDate, -durationMin);
  const allPairs = [];

  for (
    let outboundDate = runRow.departure_start_date;
    outboundDate <= lastPossibleDeparture;
    outboundDate = addDays(outboundDate, 1)
  ) {
    for (let duration = durationMin; duration <= durationMax; duration += 1) {
      const returnDate = addDays(outboundDate, duration);

      if (returnDate > latestReturnDate) {
        continue;
      }

      allPairs.push({
        departDate: outboundDate,
        durationDays: duration,
        returnDate
      });
    }
  }

  const pairs = allPairs.length > 0 ? allPairs : [{
    departDate: runRow.departure_start_date,
    durationDays: durationMin,
    returnDate: addDays(runRow.departure_start_date, durationMin)
  }];

  return {
    allPairs,
    sampledPairs: sampleEvenly(pairs, limit)
  };
}

function isBlockedState(observation) {
  return (
    observation.classification.state === "blocked" ||
    observation.classification.state === "needs_login"
  );
}

function buildNoResultsStage(lastUrl, noResults) {
  return {
    cardSignature: null,
    detail: noResults?.detail ?? "Trip.com reported no results for this search.",
    kind: "no_results",
    lastUrl,
    matchedText: noResults?.matchedText ?? null
  };
}

function requestQueuedRunDispatch() {
  const child = spawn(process.execPath, [dispatchQueueScriptPath], {
    cwd: resolveFlyEasyAppRoot(),
    detached: true,
    env: process.env,
    stdio: "ignore"
  });

  child.unref();
}

async function appendStageArtifacts(page, runDir, stageName, notesPrefix, artifactRecords) {
  const artifacts = await captureStageArtifacts(page, runDir, stageName);
  artifactRecords.push(
    {
      filePath: artifacts.screenshotPath,
      mimeType: "image/png",
      notes: `${notesPrefix} screenshot.`,
      type: "screenshot"
    },
    {
      filePath: artifacts.htmlPath,
      mimeType: "text/html",
      notes: `${notesPrefix} HTML snapshot.`,
      type: "html_snapshot"
    }
  );

  return artifacts;
}

async function tryAppendStageArtifacts(page, runDir, stageName, notesPrefix, artifactRecords) {
  try {
    await appendStageArtifacts(page, runDir, stageName, notesPrefix, artifactRecords);
  } catch {
    // Best-effort failure evidence should not hide the original automation error.
  }
}

async function readFirstCardSignature(page) {
  return page
    .locator('[data-testid^="u-flight-card-"]')
    .first()
    .innerText()
    .then((value) => value.replace(/\s+/g, " ").trim())
    .catch(() => null);
}

async function waitForTripcomResultStage(page, context, stageLabel, expectedUrlPattern, previousCardSignature) {
  const deadline = Date.now() + timeoutMs;
  let lastUrl = page.url();
  let lastObservationAt = 0;

  while (Date.now() < deadline) {
    lastUrl = page.url();
    const currentCardSignature = await readFirstCardSignature(page);
    const cardsAreVisible = Boolean(currentCardSignature);
    const urlMatches = expectedUrlPattern.test(lastUrl);
    const explorePriceVisible = await page
      .locator('[data-testid^="price_info_"]')
      .first()
      .isVisible()
      .catch(() => false);
    const signatureChanged =
      previousCardSignature != null &&
      currentCardSignature != null &&
      currentCardSignature !== previousCardSignature;

    if (cardsAreVisible && (previousCardSignature == null || signatureChanged || urlMatches)) {
      return {
        cardSignature: currentCardSignature,
        kind: "flight_cards",
        lastUrl
      };
    }

    if (explorePriceVisible) {
      return {
        cardSignature: null,
        kind: "explore_top_list",
        lastUrl
      };
    }

    if (Date.now() - lastObservationAt >= 4_000) {
      const observation = await collectConnectionObservation(page, context);
      lastObservationAt = Date.now();

      if (isBlockedState(observation)) {
        throw new Error(observation.classification.detail);
      }

      const noResults = detectNoResultsState({
        bodyText: observation.bodyText,
        title: observation.title,
        url: observation.tripcomUrl
      });

      if (noResults) {
        return buildNoResultsStage(lastUrl, noResults);
      }
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `Timed out waiting for ${stageLabel} Trip.com results. Last URL: ${lastUrl}`
  );
}

async function openExploreTopListResult(page) {
  const primaryResult = page.locator('[data-testid^="price_info_"]').first();
  await primaryResult.waitFor({ state: "visible", timeout: 15_000 });
  await primaryResult.click();
}

async function applyStopoverFilter(page, cityCode) {
  const filter = page.locator('[data-testid="filter_stopoverport"]').first();
  const option = filter.locator(`.filter-item[data-code="${cityCode}"] .filter-item-wrapper`).first();

  await filter.waitFor({ state: "visible", timeout: 15_000 });
  await filter.evaluate((node) => {
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "start", inline: "nearest" });
    }
  });
  await page.waitForTimeout(500);
  await option.waitFor({ state: "attached", timeout: 10_000 });

  const revealOption = async () => {
    await option.evaluate((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      node.scrollIntoView({ block: "center", inline: "nearest" });
      node.click();
    });
  };

  const clickCheckbox = async () => {
    await option.evaluate((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const target =
        node.querySelector('[data-testid="filter_label_checkbox"]') ??
        node.querySelector(".filter-label") ??
        node;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
        target.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          })
        );
      });

      target.click();
    });
  };

  const waitForCheckedState = async () => {
    const deadline = Date.now() + 8_000;

    while (Date.now() < deadline) {
      const checked = await option.getAttribute("aria-checked").catch(() => null);

      if (checked === "true") {
        return true;
      }

      await page.waitForTimeout(250);
    }

    return false;
  };

  const waitForInteractiveState = async () => {
    const deadline = Date.now() + 8_000;

    while (Date.now() < deadline) {
      const state = await option
        .evaluate((node) => ({
          ariaHidden: node.getAttribute("aria-hidden"),
          tabindex: node.getAttribute("tabindex")
        }))
        .catch(() => null);

      if (state && state.ariaHidden == null && state.tabindex === "0") {
        return true;
      }

      await page.waitForTimeout(250);
    }

    return false;
  };

  if ((await option.getAttribute("aria-checked").catch(() => null)) === "true") {
    await page.waitForTimeout(2_000);
    return;
  }

  await revealOption();
  if (!(await waitForInteractiveState())) {
    throw new Error(`Trip.com stopover filter did not become interactive for ${cityCode}.`);
  }
  await clickCheckbox();

  if (await waitForCheckedState()) {
    await page.waitForTimeout(2_000);
    return;
  }

  throw new Error(`Trip.com stopover filter did not activate for ${cityCode}.`);
}

function insertArtifacts(db, runIdValue, strategyId, createdAt, artifacts) {
  for (const artifact of artifacts) {
    db.prepare(
      `insert into run_artifact (
        id, search_run_id, strategy_execution_id, verification_attempt_id,
        artifact_type, file_path, mime_type, created_at, notes
      ) values (?, ?, ?, null, ?, ?, ?, ?, ?)`
    ).run(
      createId("artifact"),
      runIdValue,
      strategyId,
      artifact.type,
      artifact.filePath,
      artifact.mimeType,
      createdAt,
      artifact.notes
    );
  }
}

function insertQueryExecution(db, values) {
  const createdAt = nowIso();
  const id = createId("query");

  db.prepare(
    `insert into query_execution (
      id, search_run_id, strategy_execution_id, parent_query_execution_id, query_type, source, priority,
      status, reason, query_input_json, result_summary_json, observed_stopover_cities_json, tripcom_result_url,
      started_at, finished_at, failure_reason, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, null, ?, null, null, ?)`
  ).run(
    id,
    values.searchRunId,
    values.strategyExecutionId,
    values.parentQueryExecutionId ?? null,
    values.queryType,
    values.source,
    values.priority,
    "running",
    values.reason,
    JSON.stringify(values.queryInput),
    createdAt,
    createdAt
  );

  return {
    createdAt,
    id
  };
}

function updateQueryExecution(db, queryExecutionId, updates) {
  const entries = Object.entries(updates);

  if (entries.length === 0) {
    return;
  }

  const fields = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  db.prepare(`update query_execution set ${fields} where id = ?`).run(...values, queryExecutionId);
}

function insertQueryCandidateLinks(db, queryExecutionId, candidateIds) {
  const createdAt = nowIso();

  for (const candidateId of candidateIds) {
    db.prepare(
      `insert into query_candidate_link (
        id, query_execution_id, itinerary_candidate_id, link_type, created_at
      ) values (?, ?, ?, 'result', ?)`
    ).run(createId("query_candidate"), queryExecutionId, candidateId, createdAt);
  }
}

function parseStrategyPayload(strategyPayloadJson) {
  try {
    return JSON.parse(strategyPayloadJson);
  } catch {
    return {};
  }
}

function selectStrategies(db, currentRunId) {
  return db
    .prepare(
      `select *
       from strategy_execution
       where search_run_id = ?
       order by priority asc`
    )
    .all(currentRunId);
}

function selectRunCandidates(db, currentRunId) {
  return db
    .prepare(
      `select *
       from itinerary_candidate
       where search_run_id = ?
       order by displayed_display_amount asc`
    )
    .all(currentRunId);
}

function selectStrategyCandidates(db, strategyId) {
  return db
    .prepare(
      `select *
       from itinerary_candidate
       where strategy_execution_id = ?
       order by displayed_display_amount asc`
    )
    .all(strategyId);
}

function sortCandidatesByDisplayedAmount(left, right) {
  const leftPrice = Number(left?.displayed_display_amount ?? left?.displayedAmount ?? Number.POSITIVE_INFINITY);
  const rightPrice = Number(right?.displayed_display_amount ?? right?.displayedAmount ?? Number.POSITIVE_INFINITY);

  if (leftPrice !== rightPrice) {
    return leftPrice - rightPrice;
  }

  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function buildStrategyOutcomeTelemetry(db, runId) {
  const strategies = selectStrategies(db, runId);
  const runCandidates = selectRunCandidates(db, runId).sort(sortCandidatesByDisplayedAmount);
  const runBestCandidate = runCandidates[0] ?? null;
  const intentionalCandidates = runCandidates
    .filter((candidate) => Number(candidate.intentional_stop_count ?? 0) > 0)
    .sort(sortCandidatesByDisplayedAmount);
  const intentionalBestCandidate = intentionalCandidates[0] ?? null;
  const runBestPrice = Number.isFinite(Number(runBestCandidate?.displayed_display_amount))
    ? Number(runBestCandidate.displayed_display_amount)
    : null;
  const intentionalBestPrice = Number.isFinite(Number(intentionalBestCandidate?.displayed_display_amount))
    ? Number(intentionalBestCandidate.displayed_display_amount)
    : null;
  const candidatesByStrategyId = new Map();

  for (const candidate of runCandidates) {
    const current = candidatesByStrategyId.get(candidate.strategy_execution_id) ?? [];
    current.push(candidate);
    candidatesByStrategyId.set(candidate.strategy_execution_id, current);
  }

  return {
    analysedAt: nowIso(),
    analysisType: "strategy_outcome_telemetry",
    intentionalBestCandidateId: intentionalBestCandidate?.id ?? null,
    intentionalBestPrice,
    overallBestCandidateId: runBestCandidate?.id ?? null,
    overallBestPrice: runBestPrice,
    strategies: strategies.map((strategy) => {
      const strategyCandidates = [...(candidatesByStrategyId.get(strategy.id) ?? [])].sort(
        sortCandidatesByDisplayedAmount
      );
      const bestCandidate = strategyCandidates[0] ?? null;
      const bestPrice = Number.isFinite(Number(bestCandidate?.displayed_display_amount))
        ? Number(bestCandidate.displayed_display_amount)
        : null;
      const intentionalStrategyCandidates = strategyCandidates
        .filter((candidate) => Number(candidate.intentional_stop_count ?? 0) > 0)
        .sort(sortCandidatesByDisplayedAmount);
      const bestIntentionalCandidate = intentionalStrategyCandidates[0] ?? null;
      const bestIntentionalPrice = Number.isFinite(
        Number(bestIntentionalCandidate?.displayed_display_amount)
      )
        ? Number(bestIntentionalCandidate.displayed_display_amount)
        : null;

      return {
        actualSearchCost: Number(strategy.actual_search_cost ?? strategy.actualSearchCost ?? 0),
        bestCandidateId: bestCandidate?.id ?? null,
        bestIntentionalCandidateId: bestIntentionalCandidate?.id ?? null,
        bestIntentionalPrice,
        bestIntentionalPriceDeltaFromIntentionalWinner:
          intentionalBestPrice !== null && bestIntentionalPrice !== null
            ? Math.max(0, bestIntentionalPrice - intentionalBestPrice)
            : null,
        bestPrice,
        bestPriceDeltaFromWinner:
          runBestPrice !== null && bestPrice !== null ? Math.max(0, bestPrice - runBestPrice) : null,
        candidateCount: strategyCandidates.length,
        candidateShareOfRun:
          runCandidates.length > 0 ? Number((strategyCandidates.length / runCandidates.length).toFixed(3)) : 0,
        deliveredIntentionalWinner:
          Boolean(intentionalBestCandidate?.id) && bestIntentionalCandidate?.id === intentionalBestCandidate?.id,
        deliveredRunWinner: Boolean(runBestCandidate?.id) && bestCandidate?.id === runBestCandidate?.id,
        priority: Number(strategy.priority ?? 0),
        recordedCandidateCount: Number(strategy.candidate_count ?? strategy.candidateCount ?? 0),
        recordedVerifiedCandidateCount: Number(
          strategy.verified_candidate_count ?? strategy.verifiedCandidateCount ?? 0
        ),
        status: strategy.status,
        strategyExecutionId: strategy.id,
        strategyType: strategy.strategy_type ?? strategy.strategyType ?? null
      };
    })
  };
}

function selectBaselineExpansionCandidates(db, strategyId) {
  return db
    .prepare(
      `select
         c.id as candidate_id,
         c.displayed_display_amount,
         c.stop_count,
         c.tripcom_resume_url,
         qcl.query_execution_id,
         q.query_input_json,
         outbound_leg.raw_leg_payload_json as outbound_raw_leg_payload_json,
         outbound_leg.departure_at as outbound_departure_at,
         return_leg.raw_leg_payload_json as return_raw_leg_payload_json,
         return_leg.departure_at as return_departure_at
       from itinerary_candidate c
       left join query_candidate_link qcl
         on qcl.itinerary_candidate_id = c.id
        and qcl.link_type = 'result'
       left join query_execution q
         on q.id = qcl.query_execution_id
       left join candidate_leg outbound_leg
         on outbound_leg.itinerary_candidate_id = c.id
        and outbound_leg.segment_group = 'outbound'
        and outbound_leg.leg_index = 0
       left join candidate_leg return_leg
         on return_leg.itinerary_candidate_id = c.id
        and return_leg.segment_group = 'return'
        and return_leg.leg_index = 1
       where c.strategy_execution_id = ?
       order by c.displayed_display_amount asc, c.first_seen_at asc`
    )
    .all(strategyId)
    .map((row) => {
      const queryInput = safeJsonParse(row.query_input_json, {});
      const outboundCard = safeJsonParse(row.outbound_raw_leg_payload_json, null);
      const returnCard = safeJsonParse(row.return_raw_leg_payload_json, null);

      return {
        candidateId: row.candidate_id,
        departDate:
          queryInput.departDate ??
          (row.outbound_departure_at ? String(row.outbound_departure_at).slice(0, 10) : null),
        displayedAmount: Number(row.displayed_display_amount ?? Number.POSITIVE_INFINITY),
        parentQueryExecutionId: row.query_execution_id ?? null,
        queryInput,
        returnDate:
          queryInput.returnDate ??
          (row.return_departure_at ? String(row.return_departure_at).slice(0, 10) : null),
        returnCard,
        resumeUrl: row.tripcom_resume_url,
        stopCount: Number(row.stop_count ?? 0),
        outboundCard
      };
    })
    .filter((entry) => entry.resumeUrl && entry.outboundCard && entry.returnCard);
}

function readReturnOptionExpansionHistory(db, sessionId, currentRunId) {
  return (
    db
      .prepare(
        `select
           count(*) as completedExecutions,
           sum(coalesce(se.actual_search_cost, 0)) as totalSearchCost,
           sum(coalesce(se.candidate_count, 0)) as totalCandidates
         from strategy_execution se
         inner join search_run r
           on r.id = se.search_run_id
         where r.session_id = ?
           and r.id <> ?
           and se.strategy_type = 'packaged_return_option_expansion'
           and se.status = 'completed'`
      )
      .get(sessionId, currentRunId) ?? {
      completedExecutions: 0,
      totalCandidates: 0,
      totalSearchCost: 0
    }
  );
}

function collectStrategyIdsByTypeBeforePriority(
  strategies,
  priority,
  allowedTypes,
  options = {}
) {
  const typeSet = new Set(allowedTypes);
  const requireCandidates = options.requireCandidates === true;

  return strategies
    .filter(
      (strategy) =>
        strategy.priority < priority &&
        typeSet.has(strategy.strategy_type) &&
        (!requireCandidates || Number(strategy.candidate_count ?? strategy.candidateCount ?? 0) > 0)
    )
    .map((strategy) => strategy.id);
}

function updateStrategyStatus(db, strategyId, updates) {
  const entries = Object.entries(updates);

  if (entries.length === 0) {
    return;
  }

  const fields = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  db.prepare(`update strategy_execution set ${fields} where id = ?`).run(...values, strategyId);
}

function ensureCandidateFamily(
  db,
  sessionId,
  familyKey,
  bookingType,
  routeSummary,
  tripShape = "round_trip"
) {
  const existing = db
    .prepare(`select id from candidate_family where session_id = ? and family_key = ?`)
    .get(sessionId, familyKey);
  const timestamp = nowIso();

  if (existing?.id) {
    db.prepare(`update candidate_family set last_seen_at = ? where id = ?`).run(timestamp, existing.id);
    return existing.id;
  }

  const familyId = createId("family");
  db.prepare(
    `insert into candidate_family (
      id, session_id, family_key, booking_type, trip_shape, route_summary_json, first_seen_at, last_seen_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    familyId,
    sessionId,
    familyKey,
    bookingType,
    tripShape,
    JSON.stringify(routeSummary),
    timestamp,
    timestamp
  );

  return familyId;
}

function insertCandidateRecord(db, currentRunId, strategyId, values) {
  const candidateId = createId("candidate");
  const createdAt = nowIso();

  db.prepare(
    `insert into itinerary_candidate (
      id, search_run_id, strategy_execution_id, candidate_family_id, dedupe_key, booking_type, trip_shape,
      outbound_destination_city, return_origin_city, stop_count, intentional_stop_count,
      displayed_source_currency, displayed_source_amount, displayed_display_currency, displayed_display_amount,
      latest_verified_source_currency, latest_verified_source_amount, latest_verified_display_currency,
      latest_verified_display_amount, latest_verification_status, fare_class_summary, total_travel_minutes,
      stitched_risk_level, risk_notes, tripcom_resume_url, tripcom_resume_token, first_seen_at, last_seen_at,
      last_ranked_at, is_current_best
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AUD', ?, 'AUD', ?, null, null, null, null, 'not_checked', ?, ?, ?, ?, ?, null, ?, ?, ?, ?)`
  ).run(
    candidateId,
    currentRunId,
    strategyId,
    values.candidateFamilyId,
    values.dedupeKey,
    values.bookingType,
    values.tripShape ?? "round_trip",
    values.outboundDestinationCity,
    values.returnOriginCity,
    values.stopCount,
    values.intentionalStopCount,
    values.displayedAmount,
    values.displayedAmount,
    values.fareClassSummary ?? "Economy",
    values.totalTravelMinutes,
    values.stitchedRiskLevel ?? null,
    values.riskNotes,
    values.tripcomResumeUrl ?? "https://au.trip.com/flights/",
    createdAt,
    createdAt,
    createdAt,
    values.isCurrentBest ? 1 : 0
  );

  values.legs.forEach((leg, index) => {
    db.prepare(
      `insert into candidate_leg (
        id, itinerary_candidate_id, leg_index, segment_group, booking_reference_group, carrier_code, flight_number,
        origin_airport, destination_airport, departure_at, arrival_at, cabin_class, fare_brand, baggage_summary,
        raw_leg_payload_json, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Economy', ?, ?, ?, ?)`
    ).run(
      createId("leg"),
      candidateId,
      index,
      leg.segmentGroup,
      leg.bookingReferenceGroup,
      leg.carrierCode,
      leg.flightNumber ?? null,
      leg.originAirport,
      leg.destinationAirport,
      leg.departureAt,
      leg.arrivalAt,
      leg.fareBrand ?? "Displayed fare",
      leg.baggageSummary ?? "Trip.com card",
      leg.rawLegPayloadJson ? JSON.stringify(leg.rawLegPayloadJson) : null,
      createdAt
    );
  });

  (values.stopovers ?? []).forEach((stopover, index) => {
    db.prepare(
      `insert into candidate_stopover (
        id, itinerary_candidate_id, stop_index, city_code, airport_code, country_code, arrival_at, departure_at,
        duration_minutes, is_intentional, is_mainland_china, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      createId("stopover"),
      candidateId,
      index,
      stopover.cityCode,
      stopover.airportCode,
      stopover.countryCode ?? (stopover.isMainlandChina ? "CN" : null),
      stopover.arrivalAt,
      stopover.departureAt,
      stopover.durationMinutes,
      stopover.isIntentional ? 1 : 0,
      stopover.isMainlandChina ? 1 : 0,
      createdAt
    );
  });

  db.prepare(
    `insert into price_observation (
      id, itinerary_candidate_id, search_run_id, verification_attempt_id, price_kind, source_currency,
      source_amount, display_currency, display_amount, fx_provider, fx_rate, fx_rate_timestamp, observed_at
    ) values (?, ?, ?, null, 'displayed_search_price', 'AUD', ?, 'AUD', ?, null, null, null, ?)`
  ).run(createId("price_obs"), candidateId, currentRunId, values.displayedAmount, values.displayedAmount, createdAt);

  return {
    id: candidateId,
    ...values
  };
}

function isRunCancelled(db, currentRunId) {
  return db.prepare(`select status from search_run where id = ?`).get(currentRunId)?.status === "cancelled";
}

function refreshStrategyExperimentGroup(db, groupId) {
  if (!groupId) {
    return null;
  }

  const group = db
    .prepare(
      `select id, experiment_mode, champion_strategy_key, sample_size
       from strategy_experiment_group
       where id = ?`
    )
    .get(groupId);

  if (!group) {
    return null;
  }

  const runs = db
    .prepare(
      `select id, status, started_at, finished_at, strategy_experiment_arm_key, strategy_experiment_arm_label
       from search_run
       where strategy_experiment_group_id = ?
       order by started_at desc`
    )
    .all(groupId);

  if (runs.length === 0) {
    return null;
  }

  const snapshots = db
    .prepare(
      `select search_run_id, analysis_type, summary_json
       from run_analysis_snapshot
       where search_run_id in (${runs.map(() => "?").join(", ")})`
    )
    .all(...runs.map((run) => run.id));
  const snapshotsByRun = snapshots.reduce((map, snapshot) => {
    const current = map.get(snapshot.search_run_id) ?? [];
    current.push(snapshot);
    map.set(snapshot.search_run_id, current);
    return map;
  }, new Map());
  const armSummaries = runs.map((run) => {
    const runSnapshots = snapshotsByRun.get(run.id) ?? [];
    const efficiencySummary = safeJsonParse(
      runSnapshots.find((snapshot) => snapshot.analysis_type === "baseline_execution_efficiency")
        ?.summary_json ?? null,
      {}
    );

    return {
      armKey: run.strategy_experiment_arm_key ?? null,
      armLabel:
        efficiencySummary.baselineLabel ??
        run.strategy_experiment_arm_label ??
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
      finishedAt: run.finished_at,
      runId: run.id,
      startedAt: run.started_at,
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
  const resolvedStatus = hasActiveRuns
    ? "running"
    : completedRuns.length === runs.length
      ? "completed"
      : completedRuns.length > 0
        ? "partial"
        : cancelledRuns.length === runs.length
          ? "cancelled"
          : "failed";
  const timestamp = nowIso();

  db.prepare(
    `update strategy_experiment_group
     set status = ?,
         finished_at = ?,
         summary_json = ?,
         updated_at = ?
     where id = ?`
  ).run(
    resolvedStatus,
    hasActiveRuns ? null : timestamp,
    JSON.stringify({
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
    timestamp,
    groupId
  );

  return {
    leaderArmLabel: leader?.armLabel ?? null,
    status: resolvedStatus
  };
}

function markRunBlocked(db, runRow, strategyId, message, resumeCheckpoint, artifactRecords) {
  const timestamp = nowIso();
  insertArtifacts(db, runRow.id, strategyId, timestamp, artifactRecords);

  updateStrategyStatus(db, strategyId, {
    failure_reason: message,
    finished_at: timestamp,
    status: "blocked"
  });

  db.prepare(
    `update search_run
     set status = 'blocked',
         finished_at = null,
         summary_text = 'Trip.com blocked the run and user recovery is required.',
         failure_reason = ?,
         recovery_state = 'pending',
         recovery_type = 'challenge_required',
         recovery_reason = ?,
         blocked_at = ?,
         resume_available = 1,
         resume_mode = 'partial_restart',
         resume_checkpoint_json = ?,
         recovery_completed_at = null
     where id = ?`
  ).run(message, message, timestamp, JSON.stringify(resumeCheckpoint), runRow.id);

  db.prepare(
    `update session
     set lifecycle_state = 'needs_attention', is_live = ?, updated_at = ?
     where id = ?`
  ).run(runRow.monitoring_state === "enabled" ? 1 : 0, timestamp, runRow.session_id);

  refreshStrategyExperimentGroup(db, runRow.strategy_experiment_group_id);
}

function finalizeRunSuccess(db, runRow, resumed) {
  const timestamp = nowIso();
  const allCandidates = selectRunCandidates(db, runRow.id);
  const allStrategies = selectStrategies(db, runRow.id);
  const completedStrategies = allStrategies.filter((strategy) =>
    ["completed", "failed", "skipped"].includes(strategy.status)
  );
  const failedStrategies = allStrategies.filter((strategy) => strategy.status === "failed");
  const bestCandidate = allCandidates[0] ?? null;

  db.prepare(
    `update search_run
     set status = 'completed',
         finished_at = ?,
         total_strategies_executed = ?,
         total_candidates_found = ?,
         total_candidates_verified = 0,
         best_candidate_id = ?,
         summary_text = ?,
         failure_reason = ?,
         recovery_state = ?,
         recovery_type = null,
         recovery_reason = null,
         resume_available = 0,
         resume_checkpoint_json = null,
         recovery_completed_at = ?
     where id = ?`
  ).run(
    timestamp,
    completedStrategies.length,
    allCandidates.length,
    bestCandidate?.id ?? null,
    failedStrategies.length > 0
      ? `Run completed with ${allCandidates.length} candidates and ${failedStrategies.length} non-blocking strategy failure${failedStrategies.length === 1 ? "" : "s"}.`
      : `Run completed with ${allCandidates.length} candidates across ${completedStrategies.length} strategi${completedStrategies.length === 1 ? "y" : "es"}.`,
    failedStrategies.length > 0
      ? `${failedStrategies.length} strategy failure${failedStrategies.length === 1 ? "" : "s"} occurred during expansion.`
      : null,
    resumed ? "completed" : "not_required",
    resumed ? timestamp : null,
    runRow.id
  );

  db.prepare(
    `update session
     set lifecycle_state = ?, is_live = ?, last_run_finished_at = ?, last_successful_run_id = ?, current_best_candidate_id = ?,
         next_refresh_at = ?, updated_at = ?
     where id = ?`
  ).run(
    runRow.monitoring_state === "enabled" ? "live_idle" : "not_live",
    runRow.monitoring_state === "enabled" ? 1 : 0,
    timestamp,
    runRow.id,
    bestCandidate?.id ?? null,
    runRow.monitoring_state === "enabled"
      ? addMinutes(timestamp, Number(runRow.refresh_interval_hours ?? 12) * 60)
      : null,
    timestamp,
    runRow.session_id
  );

  refreshStrategyExperimentGroup(db, runRow.strategy_experiment_group_id);

  writeConnectionState({
    detail: resumed
      ? "Trip.com recovery succeeded and the blocked run resumed successfully."
      : "Trip.com public packaged search succeeded in the current browser context.",
    lastCheckedAt: timestamp,
    lastUrl: "https://au.trip.com/flights/",
    state: "ready_public",
    updatedBy: resumed ? "manual_recovery" : "automation"
  });

  writeWorkerState({
    activeRunId: null,
    lastError: null,
    lastHeartbeatAt: timestamp,
    pid: null,
    startedAt: null,
    status: "idle"
  });
}

function deriveStitchedCandidates(db, runRow, strategy, seedCandidates) {
  const payload = parseStrategyPayload(strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}");
  const existing = selectStrategyCandidates(db, strategy.id);

  if (strategy.status === "completed" && existing.length > 0) {
    return existing;
  }

  if (seedCandidates.length === 0) {
    updateStrategyStatus(db, strategy.id, {
      finished_at: nowIso(),
      status: "skipped"
    });
    return [];
  }

  const discountRate = Number(payload.discountRate ?? 0.9);
  const maxDerivedCandidates = Number(payload.maxDerivedCandidates ?? 2);
  const departAt = `${runRow.departure_start_date}T08:00:00.000Z`;
  const returnAt = addMinutes(departAt, (runRow.duration_min_days ?? 7) * 24 * 60);

  const derived = seedCandidates.slice(0, maxDerivedCandidates).map((seed, index) => {
    const baseAmount = Number(seed.displayed_display_amount ?? seed.displayedAmount);
    const baseStopCount = Number(seed.stop_count ?? seed.stopCount ?? 0);
    const baseIntentionalStopCount = Number(
      seed.intentional_stop_count ?? seed.intentionalStopCount ?? 0
    );
    const baseTravelMinutes = Number(seed.total_travel_minutes ?? seed.totalTravelMinutes ?? 900);
    const familyId = ensureCandidateFamily(
      db,
      runRow.session_id,
      `${seed.candidate_family_id ?? seed.candidateFamilyId}-stitched-${index}`,
      "stitched",
      {
        derivedFrom: seed.id,
        strategy: "stitched_followup"
      }
    );

    return insertCandidateRecord(db, runRow.id, strategy.id, {
      bookingType: "stitched",
      candidateFamilyId: familyId,
      dedupeKey: `${runRow.id}-${strategy.id}-stitched-${index}`,
      displayedAmount: Math.max(120, Math.round(baseAmount * (discountRate + index * 0.03))),
      intentionalStopCount: Math.max(0, baseIntentionalStopCount),
      isCurrentBest: false,
      legs: [
        {
          arrivalAt: addMinutes(departAt, 610 + index * 15),
          bookingReferenceGroup: "split_outbound",
          carrierCode: "MU",
          destinationAirport: guessAirportCode(runRow.outbound_destination_city),
          departureAt: departAt,
          originAirport: runRow.origin_airport,
          rawLegPayloadJson: { derivedFrom: seed.id, mode: "stitched_outbound" },
          segmentGroup: "outbound"
        },
        {
          arrivalAt: addMinutes(returnAt, 630 + index * 15),
          bookingReferenceGroup: "split_return",
          carrierCode: "CZ",
          destinationAirport: runRow.return_destination_airport,
          departureAt: returnAt,
          originAirport: guessAirportCode(runRow.outbound_destination_city),
          rawLegPayloadJson: { derivedFrom: seed.id, mode: "stitched_return" },
          segmentGroup: "return"
        }
      ],
      outboundDestinationCity: runRow.outbound_destination_city,
      returnOriginCity:
        runRow.return_origin_mode === "fixed_city"
          ? runRow.return_origin_city
          : runRow.outbound_destination_city,
      riskNotes:
        "Derived stitched option using separate booking references. Lower displayed cost comes with higher coordination risk.",
      stitchedRiskLevel: index === 0 ? "medium" : "high",
      stopCount: Math.max(1, baseStopCount),
      strategyExecutionId: strategy.id,
      totalTravelMinutes: baseTravelMinutes + 40 * (index + 1)
    });
  });

  updateStrategyStatus(db, strategy.id, {
    actual_search_cost: 0,
    best_candidate_id: derived[0]?.id ?? null,
    candidate_count: derived.length,
    finished_at: nowIso(),
    status: derived.length > 0 ? "completed" : "skipped",
    verified_candidate_count: 0
  });

  return derived;
}

function collectRecordedStopoverEvidence(db, strategyId, destinationCityCode) {
  return collectRecordedStopoverEvidenceFromEvidence({
    db,
    destinationCityCode,
    isMainlandChinaCity,
    resolveCityName,
    safeJsonParse,
    strategyId
  });
}

function collectRecordedStopoverEvidenceForStrategies(db, strategyIds, destinationCityCode) {
  const evidenceByCity = new Map();

  for (const strategyId of [...new Set(strategyIds)].filter(Boolean)) {
    const strategyEvidence = collectRecordedStopoverEvidence(db, strategyId, destinationCityCode);

    for (const entry of strategyEvidence) {
      const existing = evidenceByCity.get(entry.cityCode);

      if (!existing) {
        evidenceByCity.set(entry.cityCode, { ...entry });
        continue;
      }

      if (Number(entry.lowestObservedPrice ?? Number.POSITIVE_INFINITY) < Number(existing.lowestObservedPrice ?? Number.POSITIVE_INFINITY)) {
        existing.lowestObservedPrice = entry.lowestObservedPrice;
        existing.parentQueryExecutionId = entry.parentQueryExecutionId;
        existing.queryInput = entry.queryInput;
        existing.resultUrl = entry.resultUrl;
      }

      existing.observationCount += Number(entry.observationCount ?? 0);
      evidenceByCity.set(entry.cityCode, existing);
    }
  }

  return [...evidenceByCity.values()].sort((left, right) => {
    const leftPrice = Number(left.lowestObservedPrice ?? Number.POSITIVE_INFINITY);
    const rightPrice = Number(right.lowestObservedPrice ?? Number.POSITIVE_INFINITY);

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return Number(right.observationCount ?? 0) - Number(left.observationCount ?? 0);
  });
}

function buildPreferredSignalSets(analysisSnapshot) {
  return buildPreferredSignalSetsFromEvidence(analysisSnapshot);
}

function buildMultiCityVerificationEvidence({
  baselineCheapestPrice,
  candidateEvidence,
  candidateReviewLimit,
  preferredSignals,
  queryEvidence
}) {
  return buildMultiCityVerificationEvidenceFromEvidence({
    baselineCheapestPrice,
    candidateReviewLimit,
    preferredSignals,
    queryEvidence,
    resolveCityName,
    reviewedSeeds: candidateEvidence
  });
}

function buildMultiCityVerificationSeedBoard({
  anchorDates,
  candidateReviewLimit,
  db,
  destinationCityCode,
  preferredSignals,
  runSeed,
  strategyIds
}) {
  return buildMultiCityVerificationSeedBoardFromEvidence({
    anchorDates,
    candidateReviewLimit,
    db,
    destinationCityCode,
    preferredSignals,
    resolveCityName,
    runSeed,
    safeJsonParse,
    strategyIds
  });
}

function buildMultiCityVerificationFollowupTargets({
  followupCityLimit,
  rankedCities,
  runSeed,
  seedContextsPerCityLimit
}) {
  return buildMultiCityVerificationFollowupTargetsFromEvidence({
    followupCityLimit,
    rankedCities,
    runSeed,
    seedContextsPerCityLimit
  });
}

function buildMultiCityVerificationResultsSummary({ baselineCheapestPrice, seedResults }) {
  return buildMultiCityVerificationResultsSummaryFromEvidence({
    baselineCheapestPrice,
    seedResults
  });
}

function buildAnchoredMultiCityResultsSummary({ baselineCheapestPrice, seedResults }) {
  return buildAnchoredMultiCityResultsSummaryFromEvidence({
    baselineCheapestPrice,
    seedResults
  });
}

function buildBaselineFollowupHandoff({ anchorDates, db, destinationCityCode, strategyIds }) {
  return buildBaselineFollowupHandoffFromEvidence({
    anchorDates,
    db,
    destinationCityCode,
    resolveCityName,
    safeJsonParse,
    strategyIds
  });
}

function buildRecommendationDateCoverageTargets({
  candidateReviewLimit,
  db,
  routeTargetLimit,
  runSeed,
  strategyIds
}) {
  return buildRecommendationDateCoverageTargetsFromEvidence({
    candidateReviewLimit,
    db,
    resolveCityName,
    routeTargetLimit,
    runSeed,
    strategyIds
  });
}

function buildLongStopValidationSummary({
  db,
  minimumLongStopHours,
  rankingSnapshot,
  sourceStrategyId
}) {
  return buildLongStopValidationSummaryFromEvidence({
    db,
    minimumLongStopHours,
    rankingSnapshot,
    resolveCityName,
    safeJsonParse,
    sourceStrategyId
  });
}

function buildLongStopFollowupTargets(longStopValidationSummary, followupCityLimit) {
  return buildLongStopFollowupTargetsFromEvidence({
    followupCityLimit,
    longStopValidationSummary
  });
}

function buildAlternateReturnCityTargets({
  candidateCityLimit,
  destinationCityCode,
  longStopFollowupSnapshot,
  longStopValidationSnapshot,
  multiCityRankingSnapshot,
  pass1Snapshot
}) {
  return buildAlternateReturnCityTargetsFromEvidence({
    candidateCityLimit,
    destinationCityCode,
    isMainlandChinaCity,
    longStopFollowupSnapshot,
    longStopValidationSnapshot,
    multiCityRankingSnapshot,
    pass1Snapshot,
    resolveCityName
  });
}

function insertRunAnalysisSnapshot(db, values) {
  const createdAt = nowIso();
  const id = createId("analysis");

  db.prepare(
    `insert into run_analysis_snapshot (
      id, search_run_id, strategy_execution_id, analysis_type, summary_json, created_at
    ) values (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    values.searchRunId,
    values.strategyExecutionId,
    values.analysisType,
    JSON.stringify(values.summary),
    createdAt
  );

  return {
    createdAt,
    id,
    summary: values.summary
  };
}

function getLatestRunAnalysisSnapshot(db, runId, analysisType) {
  const row = db
    .prepare(
      `select *
       from run_analysis_snapshot
       where search_run_id = ? and analysis_type = ?
       order by created_at desc
       limit 1`
    )
    .get(runId, analysisType);

  if (!row) {
    return null;
  }

  return {
    ...row,
    summary: safeJsonParse(row.summary_json, null)
  };
}

function analyzeDirectSweep(db, runRow, sourceStrategyIds, analysisStrategy, analysisPayload) {
  const effectiveStrategyIds = [...new Set(sourceStrategyIds)].filter(Boolean);

  if (effectiveStrategyIds.length === 0) {
    const snapshot = insertRunAnalysisSnapshot(db, {
      analysisType: "pass1_market_scan",
      searchRunId: runRow.id,
      strategyExecutionId: analysisStrategy.id,
      summary: {
        analysisType: "pass1_market_scan",
        analysedAt: nowIso(),
        analysedCandidateCount: 0,
        analysedCandidateFamilyCount: 0,
        analysedQueryCount: 0,
        airlineFindings: [],
        departureAirlineFindings: [],
        departureDateFindings: [],
        directSweepQueryCount: 0,
        recommendedDepartureAnchors: [],
        returnOptionExpansionQueryCount: 0,
        stopoverCityFindings: []
      }
    });

    updateStrategyStatus(db, analysisStrategy.id, {
      actual_search_cost: 0,
      failure_reason: null,
      finished_at: nowIso(),
      status: "skipped",
      candidate_count: 0,
      verified_candidate_count: 0
    });

    return snapshot;
  }

  const strategyPlaceholders = effectiveStrategyIds.map(() => "?").join(", ");
  const directQueries = db
    .prepare(
      `select id, query_input_json, query_type, result_summary_json, observed_stopover_cities_json
       from query_execution
       where strategy_execution_id in (${strategyPlaceholders}) and status = 'completed'
       order by started_at asc, priority asc`
    )
    .all(...effectiveStrategyIds);

  const candidateRows = db
    .prepare(
      `select
         qcl.query_execution_id,
         c.id as candidate_id,
         c.candidate_family_id,
         c.displayed_display_amount,
         c.stop_count,
         c.total_travel_minutes,
         cl.carrier_code,
         cl.raw_leg_payload_json
       from query_candidate_link qcl
       inner join itinerary_candidate c on c.id = qcl.itinerary_candidate_id
       left join candidate_leg cl
         on cl.itinerary_candidate_id = c.id
        and cl.segment_group = 'outbound'
        and cl.leg_index = 0
       where qcl.query_execution_id in (
         select id
         from query_execution
         where strategy_execution_id in (${strategyPlaceholders}) and status = 'completed'
       )`
    )
    .all(...effectiveStrategyIds);

  const departureDateMap = new Map();
  const airlineMap = new Map();
  const comboMap = new Map();
  const stopoverMap = new Map();
  const queryInputById = new Map();
  const linkedCandidateCountByQuery = new Map();
  const candidateFamilyIds = new Set();

  for (const query of directQueries) {
    const input = safeJsonParse(query.query_input_json, {});
    const summary = safeJsonParse(query.result_summary_json, {});
    const stopovers = safeJsonParse(query.observed_stopover_cities_json, []);
    const departDate = input.departDate;
    const returnDate = input.returnDate;
    queryInputById.set(query.id, input);

    if (departDate) {
      const existing = departureDateMap.get(departDate) ?? {
        averagePriceAccumulator: 0,
        candidateCount: 0,
        cheapestPrice: Number.POSITIVE_INFINITY,
        departDate,
        linkedQueryCount: 0,
        observedReturnDates: []
      };
      existing.cheapestPrice = Math.min(existing.cheapestPrice, Number(summary.cheapestPrice ?? Number.POSITIVE_INFINITY));
      existing.linkedQueryCount += 1;
      if (returnDate) {
        existing.observedReturnDates.push(returnDate);
      }
      departureDateMap.set(departDate, existing);
    }

    for (const stopover of stopovers) {
      if (!stopover?.cityCode) {
        continue;
      }

      const existing = stopoverMap.get(stopover.cityCode) ?? {
        cityCode: stopover.cityCode,
        cityName: stopover.cityName ?? resolveCityName(stopover.cityCode),
        cheapestObservedPrice: Number.POSITIVE_INFINITY,
        observationCount: 0
      };
      existing.cheapestObservedPrice = Math.min(
        existing.cheapestObservedPrice,
        Number(stopover.displayedPriceAmount ?? Number.POSITIVE_INFINITY)
      );
      existing.observationCount += 1;
      stopoverMap.set(stopover.cityCode, existing);
    }
  }

  for (const row of candidateRows) {
    const input = queryInputById.get(row.query_execution_id) ?? {};
    const departDate = input.departDate ?? null;
    const rawLegPayload = safeJsonParse(row.raw_leg_payload_json, null);
    const airline =
      rawLegPayload?.airline ??
      rawLegPayload?.carrier ??
      row.carrier_code ??
      "Unknown";
    const displayedAmount = Number(row.displayed_display_amount ?? Number.POSITIVE_INFINITY);

    linkedCandidateCountByQuery.set(
      row.query_execution_id,
      (linkedCandidateCountByQuery.get(row.query_execution_id) ?? 0) + 1
    );
    if (row.candidate_family_id) {
      candidateFamilyIds.add(row.candidate_family_id);
    }

    if (departDate && departureDateMap.has(departDate)) {
      const existing = departureDateMap.get(departDate);
      existing.averagePriceAccumulator += displayedAmount;
      existing.candidateCount += 1;
      departureDateMap.set(departDate, existing);
    }

    const airlineKey = airline;
    const airlineExisting = airlineMap.get(airlineKey) ?? {
      airline,
      averagePriceAccumulator: 0,
      candidateCount: 0,
      cheapestPrice: Number.POSITIVE_INFINITY
    };
    airlineExisting.averagePriceAccumulator += displayedAmount;
    airlineExisting.candidateCount += 1;
    airlineExisting.cheapestPrice = Math.min(airlineExisting.cheapestPrice, displayedAmount);
    airlineMap.set(airlineKey, airlineExisting);

    if (departDate) {
      const comboKey = `${departDate}__${airline}`;
      const comboExisting = comboMap.get(comboKey) ?? {
        airline,
        averagePriceAccumulator: 0,
        candidateCount: 0,
        cheapestPrice: Number.POSITIVE_INFINITY,
        departDate
      };
      comboExisting.averagePriceAccumulator += displayedAmount;
      comboExisting.candidateCount += 1;
      comboExisting.cheapestPrice = Math.min(comboExisting.cheapestPrice, displayedAmount);
      comboMap.set(comboKey, comboExisting);
    }
  }

  const departureDateFindings = [...departureDateMap.values()]
    .map((entry) => ({
      averagePrice:
        entry.candidateCount > 0
          ? Math.round(entry.averagePriceAccumulator / entry.candidateCount)
          : null,
      candidateCount: entry.candidateCount,
      cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null,
      departDate: entry.departDate,
      linkedQueryCount: entry.linkedQueryCount,
      observedReturnDates: Array.from(new Set(entry.observedReturnDates)).sort()
    }))
    .sort((left, right) => {
      const leftPrice = left.cheapestPrice ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.cheapestPrice ?? Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return right.candidateCount - left.candidateCount;
    });

  const airlineFindings = [...airlineMap.values()]
    .map((entry) => ({
      airline: entry.airline,
      averagePrice: Math.round(entry.averagePriceAccumulator / Math.max(entry.candidateCount, 1)),
      candidateCount: entry.candidateCount,
      cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null
    }))
    .sort((left, right) => {
      const leftPrice = left.cheapestPrice ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.cheapestPrice ?? Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return right.candidateCount - left.candidateCount;
    })
    .slice(0, 6);

  const departureAirlineFindings = [...comboMap.values()]
    .map((entry) => ({
      airline: entry.airline,
      averagePrice: Math.round(entry.averagePriceAccumulator / Math.max(entry.candidateCount, 1)),
      candidateCount: entry.candidateCount,
      cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null,
      departDate: entry.departDate
    }))
    .sort((left, right) => {
      const leftPrice = left.cheapestPrice ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.cheapestPrice ?? Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return right.candidateCount - left.candidateCount;
    })
    .slice(0, 6);

  const stopoverCityFindings = [...stopoverMap.values()]
    .sort((left, right) => {
      if (left.cheapestObservedPrice !== right.cheapestObservedPrice) {
        return left.cheapestObservedPrice - right.cheapestObservedPrice;
      }

      return right.observationCount - left.observationCount;
    })
    .slice(0, 8);

  const recommendedDepartureAnchors = departureDateFindings
    .slice(0, Number(analysisPayload.anchorDepartureDateLimit ?? 2))
    .map((entry) => ({
      departDate: entry.departDate,
      cheapestPrice: entry.cheapestPrice,
      rationale:
        entry.candidateCount > 0
          ? `Cheapest observed departure date so far with AUD ${entry.cheapestPrice} across ${entry.candidateCount} extracted candidate${entry.candidateCount === 1 ? "" : "s"}.`
          : `Observed as a promising departure date during the direct sweep.`,
      sampledReturnDates: entry.observedReturnDates.slice(0, 4)
    }));

  const summary = {
    analysisType: "pass1_market_scan",
    analysedAt: nowIso(),
    analysedCandidateFamilyCount: candidateFamilyIds.size,
    analysedQueryCount: directQueries.length,
    analysedCandidateCount: candidateRows.length,
    departureDateFindings: departureDateFindings.slice(0, 8),
    directSweepQueryCount: directQueries.filter((query) => query.query_type === "direct_round_trip").length,
    airlineFindings,
    departureAirlineFindings,
    stopoverCityFindings,
    returnOptionExpansionQueryCount: directQueries.filter(
      (query) => query.query_type === "return_option_expansion"
    ).length,
    recommendedDepartureAnchors
  };

  const snapshot = insertRunAnalysisSnapshot(db, {
    analysisType: "pass1_market_scan",
    searchRunId: runRow.id,
    strategyExecutionId: analysisStrategy.id,
    summary
  });
  const baselineFollowupHandoff = buildBaselineFollowupHandoff({
    anchorDates: recommendedDepartureAnchors.map((entry) => entry.departDate),
    db,
    destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
    strategyIds: effectiveStrategyIds
  });

  insertRunAnalysisSnapshot(db, {
    analysisType: "baseline_followup_handoff",
    searchRunId: runRow.id,
    strategyExecutionId: analysisStrategy.id,
    summary: {
      analysedAt: nowIso(),
      analysisType: "baseline_followup_handoff",
      ...baselineFollowupHandoff
    }
  });

  updateStrategyStatus(db, analysisStrategy.id, {
    actual_search_cost: 0,
    failure_reason: null,
    finished_at: nowIso(),
    status: "completed",
    candidate_count: 0,
    verified_candidate_count: 0
  });

  return snapshot;
}

function enumerateAnchoredDatePairs(runRow, anchorDate, limit, existingPairKeys) {
  const durationMin = Math.max(1, Number(runRow.duration_min_days ?? 7));
  const durationMax = Math.max(durationMin, Number(runRow.duration_max_days ?? durationMin));
  const latestReturnDate = runRow.return_end_date ?? runRow.departure_end_date;
  const pairs = [];

  for (let duration = durationMin; duration <= durationMax; duration += 1) {
    const returnDate = addDays(anchorDate, duration);
    const pairKey = `${anchorDate}__${returnDate}`;

    if (returnDate > latestReturnDate || existingPairKeys.has(pairKey)) {
      continue;
    }

    pairs.push({
      departDate: anchorDate,
      durationDays: duration,
      returnDate
    });
  }

  return sampleEvenly(pairs, limit);
}

function enumerateRecommendationCoverageDatePairs({ departDate, limit, returnDate, runRow, runSeed }) {
  const durationMin = Math.max(1, Number(runRow.duration_min_days ?? 7));
  const durationMax = Math.max(durationMin, Number(runRow.duration_max_days ?? durationMin));
  const latestReturnDate = runRow.return_end_date ?? runRow.departure_end_date;
  const earliestDepartDate = runRow.departure_start_date;
  const latestDepartDate = runRow.departure_end_date;
  const targetDuration = Math.max(
    durationMin,
    Math.min(durationMax, getDateDistanceDays(departDate, returnDate))
  );
  const variationWindowDays = Math.max(2, Math.min(4, Number(limit ?? 1) + 1));
  const pairCandidates = [];
  const seenPairKeys = new Set([buildDatePairKey({ departDate, returnDate })]);

  for (
    let departOffset = -variationWindowDays;
    departOffset <= variationWindowDays;
    departOffset += 1
  ) {
    const candidateDepartDate = addDays(departDate, departOffset);

    if (
      compareIsoDates(candidateDepartDate, earliestDepartDate) < 0 ||
      compareIsoDates(candidateDepartDate, latestDepartDate) > 0
    ) {
      continue;
    }

    for (
      let returnOffset = -variationWindowDays;
      returnOffset <= variationWindowDays;
      returnOffset += 1
    ) {
      const candidateReturnDate = addDays(returnDate, returnOffset);
      const pairKey = buildDatePairKey({
        departDate: candidateDepartDate,
        returnDate: candidateReturnDate
      });

      if (seenPairKeys.has(pairKey) || compareIsoDates(candidateReturnDate, latestReturnDate) > 0) {
        continue;
      }

      const durationDays =
        Number(readDateOrdinal(candidateReturnDate) ?? 0) -
        Number(readDateOrdinal(candidateDepartDate) ?? 0);

      if (durationDays < durationMin || durationDays > durationMax) {
        continue;
      }

      seenPairKeys.add(pairKey);
      pairCandidates.push({
        departDate: candidateDepartDate,
        durationDays,
        returnDate: candidateReturnDate,
        score:
          Math.abs(departOffset) +
          Math.abs(returnOffset) +
          Math.abs(durationDays - targetDuration) * 0.75 +
          createDeterministicUnitInterval(
            `${runSeed}:${candidateDepartDate}:${candidateReturnDate}`
          ) *
            0.15
      });
    }
  }

  return pairCandidates
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      const leftPriceDistance = Math.abs(Number(left.durationDays ?? targetDuration) - targetDuration);
      const rightPriceDistance = Math.abs(Number(right.durationDays ?? targetDuration) - targetDuration);

      if (leftPriceDistance !== rightPriceDistance) {
        return leftPriceDistance - rightPriceDistance;
      }

      return buildDatePairKey(left).localeCompare(buildDatePairKey(right));
    })
    .slice(0, Math.max(1, Number(limit ?? 1)))
    .map(({ departDate: nextDepartDate, durationDays, returnDate: nextReturnDate }) => ({
      departDate: nextDepartDate,
      durationDays,
      returnDate: nextReturnDate
    }));
}

function buildAlternateReturnCityDatePairs(runRow, pass1Snapshot, limit) {
  const summary = pass1Snapshot?.summary ?? {};
  const anchorDates = Array.isArray(summary.recommendedDepartureAnchors)
    ? summary.recommendedDepartureAnchors
        .map((entry) => entry?.departDate)
        .filter(Boolean)
    : Array.isArray(summary.departureDateFindings)
      ? summary.departureDateFindings
          .slice(0, 3)
          .map((entry) => entry?.departDate)
          .filter(Boolean)
      : [];

  if (anchorDates.length === 0) {
    return enumerateDatePairs(runRow, limit).sampledPairs;
  }

  const existingPairKeys = new Set();
  const pairs = [];
  const limitPerAnchor = Math.max(1, Math.ceil(limit / Math.max(anchorDates.length, 1)));

  for (const anchorDate of anchorDates) {
    if (pairs.length >= limit) {
      break;
    }

    const anchorPairs = enumerateAnchoredDatePairs(
      runRow,
      anchorDate,
      limitPerAnchor,
      existingPairKeys
    );

    for (const pair of anchorPairs) {
      const pairKey = `${pair.departDate}__${pair.returnDate}`;

      if (existingPairKeys.has(pairKey)) {
        continue;
      }

      existingPairKeys.add(pairKey);
      pairs.push(pair);

      if (pairs.length >= limit) {
        break;
      }
    }
  }

  return pairs.length > 0 ? sampleEvenly(pairs, limit) : enumerateDatePairs(runRow, limit).sampledPairs;
}

function buildAlternateReturnCitySummary(db, sourceStrategyId, targetCities) {
  if (!sourceStrategyId) {
    return [];
  }

  const queryRows = db
    .prepare(
      `select query_input_json
       from query_execution
       where strategy_execution_id = ? and status = 'completed'
       order by priority asc`
    )
    .all(sourceStrategyId);
  const candidateRows = db
    .prepare(
      `select
         c.displayed_display_amount,
         q.query_input_json
       from itinerary_candidate c
       left join query_candidate_link qcl
         on qcl.itinerary_candidate_id = c.id
       left join query_execution q
         on q.id = qcl.query_execution_id
       where c.strategy_execution_id = ?
       order by c.displayed_display_amount asc`
    )
    .all(sourceStrategyId);
  const citySummary = new Map(
    (targetCities ?? []).map((entry) => [
      entry.cityCode,
      {
        candidateCount: 0,
        cheapestCandidatePrice: null,
        cityCode: entry.cityCode,
        cityName: entry.cityName,
        queryCount: 0,
        reasons: entry.reasons ?? [],
        targetScore: entry.targetScore ?? 0
      }
    ])
  );

  for (const row of queryRows) {
    const input = safeJsonParse(row.query_input_json, {});
    const cityCode = input.destinationCityCode;

    if (!cityCode) {
      continue;
    }

    const existing = citySummary.get(cityCode) ?? {
      candidateCount: 0,
      cheapestCandidatePrice: null,
      cityCode,
      cityName: resolveCityName(cityCode),
      queryCount: 0,
      reasons: [],
      targetScore: 0
    };
    existing.queryCount += 1;
    citySummary.set(cityCode, existing);
  }

  for (const row of candidateRows) {
    const input = safeJsonParse(row.query_input_json, {});
    const cityCode = input.destinationCityCode;

    if (!cityCode) {
      continue;
    }

    const existing = citySummary.get(cityCode) ?? {
      candidateCount: 0,
      cheapestCandidatePrice: null,
      cityCode,
      cityName: resolveCityName(cityCode),
      queryCount: 0,
      reasons: [],
      targetScore: 0
    };
    existing.candidateCount += 1;
    existing.cheapestCandidatePrice =
      existing.cheapestCandidatePrice === null
        ? Number(row.displayed_display_amount ?? Number.POSITIVE_INFINITY)
        : Math.min(
            existing.cheapestCandidatePrice,
            Number(row.displayed_display_amount ?? Number.POSITIVE_INFINITY)
          );
    citySummary.set(cityCode, existing);
  }

  return [...citySummary.values()]
    .map((entry) => ({
      ...entry,
      cheapestCandidatePrice:
        typeof entry.cheapestCandidatePrice === "number" &&
        Number.isFinite(entry.cheapestCandidatePrice)
          ? entry.cheapestCandidatePrice
          : null
    }))
    .sort((left, right) => {
      const leftPrice = Number(left.cheapestCandidatePrice ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.cheapestCandidatePrice ?? Number.POSITIVE_INFINITY);
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      if (right.candidateCount !== left.candidateCount) {
        return right.candidateCount - left.candidateCount;
      }

      return right.targetScore - left.targetScore;
    });
}

function finalizeQuerySummary(db, queryExecutionId, summary, observedStopovers, resultUrl, status = "completed") {
  updateQueryExecution(db, queryExecutionId, {
    failure_reason: null,
    finished_at: nowIso(),
    observed_stopover_cities_json: JSON.stringify(observedStopovers),
    result_summary_json: JSON.stringify(summary),
    status,
    tripcom_result_url: resultUrl
  });
}

function failQueryExecution(db, queryExecutionId, message, status = "failed") {
  updateQueryExecution(db, queryExecutionId, {
    failure_reason: message,
    finished_at: nowIso(),
    status
  });
}

function sortCardsByPrice(cards) {
  return [...cards].sort((left, right) => {
    const leftPrice = Number.isFinite(left?.priceAmount) ? left.priceAmount : Number.POSITIVE_INFINITY;
    const rightPrice = Number.isFinite(right?.priceAmount) ? right.priceAmount : Number.POSITIVE_INFINITY;

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return (left?.cardIndex ?? Number.MAX_SAFE_INTEGER) - (right?.cardIndex ?? Number.MAX_SAFE_INTEGER);
  });
}

function normalizeCardText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isConstraintEnabled(value) {
  return value === true || value === 1 || value === "1";
}

function buildRunCardConstraintSummary(runRow) {
  const activeConstraints = [];

  if (isConstraintEnabled(runRow?.require_included_checked_baggage)) {
    activeConstraints.push("checked_baggage_included");
  }

  if (isConstraintEnabled(runRow?.restrict_to_chinese_airlines)) {
    activeConstraints.push("china_based_airline");
  }

  return activeConstraints;
}

function hasActiveCardConstraints(runRow) {
  return buildRunCardConstraintSummary(runRow).length > 0;
}

function evaluateCardAgainstRunConstraints(card, runRow) {
  const failedRules = [];

  if (
    isConstraintEnabled(runRow?.require_included_checked_baggage) &&
    !card?.hasIncludedCheckedBaggage
  ) {
    failedRules.push("checked_baggage_included");
  }

  if (
    isConstraintEnabled(runRow?.restrict_to_chinese_airlines) &&
    !isChinaBasedAirline({
      airlineCode: card?.airlineCode,
      airlineName: card?.airline,
      operatingAirlineName: card?.operatingAirline
    })
  ) {
    failedRules.push("china_based_airline");
  }

  return {
    failedRules,
    include: failedRules.length === 0
  };
}

function filterCardsForRunConstraints(cards, runRow) {
  const rejectionCounts = {
    checked_baggage_included: 0,
    china_based_airline: 0
  };
  const eligibleCards = [];

  for (const card of cards ?? []) {
    const evaluation = evaluateCardAgainstRunConstraints(card, runRow);

    if (evaluation.include) {
      eligibleCards.push(card);
      continue;
    }

    evaluation.failedRules.forEach((rule) => {
      rejectionCounts[rule] = Number(rejectionCounts[rule] ?? 0) + 1;
    });
  }

  return {
    eligibleCards,
    rejectedCardCount: Math.max(0, (cards?.length ?? 0) - eligibleCards.length),
    rejectionCounts
  };
}

function summarizeCardConstraintRejections(filterResult) {
  const reasons = [];

  if (Number(filterResult?.rejectionCounts?.checked_baggage_included ?? 0) > 0) {
    reasons.push("missing checked baggage");
  }

  if (Number(filterResult?.rejectionCounts?.china_based_airline ?? 0) > 0) {
    reasons.push("non-Chinese airline");
  }

  return reasons.join(", ");
}

async function parseEligibleVisibleCards(page, stageName, limit, runRow) {
  const scannedCards = sortCardsByPrice(await parseVisibleCards(page, stageName, limit));
  const filterResult = filterCardsForRunConstraints(scannedCards, runRow);

  return {
    cards: filterResult.eligibleCards,
    rejectedCardCount: filterResult.rejectedCardCount,
    rejectionCounts: filterResult.rejectionCounts,
    scannedCards
  };
}

function createDeterministicUnitInterval(seed) {
  const digest = crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 8);
  return parseInt(digest, 16) / 0xffffffff;
}

function readIsoDayBucket(dateValue, bucketSizeDays = familyCoverageDateBucketDays) {
  if (!dateValue) {
    return "undated";
  }

  const timestamp = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(timestamp)) {
    return "undated";
  }

  return String(Math.floor(timestamp / (bucketSizeDays * 24 * 60 * 60_000)));
}

function extractCardStopoverSourceText(card) {
  return normalizeCardText(card?.stopText ?? card?.accessibilitySummary ?? "");
}

function cleanDetectedCityLabel(value) {
  return normalizeCardText(value)
    .replace(/\bfor\b.*$/i, "")
    .replace(/\d+\s*h.*$/i, "")
    .replace(/\d+\s*m.*$/i, "")
    .replace(/\bstops?\b.*$/i, "")
    .replace(/[^a-z0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStopoverCityLabelsFromCard(card) {
  const stopText = extractCardStopoverSourceText(card);

  if (!stopText || /direct/.test(stopText)) {
    return [];
  }

  const labels = new Set();
  const patterns = [
    /layover in\s+([a-z0-9\s-]+?)(?=$|,|\d+\s*h|\d+\s*m|\bfor\b)/gi,
    /via\s+([a-z0-9\s-]+?)(?=$|,|\d+\s*h|\d+\s*m|\bfor\b)/gi,
    /\bin\s+([a-z0-9\s-]+?)(?=$|,|\d+\s*h|\d+\s*m|\bfor\b)/gi
  ];

  for (const pattern of patterns) {
    for (const match of stopText.matchAll(pattern)) {
      const cleaned = cleanDetectedCityLabel(match[1]);

      if (cleaned) {
        labels.add(cleaned);
      }
    }
  }

  return [...labels];
}

function parseTimeMarkerMinutes(value) {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function buildCardStopoverSignature(card) {
  const stopText = extractCardStopoverSourceText(card);

  if (!stopText || /direct/.test(stopText)) {
    return "direct";
  }

  const detectedCity = extractStopoverCityLabelsFromCard(card)[0];
  if (detectedCity) {
    return detectedCity;
  }

  return stopText.replace(/[^a-z0-9]+/g, " ").trim();
}

function buildCardScheduleSignature(card) {
  const timingMarkers = Array.isArray(card?.timingMarkers) ? card.timingMarkers : [];
  const bucketedMarkers = timingMarkers
    .map((marker) => parseTimeMarkerMinutes(marker))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.floor(value / scheduleSimilarityBucketMinutes));

  if (bucketedMarkers.length > 0) {
    return bucketedMarkers.join("-");
  }

  return normalizeCardText(card?.accessibilitySummary ?? "");
}

function buildCardSelectionGroupKey(card, queryInput) {
  return JSON.stringify({
    airline: normalizeCardText(card?.airline ?? ""),
    departDate: normalizeCardText(queryInput?.departDate ?? ""),
    priceAmount: Number.isFinite(card?.priceAmount) ? Number(card.priceAmount).toFixed(2) : "na",
    returnDate: normalizeCardText(queryInput?.returnDate ?? ""),
    scheduleSignature: buildCardScheduleSignature(card),
    stopoverSignature: buildCardStopoverSignature(card)
  });
}

function selectDistinctCardsByPrice(cards, targetCount, queryInput) {
  const sortedCards = sortCardsByPrice(cards);
  const groups = new Map();
  const selectedCards = [];

  for (const card of sortedCards) {
    const groupKey = buildCardSelectionGroupKey(card, queryInput);
    const currentGroup = groups.get(groupKey) ?? [];
    currentGroup.push(card);
    groups.set(groupKey, currentGroup);

    if (currentGroup.length === 1 && selectedCards.length < targetCount) {
      selectedCards.push(card);
    }
  }

  return {
    distinctCardCount: groups.size,
    duplicateCardCount: Math.max(0, sortedCards.length - groups.size),
    selectedCards,
    selectedGroupCount: selectedCards.length
  };
}

function buildExpansionTargetFamilyKey(target) {
  return JSON.stringify({
    outboundAirline: normalizeCardText(target?.outboundCard?.airline ?? ""),
    outboundStopoverSignature: buildCardStopoverSignature(target?.outboundCard),
    returnAirline: normalizeCardText(target?.returnCard?.airline ?? ""),
    returnStopoverSignature: buildCardStopoverSignature(target?.returnCard),
    stopCount: Number(target?.stopCount ?? 0)
  });
}

function buildExpansionTargetDateBucket(target) {
  return `${readIsoDayBucket(target?.departDate)}__${readIsoDayBucket(target?.returnDate)}`;
}

function orderCandidateFamiliesForExpansion(families, runSeed) {
  const sorted = [...families].sort((left, right) => {
    if (left.cheapestPrice !== right.cheapestPrice) {
      return left.cheapestPrice - right.cheapestPrice;
    }

    return String(left?.familyKey ?? "").localeCompare(String(right?.familyKey ?? ""));
  });
  const ordered = [];
  const chunkSize = 3;

  for (let index = 0; index < sorted.length; index += chunkSize) {
    const chunk = sorted.slice(index, index + chunkSize);
    chunk.sort((left, right) => {
      const leftWeight = createDeterministicUnitInterval(`${runSeed}:${left.familyKey}`);
      const rightWeight = createDeterministicUnitInterval(`${runSeed}:${right.familyKey}`);
      return leftWeight - rightWeight;
    });
    ordered.push(...chunk);
  }

  return ordered;
}

function buildBaselineReturnExpansionTargetQueue(candidates, targetLimit, runSeed) {
  if (targetLimit <= 0 || candidates.length === 0) {
    return [];
  }

  const familyMap = new Map();

  for (const candidate of candidates) {
    const familyKey = buildExpansionTargetFamilyKey(candidate);
    const familyEntry = familyMap.get(familyKey) ?? {
      familyKey,
      members: [],
      cheapestPrice: Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY),
      usedDateBuckets: new Set()
    };
    familyEntry.cheapestPrice = Math.min(
      familyEntry.cheapestPrice,
      Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY)
    );
    familyEntry.members.push(candidate);
    familyMap.set(familyKey, familyEntry);
  }

  const orderedFamilies = orderCandidateFamiliesForExpansion([...familyMap.values()], runSeed).map(
    (family) => ({
      ...family,
      members: [...family.members].sort((left, right) => {
        const leftPrice = Number(left.displayedAmount ?? Number.POSITIVE_INFINITY);
        const rightPrice = Number(right.displayedAmount ?? Number.POSITIVE_INFINITY);

        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return (
          createDeterministicUnitInterval(`${runSeed}:${family.familyKey}:${left.candidateId}`) -
          createDeterministicUnitInterval(`${runSeed}:${family.familyKey}:${right.candidateId}`)
        );
      })
    })
  );
  const selected = [];
  const selectedIds = new Set();
  let allowRepeatDateBuckets = false;

  while (selected.length < targetLimit) {
    let addedInRound = false;

    for (const family of orderedFamilies) {
      const preferredCandidate = family.members.find((candidate) => {
        if (selectedIds.has(candidate.candidateId)) {
          return false;
        }

        if (allowRepeatDateBuckets) {
          return true;
        }

        const dateBucket = buildExpansionTargetDateBucket(candidate);
        return !family.usedDateBuckets.has(dateBucket);
      });

      if (!preferredCandidate) {
        continue;
      }

      const dateBucket = buildExpansionTargetDateBucket(preferredCandidate);
      family.usedDateBuckets.add(dateBucket);
      selectedIds.add(preferredCandidate.candidateId);
      selected.push({
        ...preferredCandidate,
        familyKey: family.familyKey,
        selectionPhase: allowRepeatDateBuckets ? "family_repeat" : "family_coverage"
      });
      addedInRound = true;

      if (selected.length >= targetLimit) {
        break;
      }
    }

    if (selected.length >= targetLimit) {
      break;
    }

    if (!addedInRound && allowRepeatDateBuckets) {
      break;
    }

    if (!addedInRound) {
      allowRepeatDateBuckets = true;
    }
  }

  return selected;
}

function findMatchingCard(cards, targetCard, queryInput) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const targetGroupKey = buildCardSelectionGroupKey(targetCard, queryInput);
  const exact = cards.find(
    (card) => buildCardSelectionGroupKey(card, queryInput) === targetGroupKey
  );

  if (exact) {
    return exact;
  }

  const fallback = cards.find(
    (card) =>
      normalizeCardText(card?.airline ?? "") === normalizeCardText(targetCard?.airline ?? "") &&
      buildCardStopoverSignature(card) === buildCardStopoverSignature(targetCard) &&
      Math.abs(Number(card?.priceAmount ?? Number.POSITIVE_INFINITY) - Number(targetCard?.priceAmount ?? Number.POSITIVE_INFINITY)) < 1
  );

  if (fallback) {
    return fallback;
  }

  return cards[targetCard?.cardIndex ? Math.max(0, Number(targetCard.cardIndex) - 1) : 0] ?? null;
}

function buildObservedStopoversFromCards(cards) {
  const evidence = new Map();

  for (const card of cards) {
    const cityLabels = extractStopoverCityLabelsFromCard(card);

    for (const cityLabel of cityLabels) {
      const cityCode = resolveKnownCityCode(cityLabel);

      if (!cityCode) {
        continue;
      }

      const existing = evidence.get(cityCode) ?? {
        cityCode,
        cityName: resolveCityName(cityCode),
        displayedPriceAmount: Number.POSITIVE_INFINITY,
        observationCount: 0
      };
      existing.displayedPriceAmount = Math.min(
        existing.displayedPriceAmount,
        Number(card?.priceAmount ?? Number.POSITIVE_INFINITY)
      );
      existing.observationCount += 1;
      evidence.set(cityCode, existing);
    }
  }

  return [...evidence.values()]
    .map((entry) => ({
      ...entry,
      displayedPriceAmount: Number.isFinite(entry.displayedPriceAmount)
        ? entry.displayedPriceAmount
        : null
    }))
    .sort((left, right) => {
      const leftPrice = Number(left.displayedPriceAmount ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.displayedPriceAmount ?? Number.POSITIVE_INFINITY);

      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return right.observationCount - left.observationCount;
    });
}

function mergeObservedStopoverEvidence(evidenceMap, stopovers) {
  for (const stopover of stopovers ?? []) {
    if (!stopover?.cityCode) {
      continue;
    }

    const existing = evidenceMap.get(stopover.cityCode) ?? {
      cityCode: stopover.cityCode,
      cityName: stopover.cityName ?? resolveCityName(stopover.cityCode),
      displayedPriceAmount: Number.POSITIVE_INFINITY,
      observationCount: 0
    };

    existing.displayedPriceAmount = Math.min(
      existing.displayedPriceAmount,
      Number(stopover.displayedPriceAmount ?? Number.POSITIVE_INFINITY)
    );
    existing.observationCount += Number(stopover.observationCount ?? 1);
    evidenceMap.set(stopover.cityCode, existing);
  }
}

function finalizeObservedStopoverEvidence(evidenceMap) {
  return [...evidenceMap.values()]
    .map((entry) => ({
      ...entry,
      displayedPriceAmount: Number.isFinite(entry.displayedPriceAmount)
        ? entry.displayedPriceAmount
        : null
    }))
    .sort((left, right) => {
      const leftPrice = Number(left.displayedPriceAmount ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.displayedPriceAmount ?? Number.POSITIVE_INFINITY);

      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return Number(right.observationCount ?? 0) - Number(left.observationCount ?? 0);
    });
}

function buildObservedStopoversForQuery(runRow, filterOptions, eligibleCards) {
  const evidenceMap = new Map();
  mergeObservedStopoverEvidence(evidenceMap, buildObservedStopoversFromCards(eligibleCards));

  if (!hasActiveCardConstraints(runRow)) {
    mergeObservedStopoverEvidence(evidenceMap, filterOptions);
  }

  return finalizeObservedStopoverEvidence(evidenceMap);
}

function resolveStopoverCityCodesFromCard(card, fallbackCityCode = null) {
  const codes = new Set();

  if (fallbackCityCode) {
    codes.add(fallbackCityCode);
  }

  for (const cityLabel of extractStopoverCityLabelsFromCard(card)) {
    const resolvedCityCode = resolveKnownCityCode(cityLabel);

    if (resolvedCityCode) {
      codes.add(resolvedCityCode);
    }
  }

  return [...codes];
}

function buildSegmentStopoversFromCard({
  card,
  departureAt,
  fallbackCityCode = null,
  maximumIntentionalStopMinutes,
  minimumIntentionalStopMinutes
}) {
  if (inferStopCount(card?.stopText) <= 0) {
    return [];
  }

  const cityCodes = resolveStopoverCityCodesFromCard(card, fallbackCityCode);

  if (cityCodes.length === 0) {
    return [];
  }

  const detectedDurationMinutes = Math.max(0, parseStopoverDurationMinutes(card?.stopText));

  return cityCodes.map((cityCode, index) => {
    const durationMinutes =
      detectedDurationMinutes > 0 && (cityCodes.length === 1 || index === 0)
        ? detectedDurationMinutes
        : 0;
    const arrivalAt = addMinutes(departureAt, 240 + index * 180);

    return {
      airportCode: cityCode,
      arrivalAt,
      cityCode,
      countryCode: isMainlandChinaCity(cityCode) ? "CN" : null,
      departureAt: addMinutes(arrivalAt, durationMinutes),
      durationMinutes,
      isIntentional:
        durationMinutes >= minimumIntentionalStopMinutes &&
        durationMinutes <= maximumIntentionalStopMinutes,
      isMainlandChina: isMainlandChinaCity(cityCode)
    };
  });
}

function buildAnchoredMultiCityObservedStopovers({
  anchoredCityCode,
  finalPriceAmount,
  stageCards
}) {
  const evidenceMap = new Map();
  mergeObservedStopoverEvidence(evidenceMap, buildObservedStopoversFromCards(stageCards));

  mergeObservedStopoverEvidence(evidenceMap, [
    {
      cityCode: anchoredCityCode,
      cityName: resolveCityName(anchoredCityCode),
      displayedPriceAmount: Number(finalPriceAmount ?? Number.POSITIVE_INFINITY),
      observationCount: 1
    }
  ]);

  return finalizeObservedStopoverEvidence(evidenceMap);
}

async function readVisibleCardSignatureList(page, limit = 3) {
  return page
    .locator('[data-testid^="u-flight-card-"]')
    .evaluateAll((nodes, maxCards) =>
      nodes
        .slice(0, maxCards)
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean),
      limit
    )
    .catch(() => []);
}

async function openReturnOptionExpansionStage(page, context, targetCardTestId) {
  const previousUrl = page.url();
  const previousSignatures = await readVisibleCardSignatureList(page, 4);
  const popupPromise = context.waitForEvent("page", { timeout: 4_000 }).catch(() => null);
  await page
    .locator(`[data-testid="${targetCardTestId}"] [data-testid="u_select_btn"]`)
    .first()
    .click();
  const popupPage = await popupPromise;
  const activePage = popupPage ?? page;

  if (popupPage) {
    await popupPage.waitForLoadState("domcontentloaded").catch(() => {});
  }

  const deadline = Date.now() + 20_000;
  let lastObservationAt = 0;

  while (Date.now() < deadline) {
    const currentUrl = activePage.url();
    const currentSignatures = await readVisibleCardSignatureList(activePage, 4);
    const signaturesChanged =
      JSON.stringify(currentSignatures) !== JSON.stringify(previousSignatures);
    const urlChanged = currentUrl !== previousUrl || Boolean(popupPage);

    if (currentSignatures.length > 0 && (signaturesChanged || urlChanged)) {
      await activePage.waitForTimeout(2_000);
      return {
        activePage,
        currentUrl,
        openedPopup: Boolean(popupPage)
      };
    }

    if (Date.now() - lastObservationAt >= 4_000) {
      const observation = await collectConnectionObservation(activePage, context);
      lastObservationAt = Date.now();

      if (isBlockedState(observation)) {
        throw new Error(observation.classification.detail);
      }

      const noResults = detectNoResultsState({
        bodyText: observation.bodyText,
        title: observation.title,
        url: observation.tripcomUrl
      });

      if (noResults) {
        return {
          activePage,
          currentUrl,
          noResults,
          openedPopup: Boolean(popupPage)
        };
      }
    }

    await activePage.waitForTimeout(500);
  }

  return {
    activePage,
    currentUrl: activePage.url(),
    openedPopup: Boolean(popupPage)
  };
}

function getCitySearchTerms(cityCode) {
  const city = cityCatalog.find((entry) => entry.code === cityCode);
  const terms = new Set();

  if (city?.displayName) {
    terms.add(city.displayName.toLowerCase());
  }

  for (const alias of city?.aliases ?? []) {
    if (alias && alias.length >= 3) {
      terms.add(alias.toLowerCase());
    }
  }

  if (String(cityCode).length >= 3) {
    terms.add(String(cityCode).toLowerCase());
  }

  return [...terms];
}

function cardMatchesStopoverCity(card, cityCode) {
  const haystack = [
    card?.accessibilitySummary ?? "",
    card?.airline ?? "",
    card?.operatingAirline ?? "",
    card?.rawText ?? "",
    card?.stopText ?? "",
    card?.priceText ?? ""
  ]
    .join(" ")
    .toLowerCase();
  const searchTerms = getCitySearchTerms(cityCode);

  return searchTerms.some((term) => haystack.includes(term));
}

function rankStopoverCardsByDuration(cards, minimumStopDurationMinutes) {
  const minimumMinutes = Math.max(0, Number(minimumStopDurationMinutes ?? 0));

  if (minimumMinutes <= 0) {
    return cards;
  }

  return [...cards].sort((left, right) => {
    const leftDuration = parseStopoverDurationMinutes(left?.stopText);
    const rightDuration = parseStopoverDurationMinutes(right?.stopText);
    const leftQualifies = leftDuration >= minimumMinutes ? 1 : 0;
    const rightQualifies = rightDuration >= minimumMinutes ? 1 : 0;

    if (rightQualifies !== leftQualifies) {
      return rightQualifies - leftQualifies;
    }

    if (rightDuration !== leftDuration) {
      return rightDuration - leftDuration;
    }

    const leftPrice = Number.isFinite(left?.priceAmount) ? left.priceAmount : Number.POSITIVE_INFINITY;
    const rightPrice = Number.isFinite(right?.priceAmount) ? right.priceAmount : Number.POSITIVE_INFINITY;

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return (left?.cardIndex ?? Number.MAX_SAFE_INTEGER) - (right?.cardIndex ?? Number.MAX_SAFE_INTEGER);
  });
}

async function parseStopoverMatchingCards(page, stageName, cityCode, limit, runRow) {
  const { cards, rejectedCardCount, rejectionCounts, scannedCards } = await parseEligibleVisibleCards(
    page,
    stageName,
    limit,
    runRow
  );
  const matchingCards = cards.filter((card) => cardMatchesStopoverCity(card, cityCode));

  return {
    matchingCards,
    scannedCards: cards,
    rejectedCardCount,
    rejectionCounts,
    visibleCards: scannedCards,
    searchTerms: getCitySearchTerms(cityCode)
  };
}

function findCardByRank(cards, rank) {
  return cards[rank] ?? null;
}

async function loadSortedOutboundCardsForQuery(
  db,
  queryPage,
  resultUrl,
  context,
  runDir,
  queryDirPrefix,
  artifactRecords,
  runRow,
  queryInput
) {
  const historicalPairEvidence = getHistoricalDatePairEvidence(
    db,
    runRow.session_id,
    queryInput.departDate,
    queryInput.returnDate
  );
  let outboundStage = null;
  let suspiciousEmptyRetryCount = 0;

  for (let attempt = 0; attempt <= suspiciousEmptyResultRetryLimit; attempt += 1) {
    if (attempt > 0) {
      await tryAppendStageArtifacts(
        queryPage,
        runDir,
        `${queryDirPrefix}-outbound-empty-before-retry-${attempt}`,
        `Trip.com outbound empty-state before retry ${attempt}`,
        artifactRecords
      );
      await queryPage.goto("https://au.trip.com/flights/", {
        timeout: timeoutMs,
        waitUntil: "domcontentloaded"
      });
      await queryPage.waitForTimeout(2_000);
    }

    await queryPage.goto(resultUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });

    outboundStage = await waitForTripcomResultStage(
      queryPage,
      context,
      "outbound",
      /showfarefirst/i,
      null
    );

    if (outboundStage.kind === "explore_top_list") {
      await appendStageArtifacts(
        queryPage,
        runDir,
        `${queryDirPrefix}-explore-top-list`,
        "Trip.com explore landing",
        artifactRecords
      );
      await openExploreTopListResult(queryPage);
      outboundStage = await waitForTripcomResultStage(queryPage, context, "outbound", /showfarefirst/i, null);
    }

    const shouldRetrySuspiciousEmpty =
      outboundStage.kind === "no_results" &&
      attempt < suspiciousEmptyResultRetryLimit &&
      Number(historicalPairEvidence.candidateCount ?? 0) > 0;

    if (!shouldRetrySuspiciousEmpty) {
      break;
    }

    suspiciousEmptyRetryCount += 1;
  }

  if (
    outboundStage?.kind === "no_results" &&
    suspiciousEmptyRetryCount > 0 &&
    Number(historicalPairEvidence.candidateCount ?? 0) > 0
  ) {
    outboundStage = {
      ...outboundStage,
      detail: `${outboundStage.detail} Trip.com previously returned ${historicalPairEvidence.candidateCount} candidate${historicalPairEvidence.candidateCount === 1 ? "" : "s"} for this exact date pair, so the worker refreshed and retried ${suspiciousEmptyRetryCount} time${suspiciousEmptyRetryCount === 1 ? "" : "s"} before accepting the empty state.`,
      historicalPairCandidateCount: historicalPairEvidence.candidateCount,
      historicalPairCheapestPrice: historicalPairEvidence.cheapestPrice,
      suspiciousEmptyRetryCount
    };
  }

  await queryPage.waitForTimeout(3_000);
  await appendStageArtifacts(
    queryPage,
    runDir,
    `${queryDirPrefix}-outbound-results`,
    "Outbound Trip.com results",
    artifactRecords
  );

  await sortResultStageByCheapest(queryPage);
  const stopoverFilterOptions = await parseStopoverFilterOptions(queryPage);
  const {
    cards: outboundCards,
    rejectedCardCount: rejectedOutboundCardCount,
    rejectionCounts: outboundConstraintRejections,
    scannedCards: visibleOutboundCards
  } = await parseEligibleVisibleCards(
    queryPage,
    "outbound_results",
    directCardScanLimit,
    runRow
  );
  const observedStopovers = buildObservedStopoversForQuery(
    runRow,
    stopoverFilterOptions,
    outboundCards
  );

  return {
    historicalPairEvidence,
    observedStopovers,
    outboundCards,
    outboundConstraintRejections,
    outboundStage,
    rejectedOutboundCardCount,
    suspiciousEmptyRetryCount,
    visibleOutboundCardCount: visibleOutboundCards.length
  };
}

async function selectOutboundBranchAndParseReturns({
  context,
  queryDirPrefix,
  outboundRank,
  queryInput,
  queryPage,
  resultUrl,
  runRow,
  runDir,
  artifactRecords
}) {
  if (outboundRank > 0) {
    await queryPage.goto(resultUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });
    let outboundStage = await waitForTripcomResultStage(queryPage, context, "outbound", /showfarefirst/i, null);

    if (outboundStage.kind === "explore_top_list") {
      await appendStageArtifacts(
        queryPage,
        runDir,
        `${queryDirPrefix}-explore-top-list-branch-${String(outboundRank + 1).padStart(2, "0")}`,
        `Trip.com explore landing for outbound branch ${outboundRank + 1}`,
        artifactRecords
      );
      await openExploreTopListResult(queryPage);
      outboundStage = await waitForTripcomResultStage(queryPage, context, "outbound", /showfarefirst/i, null);
    }

    await queryPage.waitForTimeout(2_000);
    await sortResultStageByCheapest(queryPage);
  }

  const { cards: branchOutboundCards } = await parseEligibleVisibleCards(
    queryPage,
    "outbound_results",
    directCardScanLimit,
    runRow
  );
  const outboundSelection = selectDistinctCardsByPrice(
    branchOutboundCards,
    outboundRank + 1,
    queryInput
  );
  const selectedOutbound = outboundSelection.selectedCards[outboundRank] ?? null;

  if (!selectedOutbound) {
    throw new Error(`No outbound Trip.com card was available for outbound branch ${outboundRank + 1}.`);
  }

  const outboundCardSignature = await readFirstCardSignature(queryPage);
  await queryPage
    .locator(`[data-testid="${selectedOutbound.testId}"] [data-testid="u_select_btn"]`)
    .first()
    .click();
  await waitForTripcomResultStage(queryPage, context, "return", /showfarenext/i, outboundCardSignature);
  await queryPage.waitForTimeout(2_000);
  await sortResultStageByCheapest(queryPage);

  return {
    branchOutboundCards,
    outboundSelection,
    selectedOutbound,
    tripcomResumeUrl: queryPage.url()
  };
}

async function sortResultStageByCheapest(page) {
  const cheapestTab = page.locator('[data-testid="sort_type_item_2"]').first();

  if (!(await cheapestTab.isVisible().catch(() => false))) {
    return false;
  }

  const alreadySelected = await cheapestTab.getAttribute("aria-selected").catch(() => null);
  if (alreadySelected === "true") {
    return true;
  }

  const previousSignature = await readFirstCardSignature(page);
  await cheapestTab.click({ force: true }).catch(async () => {
    await cheapestTab.evaluate((node) => {
      if (node instanceof HTMLElement) {
        node.click();
      }
    });
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const selected = await cheapestTab.getAttribute("aria-selected").catch(() => null);
    const currentSignature = await readFirstCardSignature(page);

    if (selected === "true" && currentSignature && currentSignature !== previousSignature) {
      await page.waitForTimeout(2_000);
      return true;
    }

    if (selected === "true" && currentSignature) {
      await page.waitForTimeout(2_000);
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

async function createCandidatesFromCurrentResults({
  db,
  destinationCityCodeOverride,
  minimumCandidateStopDurationMinutes,
  outboundBranchRank,
  page,
  queryExecutionId,
  riskNotesOverride,
  runId,
  runRow,
  selectedOutbound,
  returnCards,
  strategy,
  tripcomResumeUrl,
  stopoverCityCode
}) {
  const resultUrl = new URL(page.url());
  const resolvedDepartDate = resultUrl.searchParams.get("ddate") ?? runRow.departure_start_date;
  const resolvedReturnDate =
    resultUrl.searchParams.get("rdate") ??
    addDays(runRow.departure_start_date, Number(runRow.duration_min_days ?? 7));
  const resolvedDestinationCityCode =
    destinationCityCodeOverride ?? resolveCityCode(runRow.outbound_destination_city);
  const resolvedDestinationCityName = resolveCityName(resolvedDestinationCityCode);
  const destinationAirport = resolvedDestinationCityCode;
  const createdCandidates = [];
  const minimumIntentionalStopDays = Math.max(1, Number(runRow.stop_duration_min_days ?? 1));
  const maximumIntentionalStopDays = Math.max(
    minimumIntentionalStopDays,
    Number(runRow.stop_duration_max_days ?? minimumIntentionalStopDays)
  );
  const minimumIntentionalStopMinutes = minimumIntentionalStopDays * 24 * 60;
  const maximumIntentionalStopMinutes = maximumIntentionalStopDays * 24 * 60;
  const minimumCandidateStopMinutes = Math.max(
    0,
    Number(minimumCandidateStopDurationMinutes ?? 0)
  );

  for (const [index, returnCard] of returnCards.entries()) {
    if (!returnCard.priceAmount) {
      continue;
    }

    if (
      !evaluateCardAgainstRunConstraints(selectedOutbound, runRow).include ||
      !evaluateCardAgainstRunConstraints(returnCard, runRow).include
    ) {
      continue;
    }

    const stopCount = Math.max(
      inferStopCount(selectedOutbound.stopText),
      inferStopCount(returnCard.stopText)
    );
    const outboundDepartureAt = `${resolvedDepartDate}T08:00:00.000Z`;
    const returnDepartureAt = `${resolvedReturnDate}T08:00:00.000Z`;
    const outboundStopovers = buildSegmentStopoversFromCard({
      card: selectedOutbound,
      departureAt: outboundDepartureAt,
      fallbackCityCode: stopoverCityCode ?? null,
      maximumIntentionalStopMinutes,
      minimumIntentionalStopMinutes
    });
    const returnStopovers = buildSegmentStopoversFromCard({
      card: returnCard,
      departureAt: returnDepartureAt,
      fallbackCityCode: stopoverCityCode ?? null,
      maximumIntentionalStopMinutes,
      minimumIntentionalStopMinutes
    });
    const stopovers = [...outboundStopovers, ...returnStopovers];
    const primaryStopoverCityCode =
      stopoverCityCode ??
      outboundStopovers[0]?.cityCode ??
      returnStopovers[0]?.cityCode ??
      null;
    const familyId = ensureCandidateFamily(
      db,
      runRow.session_id,
      `${runRow.origin_airport}-${resolvedDestinationCityCode}-${selectedOutbound.airline ?? "tripcom"}-${primaryStopoverCityCode ?? "unfiltered"}-${stopCount}`,
      "single_booking",
      {
        outboundAirline: selectedOutbound.airline,
        returnAirline: returnCard.airline,
        primaryDestinationCityCode: resolvedDestinationCityCode,
        stopPattern: `${selectedOutbound.stopText ?? "direct"} / ${returnCard.stopText ?? "direct"}`,
        stopoverCityCode: primaryStopoverCityCode
      }
    );
    const intentionalStopCount = stopovers.filter((stopover) => stopover.isIntentional).length;
    if (
      minimumCandidateStopMinutes > 0 &&
      !stopovers.some(
        (stopover) => Number(stopover.durationMinutes ?? 0) >= minimumCandidateStopMinutes
      )
    ) {
      continue;
    }

    const candidate = insertCandidateRecord(db, runId, strategy.id, {
      bookingType: "single_booking",
      candidateFamilyId: familyId,
      dedupeKey: `${queryExecutionId}-${selectedOutbound.cardIndex}-${returnCard.cardIndex}`,
      displayedAmount: returnCard.priceAmount,
      intentionalStopCount,
      isCurrentBest: false,
      legs: [
        {
          arrivalAt: addMinutes(outboundDepartureAt, stopCount === 0 ? 560 : 620),
          bookingReferenceGroup: "pkg_1",
          carrierCode: selectedOutbound.airlineCode ?? String(selectedOutbound.airline ?? "TR").slice(0, 2).toUpperCase(),
          destinationAirport,
          departureAt: outboundDepartureAt,
          originAirport: runRow.origin_airport,
          rawLegPayloadJson: selectedOutbound,
          segmentGroup: "outbound"
        },
        {
          arrivalAt: addMinutes(returnDepartureAt, stopCount === 0 ? 560 : 610),
          bookingReferenceGroup: "pkg_1",
          carrierCode: returnCard.airlineCode ?? String(returnCard.airline ?? "TR").slice(0, 2).toUpperCase(),
          destinationAirport: runRow.return_destination_airport,
          departureAt: returnDepartureAt,
          originAirport: destinationAirport,
          rawLegPayloadJson: returnCard,
          segmentGroup: "return"
        }
      ],
      outboundDestinationCity: resolvedDestinationCityName,
      returnOriginCity:
        runRow.return_origin_mode === "fixed_city"
          ? runRow.return_origin_city
          : resolvedDestinationCityName,
      riskNotes:
        riskNotesOverride ??
        (stopoverCityCode
          ? `Trip.com stopover-focused follow-up using ${resolveCityName(stopoverCityCode)} as observed evidence from the direct sweep. Outbound branch ${outboundBranchRank + 1}.`
          : resolvedDestinationCityCode !== resolveCityCode(runRow.outbound_destination_city)
            ? `Trip.com alternate-city round-trip comparison using ${resolvedDestinationCityName}. This is a bounded alternate return-city probe, not a true open-jaw search. Outbound branch ${outboundBranchRank + 1}.`
            : `Trip.com direct round-trip sweep result for ${resolvedDepartDate} to ${resolvedReturnDate}. Outbound branch ${outboundBranchRank + 1}.`),
      stopCount,
      stopovers,
      totalTravelMinutes: stopCount === 0 ? 560 : 880 + index * 35,
      tripcomResumeUrl
    });

    createdCandidates.push(candidate);
  }

  insertQueryCandidateLinks(
    db,
    queryExecutionId,
    createdCandidates.map((candidate) => candidate.id)
  );

  return createdCandidates;
}

function createAnchoredMultiCityCandidates({
  anchoredCityCode,
  db,
  departDate,
  destinationCityCode,
  finalCards,
  queryExecutionId,
  returnDate,
  runId,
  runRow,
  selectedStageOne,
  selectedStageTwo,
  stopoverDepartDate,
  strategy,
  tripcomResumeUrl
}) {
  const createdCandidates = [];
  const resolvedDestinationCityCode = destinationCityCode ?? resolveCityCode(runRow.outbound_destination_city);
  const resolvedDestinationCityName = resolveCityName(resolvedDestinationCityCode);
  const finalReturnAirport = runRow.return_destination_airport;
  const firstLegDepartureAt = `${departDate}T08:00:00.000Z`;
  const secondLegDepartureAt = `${stopoverDepartDate}T08:00:00.000Z`;
  const thirdLegDepartureAt = `${returnDate}T08:00:00.000Z`;
  const firstLegTravelMinutes = parseCardDurationMinutes(selectedStageOne?.duration, 360);
  const secondLegTravelMinutes = parseCardDurationMinutes(selectedStageTwo?.duration, 210);
  const firstLegArrivalAt = addMinutes(firstLegDepartureAt, firstLegTravelMinutes);
  const secondLegArrivalAt = addMinutes(secondLegDepartureAt, secondLegTravelMinutes);
  const minimumIntentionalStopDays = Math.max(0, Number(runRow.stop_duration_min_days ?? 0));
  const maximumIntentionalStopDays = Math.max(
    minimumIntentionalStopDays,
    Number(runRow.stop_duration_max_days ?? minimumIntentionalStopDays)
  );
  const minimumIntentionalStopMinutes = minimumIntentionalStopDays * 24 * 60;
  const maximumIntentionalStopMinutes = maximumIntentionalStopDays * 24 * 60;
  const anchoredStopDurationMinutes = Math.max(
    0,
    Math.round(
      (new Date(secondLegDepartureAt).getTime() - new Date(firstLegArrivalAt).getTime()) / 60_000
    )
  );

  for (const [index, finalCard] of (finalCards ?? []).entries()) {
    if (!Number.isFinite(finalCard?.priceAmount)) {
      continue;
    }

    const thirdLegTravelMinutes = parseCardDurationMinutes(finalCard.duration, 420);
    const thirdLegArrivalAt = addMinutes(thirdLegDepartureAt, thirdLegTravelMinutes);
    const stageOneStopovers = buildSegmentStopoversFromCard({
      card: selectedStageOne,
      departureAt: firstLegDepartureAt,
      fallbackCityCode: null,
      maximumIntentionalStopMinutes,
      minimumIntentionalStopMinutes
    });
    const stageTwoStopovers = buildSegmentStopoversFromCard({
      card: selectedStageTwo,
      departureAt: secondLegDepartureAt,
      fallbackCityCode: null,
      maximumIntentionalStopMinutes,
      minimumIntentionalStopMinutes
    });
    const stageThreeStopovers = buildSegmentStopoversFromCard({
      card: finalCard,
      departureAt: thirdLegDepartureAt,
      fallbackCityCode: null,
      maximumIntentionalStopMinutes,
      minimumIntentionalStopMinutes
    });
    const anchoredStopover = {
      airportCode: anchoredCityCode,
      arrivalAt: firstLegArrivalAt,
      cityCode: anchoredCityCode,
      countryCode: isMainlandChinaCity(anchoredCityCode) ? "CN" : null,
      departureAt: secondLegDepartureAt,
      durationMinutes: anchoredStopDurationMinutes,
      isIntentional:
        anchoredStopDurationMinutes >= minimumIntentionalStopMinutes &&
        anchoredStopDurationMinutes <= maximumIntentionalStopMinutes,
      isMainlandChina: isMainlandChinaCity(anchoredCityCode)
    };
    const stopovers = [
      ...stageOneStopovers,
      anchoredStopover,
      ...stageTwoStopovers,
      ...stageThreeStopovers
    ];
    const intentionalStopCount = stopovers.filter((stopover) => stopover.isIntentional).length;
    const stopCount =
      1 +
      inferStopCount(selectedStageOne?.stopText) +
      inferStopCount(selectedStageTwo?.stopText) +
      inferStopCount(finalCard?.stopText);
    const familyId = ensureCandidateFamily(
      db,
      runRow.session_id,
      [
        "anchored-multi-city",
        runRow.origin_airport,
        anchoredCityCode,
        resolvedDestinationCityCode,
        finalReturnAirport,
        normalizeCardText(selectedStageOne?.airline ?? "tripcom"),
        normalizeCardText(selectedStageTwo?.airline ?? "tripcom"),
        normalizeCardText(finalCard?.airline ?? "tripcom")
      ].join(":"),
      "single_booking",
      {
        multiCityMode: "anchored",
        outboundAirline: selectedStageOne?.airline ?? null,
        returnAirline: finalCard?.airline ?? null,
        middleAirline: selectedStageTwo?.airline ?? null,
        primaryDestinationCityCode: resolvedDestinationCityCode,
        stopPattern: `${selectedStageOne?.stopText ?? "direct"} / ${selectedStageTwo?.stopText ?? "direct"} / ${finalCard?.stopText ?? "direct"}`,
        stopoverCityCode: anchoredCityCode
      },
      "open_jaw"
    );

    const candidate = insertCandidateRecord(db, runId, strategy.id, {
      bookingType: "single_booking",
      candidateFamilyId: familyId,
      dedupeKey: `${queryExecutionId}-${selectedStageOne?.cardIndex ?? 0}-${selectedStageTwo?.cardIndex ?? 0}-${finalCard?.cardIndex ?? index + 1}`,
      displayedAmount: finalCard.priceAmount,
      fareClassSummary: "Economy | true multi-city",
      intentionalStopCount,
      isCurrentBest: false,
      tripShape: "open_jaw",
      legs: [
        {
          arrivalAt: firstLegArrivalAt,
          bookingReferenceGroup: "pkg_1",
          carrierCode:
            selectedStageOne?.airlineCode ??
            String(selectedStageOne?.airline ?? "TR").slice(0, 2).toUpperCase(),
          destinationAirport: anchoredCityCode,
          departureAt: firstLegDepartureAt,
          originAirport: runRow.origin_airport,
          rawLegPayloadJson: selectedStageOne,
          segmentGroup: "outbound"
        },
        {
          arrivalAt: secondLegArrivalAt,
          bookingReferenceGroup: "pkg_1",
          carrierCode:
            selectedStageTwo?.airlineCode ??
            String(selectedStageTwo?.airline ?? "TR").slice(0, 2).toUpperCase(),
          destinationAirport: resolvedDestinationCityCode,
          departureAt: secondLegDepartureAt,
          originAirport: anchoredCityCode,
          rawLegPayloadJson: selectedStageTwo,
          segmentGroup: "outbound"
        },
        {
          arrivalAt: thirdLegArrivalAt,
          bookingReferenceGroup: "pkg_1",
          carrierCode:
            finalCard?.airlineCode ??
            String(finalCard?.airline ?? "TR").slice(0, 2).toUpperCase(),
          destinationAirport: finalReturnAirport,
          departureAt: thirdLegDepartureAt,
          originAirport: resolvedDestinationCityCode,
          rawLegPayloadJson: finalCard,
          segmentGroup: "return"
        }
      ],
      outboundDestinationCity: resolvedDestinationCityName,
      returnOriginCity:
        runRow.return_origin_mode === "fixed_city"
          ? runRow.return_origin_city
          : resolvedDestinationCityName,
      riskNotes: `Trip.com true multi-city result anchored on ${resolveCityName(anchoredCityCode)}. Dates ${departDate} -> ${stopoverDepartDate} -> ${returnDate}. This preserves the baseline destination while testing a real intentional stopover itinerary.`,
      stopCount,
      stopovers,
      totalTravelMinutes:
        firstLegTravelMinutes +
        anchoredStopDurationMinutes +
        secondLegTravelMinutes +
        thirdLegTravelMinutes +
        stageOneStopovers.reduce((total, stopover) => total + Number(stopover.durationMinutes ?? 0), 0) +
        stageTwoStopovers.reduce((total, stopover) => total + Number(stopover.durationMinutes ?? 0), 0) +
        stageThreeStopovers.reduce((total, stopover) => total + Number(stopover.durationMinutes ?? 0), 0),
      tripcomResumeUrl
    });

    createdCandidates.push(candidate);
  }

  insertQueryCandidateLinks(
    db,
    queryExecutionId,
    createdCandidates.map((candidate) => candidate.id)
  );

  return createdCandidates;
}

async function executeAnchoredMultiCityQuery({
  artifactRecords,
  context,
  db,
  queryExecutionId,
  queryInput,
  queryPriority,
  runDir,
  runId,
  runRow,
  strategy
}) {
  const queryDirPrefix = `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}`;
  const resultUrl = buildTripcomAnchoredMultiCityResultsUrl({
    departDate: queryInput.departDate,
    destinationCityCode: queryInput.destinationCityCode,
    finalReturnAirport: queryInput.finalReturnAirport,
    finalReturnDate: queryInput.returnDate,
    originAirport: runRow.origin_airport,
    stopoverCityCode: queryInput.stopoverCityCode,
    stopoverDepartDate: queryInput.stopoverDepartDate
  });
  const rootPage = await context.newPage();
  let latestUrl = resultUrl;

  try {
    await rootPage.goto(resultUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });
    latestUrl = rootPage.url();
    await waitForTripcomResultStage(rootPage, context, "anchored multi-city stage one", /showfare/i, null);
    await rootPage.waitForTimeout(2_000);
    await sortResultStageByCheapest(rootPage);
    await appendStageArtifacts(
      rootPage,
      runDir,
      `${queryDirPrefix}-anchored-stage-1`,
      "Anchored multi-city stage 1",
      artifactRecords
    );

    const segmentOptionLimit = Math.max(1, Number(queryInput.segmentOptionLimit ?? 1));
    const { cards: stageOneCards } = await parseEligibleVisibleCards(
      rootPage,
      "anchored_multi_city_stage_1",
      directCardScanLimit,
      runRow
    );
    const stageOneSelection =
      stageOneCards.length > 0
        ? selectDistinctCardsByPrice(stageOneCards, segmentOptionLimit, {
            departDate: queryInput.departDate,
            returnDate: queryInput.stopoverDepartDate
          })
        : {
            distinctCardCount: 0,
            duplicateCardCount: 0,
            selectedCards: [],
            selectedGroupCount: 0
          };

    if (stageOneSelection.selectedCards.length === 0) {
      finalizeQuerySummary(
        db,
        queryExecutionId,
        {
          candidateCount: 0,
          departDate: queryInput.departDate,
          reason: "No stage-one multi-city cards were available for this anchored date combination.",
          returnDate: queryInput.returnDate,
          scannedStageOneCardCount: stageOneCards.length,
          selectedStageOneCardCount: 0,
          stopoverCityCode: queryInput.stopoverCityCode,
          stopoverCityName: resolveCityName(queryInput.stopoverCityCode),
          stopoverDepartDate: queryInput.stopoverDepartDate
        },
        [],
        latestUrl
      );
      return [];
    }

    const observedStopoverMap = new Map();
    const createdCandidates = [];
    const combinationSummaries = [];
    let exploredStageTwoBranchCount = 0;
    let exploredFinalBranchCount = 0;

    for (const stageOneTemplate of stageOneSelection.selectedCards) {
      const stageTwoRootPage = await context.newPage();
      let stageTwoPage = stageTwoRootPage;

      try {
        await stageTwoRootPage.goto(resultUrl, {
          timeout: timeoutMs,
          waitUntil: "domcontentloaded"
        });
        await waitForTripcomResultStage(
          stageTwoRootPage,
          context,
          "anchored multi-city stage one replay",
          /showfare/i,
          null
        );
        await stageTwoRootPage.waitForTimeout(2_000);
        await sortResultStageByCheapest(stageTwoRootPage);
        const { cards: replayStageOneCards } = await parseEligibleVisibleCards(
          stageTwoRootPage,
          "anchored_multi_city_stage_1_replay",
          directCardScanLimit,
          runRow
        );
        const selectedStageOne = findMatchingCard(replayStageOneCards, stageOneTemplate, {
          departDate: queryInput.departDate,
          returnDate: queryInput.stopoverDepartDate
        });

        if (!selectedStageOne?.testId) {
          continue;
        }

        const stageTwoTransition = await openReturnOptionExpansionStage(
          stageTwoRootPage,
          context,
          selectedStageOne.testId
        );
        stageTwoPage = stageTwoTransition.activePage;
        latestUrl = stageTwoPage.url();
        await sortResultStageByCheapest(stageTwoPage);
        await appendStageArtifacts(
          stageTwoPage,
          runDir,
          `${queryDirPrefix}-anchored-stage-2-${String(exploredStageTwoBranchCount + 1).padStart(2, "0")}`,
          "Anchored multi-city stage 2",
          artifactRecords
        );

        const { cards: stageTwoCards } = await parseEligibleVisibleCards(
          stageTwoPage,
          "anchored_multi_city_stage_2",
          directCardScanLimit,
          runRow
        );
        const stageTwoSelection =
          stageTwoCards.length > 0
            ? selectDistinctCardsByPrice(stageTwoCards, segmentOptionLimit, {
                departDate: queryInput.stopoverDepartDate,
                returnDate: queryInput.returnDate
              })
            : {
                distinctCardCount: 0,
                duplicateCardCount: 0,
                selectedCards: [],
                selectedGroupCount: 0
              };

        exploredStageTwoBranchCount += 1;

        for (const stageTwoTemplate of stageTwoSelection.selectedCards) {
          const finalRootPage = await context.newPage();
          let finalPage = finalRootPage;

          try {
            await finalRootPage.goto(resultUrl, {
              timeout: timeoutMs,
              waitUntil: "domcontentloaded"
            });
            await waitForTripcomResultStage(
              finalRootPage,
              context,
              "anchored multi-city stage one final replay",
              /showfare/i,
              null
            );
            await finalRootPage.waitForTimeout(2_000);
            await sortResultStageByCheapest(finalRootPage);
            const { cards: finalReplayStageOneCards } = await parseEligibleVisibleCards(
              finalRootPage,
              "anchored_multi_city_stage_1_final_replay",
              directCardScanLimit,
              runRow
            );
            const finalStageOne = findMatchingCard(finalReplayStageOneCards, selectedStageOne, {
              departDate: queryInput.departDate,
              returnDate: queryInput.stopoverDepartDate
            });

            if (!finalStageOne?.testId) {
              continue;
            }

            const replayStageTwoTransition = await openReturnOptionExpansionStage(
              finalRootPage,
              context,
              finalStageOne.testId
            );
            finalPage = replayStageTwoTransition.activePage;
            await sortResultStageByCheapest(finalPage);
            const { cards: replayStageTwoCards } = await parseEligibleVisibleCards(
              finalPage,
              "anchored_multi_city_stage_2_final_replay",
              directCardScanLimit,
              runRow
            );
            const finalStageTwo = findMatchingCard(replayStageTwoCards, stageTwoTemplate, {
              departDate: queryInput.stopoverDepartDate,
              returnDate: queryInput.returnDate
            });

            if (!finalStageTwo?.testId) {
              continue;
            }

            const stageThreeTransition = await openReturnOptionExpansionStage(
              finalPage,
              context,
              finalStageTwo.testId
            );
            finalPage = stageThreeTransition.activePage;
            latestUrl = finalPage.url();
            await sortResultStageByCheapest(finalPage);
            await appendStageArtifacts(
              finalPage,
              runDir,
              `${queryDirPrefix}-anchored-stage-3-${String(exploredFinalBranchCount + 1).padStart(2, "0")}`,
              "Anchored multi-city stage 3",
              artifactRecords
            );

            const { cards: finalCards } = await parseEligibleVisibleCards(
              finalPage,
              "anchored_multi_city_stage_3",
              returnCardScanLimit,
              runRow
            );
            const finalSelection =
              finalCards.length > 0
                ? selectDistinctCardsByPrice(finalCards, segmentOptionLimit, {
                    departDate: queryInput.stopoverDepartDate,
                    returnDate: queryInput.returnDate
                  })
                : {
                    distinctCardCount: 0,
                    duplicateCardCount: 0,
                    selectedCards: [],
                    selectedGroupCount: 0
                  };
            const selectedFinalCards = finalSelection.selectedCards;

            mergeObservedStopoverEvidence(
              observedStopoverMap,
              buildAnchoredMultiCityObservedStopovers({
                anchoredCityCode: queryInput.stopoverCityCode,
                finalPriceAmount:
                  selectedFinalCards[0]?.priceAmount ?? stageTwoTemplate.priceAmount ?? stageOneTemplate.priceAmount,
                stageCards: [finalStageOne, finalStageTwo, ...selectedFinalCards]
              })
            );

            const branchCandidates = createAnchoredMultiCityCandidates({
              anchoredCityCode: queryInput.stopoverCityCode,
              db,
              departDate: queryInput.departDate,
              destinationCityCode: queryInput.destinationCityCode,
              finalCards: selectedFinalCards,
              queryExecutionId,
              returnDate: queryInput.returnDate,
              runId,
              runRow,
              selectedStageOne: finalStageOne,
              selectedStageTwo: finalStageTwo,
              stopoverDepartDate: queryInput.stopoverDepartDate,
              strategy,
              tripcomResumeUrl: finalPage.url()
            });

            createdCandidates.push(...branchCandidates);
            combinationSummaries.push({
              candidateCount: branchCandidates.length,
              cheapestPrice:
                branchCandidates.length > 0
                  ? Math.min(...branchCandidates.map((candidate) => candidate.displayedAmount))
                  : null,
              finalCardCount: selectedFinalCards.length,
              outboundAirline: finalStageOne.airline ?? null,
              returnAirline: finalCards[0]?.airline ?? null,
              stageTwoAirline: finalStageTwo.airline ?? null
            });
            exploredFinalBranchCount += 1;
          } finally {
            if (finalPage !== finalRootPage) {
              await finalPage.close().catch(() => {});
            }
            await finalRootPage.close().catch(() => {});
          }
        }
      } finally {
        if (stageTwoPage !== stageTwoRootPage) {
          await stageTwoPage.close().catch(() => {});
        }
        await stageTwoRootPage.close().catch(() => {});
      }
    }

    finalizeQuerySummary(
      db,
      queryExecutionId,
      {
        candidateCount: createdCandidates.length,
        cheapestPrice:
          createdCandidates.length > 0
            ? Math.min(...createdCandidates.map((candidate) => candidate.displayedAmount))
            : null,
        combinationSummaries: combinationSummaries.slice(0, 6),
        departDate: queryInput.departDate,
        exploredFinalBranchCount,
        exploredStageTwoBranchCount,
        queriedStopWindowDays: getDateDistanceDays(queryInput.departDate, queryInput.stopoverDepartDate),
        returnDate: queryInput.returnDate,
        scannedStageOneCardCount: stageOneCards.length,
        selectedStageOneCardCount: stageOneSelection.selectedCards.length,
        stopoverCityCode: queryInput.stopoverCityCode,
        stopoverCityName: resolveCityName(queryInput.stopoverCityCode),
        stopoverDepartDate: queryInput.stopoverDepartDate
      },
      finalizeObservedStopoverEvidence(observedStopoverMap),
      latestUrl
    );

    return createdCandidates;
  } finally {
    await rootPage.close().catch(() => {});
  }
}

async function executeDirectQuery({
  artifactRecords,
  db,
  context,
  queryExecutionId,
  queryInput,
  queryPriority,
  runDir,
  runId,
  runRow,
  strategy
}) {
  const queryDirPrefix = `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}`;
  const resultUrl = buildTripcomDirectResultsUrl({
    departDate: queryInput.departDate,
    destinationCityCode: queryInput.destinationCityCode,
    originAirport: runRow.origin_airport,
    returnDate: queryInput.returnDate
  });
  const queryPage = await context.newPage();

  try {
    const directPayload = parseStrategyPayload(strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}");
    const maxOutboundOptionsPerQuery = Math.max(
      1,
      Number(directPayload.maxOutboundOptionsPerQuery ?? 3)
    );
    const maxReturnOptionsPerOutbound = Math.max(
      1,
      Number(directPayload.maxReturnOptionsPerOutbound ?? 3)
    );
    const {
      historicalPairEvidence,
      observedStopovers,
      outboundCards,
      outboundConstraintRejections,
      outboundStage
      ,
      rejectedOutboundCardCount,
      suspiciousEmptyRetryCount,
      visibleOutboundCardCount
    } = await loadSortedOutboundCardsForQuery(
      db,
      queryPage,
      resultUrl,
      context,
      runDir,
      queryDirPrefix,
      artifactRecords,
      runRow,
      queryInput
    );

    if (outboundCards.length === 0) {
      const rejectedAllVisibleCards =
        visibleOutboundCardCount > 0 && rejectedOutboundCardCount >= visibleOutboundCardCount;
      const summary = {
        candidateCount: 0,
        constraintFilters: buildRunCardConstraintSummary(runRow),
        departDate: queryInput.departDate,
        reason:
          outboundStage.kind === "no_results"
            ? outboundStage.detail
            : rejectedAllVisibleCards
              ? `No outbound Trip.com cards matched the session filters (${summarizeCardConstraintRejections({
                  rejectionCounts: outboundConstraintRejections
                })}) for ${queryInput.departDate} to ${queryInput.returnDate}.`
              : `No outbound Trip.com cards were parsed for ${queryInput.departDate} to ${queryInput.returnDate}.`,
        returnDate: queryInput.returnDate,
        eligibleOutboundCardCount: outboundCards.length,
        rejectedOutboundCardCount,
        scannedOutboundCardCount: visibleOutboundCardCount,
        stopoverCityCount: observedStopovers.length
      };
      finalizeQuerySummary(db, queryExecutionId, summary, observedStopovers, outboundStage.lastUrl);
      return {
        createdCandidates: [],
        observedStopovers,
        outboundStage,
        outboundResultUrl: outboundStage.lastUrl
      };
    }
    const outboundSelection = selectDistinctCardsByPrice(
      outboundCards,
      maxOutboundOptionsPerQuery,
      queryInput
    );
    const outboundBranches = outboundSelection.selectedCards;
    const createdCandidates = [];
    const branchSummaries = [];
    let totalReturnCardsScanned = 0;
    let totalDistinctReturnCards = 0;
    let totalDuplicateReturnCards = 0;

    for (const [_branchCandidate, outboundRank] of outboundBranches.map((value, index) => [value, index])) {
      const {
        branchOutboundCards,
        outboundSelection: branchOutboundSelection,
        selectedOutbound,
        tripcomResumeUrl
      } = await selectOutboundBranchAndParseReturns({
        artifactRecords,
        context,
        outboundRank,
        queryInput,
        queryPage,
        queryDirPrefix,
        resultUrl,
        runRow,
        runDir
      });
      await appendStageArtifacts(
        queryPage,
        runDir,
        `${queryDirPrefix}-return-results-branch-${String(outboundRank + 1).padStart(2, "0")}`,
        `Return Trip.com results for outbound branch ${outboundRank + 1}`,
        artifactRecords
      );
      const {
        cards: returnCards,
        scannedCards: visibleReturnCards
      } = await parseEligibleVisibleCards(
        queryPage,
        "return_results",
        returnCardScanLimit,
        runRow
      );
      const returnSelection = selectDistinctCardsByPrice(
        returnCards,
        maxReturnOptionsPerOutbound,
        queryInput
      );
      const selectedReturnCards = returnSelection.selectedCards;

      totalReturnCardsScanned += visibleReturnCards.length;
      totalDistinctReturnCards += returnSelection.distinctCardCount;
      totalDuplicateReturnCards += returnSelection.duplicateCardCount;

      if (selectedReturnCards.length === 0) {
        branchSummaries.push({
          branchRank: outboundRank + 1,
          distinctOutboundCardCount: branchOutboundSelection.distinctCardCount,
          duplicateOutboundCardCount: branchOutboundSelection.duplicateCardCount,
          distinctReturnCardCount: returnSelection.distinctCardCount,
          duplicateReturnCardCount: returnSelection.duplicateCardCount,
          returnCardCount: 0,
          selectedOutboundPrice: selectedOutbound.priceAmount ?? null
        });
        continue;
      }

      const branchCandidates = await createCandidatesFromCurrentResults({
        db,
        destinationCityCodeOverride: queryInput.destinationCityCode ?? null,
        minimumCandidateStopDurationMinutes: 0,
        outboundBranchRank: outboundRank,
        page: queryPage,
        queryExecutionId,
        runId,
        runRow,
        selectedOutbound,
        returnCards: selectedReturnCards,
        strategy,
        tripcomResumeUrl,
        stopoverCityCode: null
      });
      createdCandidates.push(...branchCandidates);
      branchSummaries.push({
        branchRank: outboundRank + 1,
        distinctOutboundCardCount: branchOutboundSelection.distinctCardCount,
        duplicateOutboundCardCount: branchOutboundSelection.duplicateCardCount,
        distinctReturnCardCount: returnSelection.distinctCardCount,
        duplicateReturnCardCount: returnSelection.duplicateCardCount,
        returnCardCount: selectedReturnCards.length,
        selectedOutboundPrice: selectedOutbound.priceAmount ?? null,
        selectedOutboundAirline: selectedOutbound.airline ?? null,
        selectedOutboundStopText: selectedOutbound.stopText ?? null
      });
    }

    if (createdCandidates.length === 0) {
      const summary = {
        candidateCount: 0,
        departDate: queryInput.departDate,
        distinctOutboundCardCount: outboundSelection.distinctCardCount,
        duplicateOutboundCardCount: outboundSelection.duplicateCardCount,
        exploredOutboundBranchCount: outboundBranches.length,
        exploredReturnOptionsPerOutbound: maxReturnOptionsPerOutbound,
        outboundBranchSummaries: branchSummaries,
        reason: `Trip.com results had no displayable price for ${queryInput.departDate} to ${queryInput.returnDate}.`,
        returnDate: queryInput.returnDate,
        eligibleOutboundCardCount: outboundCards.length,
        scannedOutboundCardCount: visibleOutboundCardCount,
        scannedReturnCardCount: totalReturnCardsScanned,
        stopoverCityCount: observedStopovers.length
      };
      finalizeQuerySummary(db, queryExecutionId, summary, observedStopovers, outboundStage.lastUrl);
      return {
        createdCandidates: [],
        observedStopovers,
        outboundStage: {
          ...outboundStage,
          historicalPairCandidateCount: Number(historicalPairEvidence?.candidateCount ?? 0),
          suspiciousEmptyRetryCount
        },
        outboundResultUrl: outboundStage.lastUrl
      };
    }

    const summary = {
      candidateCount: createdCandidates.length,
      cheapestPrice: Math.min(...createdCandidates.map((candidate) => candidate.displayedAmount)),
      departDate: queryInput.departDate,
      distinctOutboundCardCount: outboundSelection.distinctCardCount,
      duplicateOutboundCardCount: outboundSelection.duplicateCardCount,
      distinctGroupingRule:
        "same price + same airline + same stopover location + same date window + similar schedule bucket",
      constraintFilters: buildRunCardConstraintSummary(runRow),
      eligibleOutboundCardCount: outboundCards.length,
      scannedOutboundCardCount: visibleOutboundCardCount,
      scannedReturnCardCount: totalReturnCardsScanned,
      distinctReturnCardCount: totalDistinctReturnCards,
      duplicateReturnCardCount: totalDuplicateReturnCards,
      exploredOutboundBranchCount: outboundBranches.length,
      exploredReturnOptionsPerOutbound: maxReturnOptionsPerOutbound,
      outboundBranchSummaries: branchSummaries,
      returnDate: queryInput.returnDate,
      selectionMethod: "scan_broad_then_pick_cheapest_distinct_cards",
      stopoverCityCount: observedStopovers.length
    };
    finalizeQuerySummary(db, queryExecutionId, summary, observedStopovers, outboundStage.lastUrl);

    return {
      createdCandidates,
      observedStopovers,
      outboundStage: {
        ...outboundStage,
        historicalPairCandidateCount: Number(historicalPairEvidence?.candidateCount ?? 0),
        suspiciousEmptyRetryCount
      },
      outboundResultUrl: outboundStage.lastUrl
    };
  } finally {
    await queryPage.close().catch(() => {});
  }
}

async function executeReturnOptionExpansionQuery({
  artifactRecords,
  db,
  context,
  queryExecutionId,
  queryInput,
  queryPriority,
  runDir,
  runId,
  runRow,
  strategy
}) {
  const queryPage = await context.newPage();
  let activePage = queryPage;

  try {
    const expansionPayload = parseStrategyPayload(
      strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
    );
    const expansionVariationLimit = Math.max(
      1,
      Number(expansionPayload.expansionVariationLimit ?? 3)
    );

    await queryPage.goto(queryInput.baseResultUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });
    const sourceStage = await waitForTripcomResultStage(queryPage, context, "return", /showfarenext/i, null);
    await queryPage.waitForTimeout(2_000);
    await sortResultStageByCheapest(queryPage);
    await appendStageArtifacts(
      queryPage,
      runDir,
      `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}-return-expansion-source`,
      "Baseline return-option expansion source results",
      artifactRecords
    );

      const { cards: visibleReturnCards } = await parseEligibleVisibleCards(
        queryPage,
        "return_option_source",
        returnCardScanLimit,
        runRow
      );

    if (visibleReturnCards.length === 0) {
      const summary = {
        candidateCount: 0,
        candidateFamilyKey: queryInput.sourceCandidateFamilyKey,
        expansionAvailable: false,
        reason:
          sourceStage.kind === "no_results"
            ? sourceStage.detail
            : "Trip.com did not show any return cards for the return-option expansion source stage.",
        returnDate: queryInput.returnDate,
        sourceCandidateId: queryInput.sourceCandidateId,
        sourceCandidatePrice: queryInput.sourceCandidatePrice ?? null,
        sourceReturnCardCount: 0
      };
      finalizeQuerySummary(db, queryExecutionId, summary, [], sourceStage.lastUrl ?? queryInput.baseResultUrl);
      return {
        createdCandidates: [],
        observedStopovers: []
      };
    }

    const targetReturnCard = findMatchingCard(visibleReturnCards, queryInput.sourceReturnCard, {
      departDate: queryInput.departDate,
      returnDate: queryInput.returnDate
    });

    if (!targetReturnCard?.testId) {
      const summary = {
        candidateCount: 0,
        candidateFamilyKey: queryInput.sourceCandidateFamilyKey,
        expansionAvailable: false,
        returnDate: queryInput.returnDate,
        sourceCandidateId: queryInput.sourceCandidateId,
        sourceCandidatePrice: queryInput.sourceCandidatePrice ?? null,
        sourceReturnCardCount: visibleReturnCards.length
      };
      finalizeQuerySummary(db, queryExecutionId, summary, [], queryInput.baseResultUrl);
      return {
        createdCandidates: [],
        observedStopovers: []
      };
    }

    const sourceCardFingerprints = visibleReturnCards
      .slice(0, 6)
      .map((card) =>
        buildCardSelectionGroupKey(card, {
          departDate: queryInput.departDate,
          returnDate: queryInput.returnDate
        })
      );
    const expansionStage = await openReturnOptionExpansionStage(queryPage, context, targetReturnCard.testId);
    activePage = expansionStage.activePage;
    await sortResultStageByCheapest(activePage);
    await appendStageArtifacts(
      activePage,
      runDir,
      `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}-return-expansion`,
      "Baseline return-option expansion results",
      artifactRecords
    );

      const { cards: expandedReturnCards } = await parseEligibleVisibleCards(
        activePage,
        "return_option_expansion",
        expandedReturnCardScanLimit,
        runRow
      );
    const expandedFingerprints = expandedReturnCards
      .slice(0, 6)
      .map((card) =>
        buildCardSelectionGroupKey(card, {
          departDate: queryInput.departDate,
          returnDate: queryInput.returnDate
        })
      );
    const stageChanged =
      expansionStage.currentUrl !== queryInput.baseResultUrl ||
      expansionStage.openedPopup ||
      JSON.stringify(sourceCardFingerprints) !== JSON.stringify(expandedFingerprints);
    const expansionSelection = stageChanged
      ? selectDistinctCardsByPrice(
          expandedReturnCards,
          expansionVariationLimit,
          {
            departDate: queryInput.departDate,
            returnDate: queryInput.returnDate
          }
        )
      : {
          distinctCardCount: 0,
          duplicateCardCount: 0,
          selectedCards: [],
          selectedGroupCount: 0
        };
    const selectedExpandedCards = expansionSelection.selectedCards;
    const observedStopovers = buildObservedStopoversFromCards(selectedExpandedCards);
    const createdCandidates =
      selectedExpandedCards.length > 0
        ? await createCandidatesFromCurrentResults({
            db,
            destinationCityCodeOverride: queryInput.destinationCityCode ?? null,
            minimumCandidateStopDurationMinutes: 0,
            outboundBranchRank: 0,
            page: activePage,
            queryExecutionId,
            riskNotesOverride:
              `Trip.com return-option expansion after the baseline selected a cheap round-trip candidate from family ${queryInput.sourceCandidateFamilyKey}. This pass opens deeper return choices to expose recurring stopover cities and alternate return variants for ${queryInput.departDate} to ${queryInput.returnDate}.`,
            runId,
            runRow,
            selectedOutbound: queryInput.sourceOutboundCard,
            returnCards: selectedExpandedCards,
            strategy,
            tripcomResumeUrl: activePage.url(),
            stopoverCityCode: null
          })
        : [];
    const summary = {
      candidateCount: createdCandidates.length,
      candidateFamilyKey: queryInput.sourceCandidateFamilyKey,
      cheapestPrice:
        createdCandidates.length > 0
          ? Math.min(...createdCandidates.map((candidate) => candidate.displayedAmount))
          : null,
      departDate: queryInput.departDate,
      distinctExpandedReturnCardCount: expansionSelection.distinctCardCount,
      duplicateExpandedReturnCardCount: expansionSelection.duplicateCardCount,
      expansionAvailable: stageChanged,
      observedStopoverCityCount: observedStopovers.length,
      returnDate: queryInput.returnDate,
      scannedExpandedReturnCardCount: expandedReturnCards.length,
      selectedExpandedReturnCardCount: selectedExpandedCards.length,
      selectionPhase: queryInput.selectionPhase ?? "family_coverage",
      sourceCandidateId: queryInput.sourceCandidateId,
      sourceCandidatePrice: queryInput.sourceCandidatePrice ?? null
    };
    finalizeQuerySummary(db, queryExecutionId, summary, observedStopovers, activePage.url());

    return {
      createdCandidates,
      observedStopovers
    };
  } finally {
    if (activePage !== queryPage) {
      await activePage.close().catch(() => {});
    }
    await queryPage.close().catch(() => {});
  }
}

async function executeStopoverFollowupQuery({
  artifactRecords,
  db,
  context,
  minimumStopDurationMinutes,
  queryExecutionId,
  queryPriority,
  queryInput,
  runDir,
  runId,
  runRow,
  strategy
}) {
  const queryPage = await context.newPage();

  try {
    await queryPage.goto(queryInput.baseResultUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });
    const outboundStage = await waitForTripcomResultStage(
      queryPage,
      context,
      "outbound",
      /showfarefirst/i,
      null
    );
    await queryPage.waitForTimeout(2_000);
    await appendStageArtifacts(
      queryPage,
      runDir,
      `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}-stopover-outbound`,
      "Stopover follow-up outbound Trip.com results",
      artifactRecords
    );

    await sortResultStageByCheapest(queryPage);
    const followupPayload = parseStrategyPayload(strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}");
    const maxOutboundOptionsPerQuery = Math.max(
      1,
      Number(followupPayload.maxOutboundOptionsPerQuery ?? 3)
    );
    const maxReturnOptionsPerOutbound = Math.max(
      1,
      Number(followupPayload.maxReturnOptionsPerOutbound ?? 3)
    );
      const outboundScan = await parseStopoverMatchingCards(
        queryPage,
        "stopover_outbound_results",
        queryInput.stopoverCityCode,
        24,
        runRow
      );
    const outboundCards = rankStopoverCardsByDuration(
      outboundScan.matchingCards,
      minimumStopDurationMinutes
    ).slice(0, maxOutboundOptionsPerQuery);

    if (outboundCards.length === 0) {
      const summary = {
        candidateCount: 0,
        matchingOutboundCardCount: 0,
        minimumStopDurationHours:
          minimumStopDurationMinutes > 0 ? Number((minimumStopDurationMinutes / 60).toFixed(1)) : null,
        reason:
          outboundStage.kind === "no_results"
            ? outboundStage.detail
            : minimumStopDurationMinutes > 0
              ? `No outbound Trip.com cards mentioned ${resolveCityName(queryInput.stopoverCityCode)} with at least ${Math.round(minimumStopDurationMinutes / 60)}h stop duration. Scanned ${outboundScan.scannedCards.length} visible cards.`
              : `No outbound Trip.com cards mentioned ${resolveCityName(queryInput.stopoverCityCode)}. Scanned ${outboundScan.scannedCards.length} visible cards.`,
        scannedOutboundCardCount: outboundScan.scannedCards.length,
        searchTerms: outboundScan.searchTerms,
        stopoverCityCode: queryInput.stopoverCityCode,
        stopoverCityName: resolveCityName(queryInput.stopoverCityCode)
      };
      finalizeQuerySummary(db, queryExecutionId, summary, [], queryInput.baseResultUrl);
      return [];
    }
    const createdCandidates = [];
    const branchSummaries = [];
    let totalReturnCardsScanned = 0;
    let latestReturnScanCount = 0;

    for (const [_card, outboundRank] of outboundCards.map((value, index) => [value, index])) {
      if (outboundRank > 0) {
        await queryPage.goto(queryInput.baseResultUrl, {
          timeout: timeoutMs,
          waitUntil: "domcontentloaded"
        });
        await waitForTripcomResultStage(queryPage, context, "outbound", /showfarefirst/i, null);
        await queryPage.waitForTimeout(2_000);
        await sortResultStageByCheapest(queryPage);
      }

        const branchOutboundScan = await parseStopoverMatchingCards(
          queryPage,
          "stopover_outbound_results",
          queryInput.stopoverCityCode,
          24,
          runRow
        );
      const selectedOutbound = findCardByRank(
        rankStopoverCardsByDuration(
          branchOutboundScan.matchingCards,
          minimumStopDurationMinutes
        ),
        outboundRank
      );

      if (!selectedOutbound) {
        continue;
      }

      const outboundCardSignature = await readFirstCardSignature(queryPage);
      await queryPage
        .locator(`[data-testid="${selectedOutbound.testId}"] [data-testid="u_select_btn"]`)
        .first()
        .click();
      await waitForTripcomResultStage(queryPage, context, "return", /showfarenext/i, outboundCardSignature);
      await queryPage.waitForTimeout(2_000);
      await appendStageArtifacts(
        queryPage,
        runDir,
        `query-${String(queryPriority + 1).padStart(2, "0")}-${queryExecutionId}-stopover-return-branch-${String(outboundRank + 1).padStart(2, "0")}`,
        `Stopover follow-up return Trip.com results for outbound branch ${outboundRank + 1}`,
        artifactRecords
      );

      await sortResultStageByCheapest(queryPage);
        const returnScan = await parseStopoverMatchingCards(
          queryPage,
          "stopover_return_results",
          queryInput.stopoverCityCode,
          18,
          runRow
        );
      const returnCards = rankStopoverCardsByDuration(
        returnScan.matchingCards,
        minimumStopDurationMinutes
      ).slice(0, maxReturnOptionsPerOutbound);
      latestReturnScanCount = returnScan.scannedCards.length;
      totalReturnCardsScanned += returnCards.length;

      if (returnCards.length === 0) {
        branchSummaries.push({
          branchRank: outboundRank + 1,
          returnCardCount: 0,
          selectedOutboundPrice: selectedOutbound.priceAmount ?? null
        });
        continue;
      }

      const branchCandidates = await createCandidatesFromCurrentResults({
        db,
        minimumCandidateStopDurationMinutes: minimumStopDurationMinutes,
        outboundBranchRank: outboundRank,
        page: queryPage,
        queryExecutionId,
        runId,
        runRow,
        selectedOutbound,
        returnCards,
        strategy,
        tripcomResumeUrl: queryPage.url(),
        stopoverCityCode: queryInput.stopoverCityCode
      });
      createdCandidates.push(...branchCandidates);
      branchSummaries.push({
        branchRank: outboundRank + 1,
        returnCardCount: returnCards.length,
        selectedOutboundPrice: selectedOutbound.priceAmount ?? null,
        selectedOutboundAirline: selectedOutbound.airline ?? null,
        selectedOutboundStopText: selectedOutbound.stopText ?? null
      });
    }

    if (createdCandidates.length === 0) {
      const summary = {
        candidateCount: 0,
        exploredOutboundBranchCount: outboundCards.length,
        exploredReturnOptionsPerOutbound: maxReturnOptionsPerOutbound,
        matchingOutboundCardCount: outboundCards.length,
        matchingReturnCardCount: totalReturnCardsScanned,
        minimumStopDurationHours:
          minimumStopDurationMinutes > 0 ? Number((minimumStopDurationMinutes / 60).toFixed(1)) : null,
        outboundBranchSummaries: branchSummaries,
        reason:
          minimumStopDurationMinutes > 0
            ? `No Trip.com round-trip candidates kept ${resolveCityName(queryInput.stopoverCityCode)} for at least ${Math.round(minimumStopDurationMinutes / 60)}h across the sampled outbound branches.`
            : `No return Trip.com cards mentioned ${resolveCityName(queryInput.stopoverCityCode)} across the sampled outbound branches.`,
        scannedOutboundCardCount: outboundScan.scannedCards.length,
        scannedReturnCardCount: latestReturnScanCount,
        searchTerms: outboundScan.searchTerms,
        stopoverCityCode: queryInput.stopoverCityCode,
        stopoverCityName: resolveCityName(queryInput.stopoverCityCode)
      };
      finalizeQuerySummary(db, queryExecutionId, summary, [], queryInput.baseResultUrl);
      return [];
    }

    const summary = {
      candidateCount: createdCandidates.length,
      cheapestPrice:
        createdCandidates.length > 0
          ? Math.min(...createdCandidates.map((candidate) => candidate.displayedAmount))
          : null,
      parentQueryExecutionId: queryInput.parentQueryExecutionId,
      scannedOutboundCardCount: outboundScan.scannedCards.length,
      scannedReturnCardCount: latestReturnScanCount,
      matchingOutboundCardCount: outboundCards.length,
      matchingReturnCardCount: totalReturnCardsScanned,
      minimumStopDurationHours:
        minimumStopDurationMinutes > 0 ? Number((minimumStopDurationMinutes / 60).toFixed(1)) : null,
      exploredOutboundBranchCount: outboundCards.length,
      exploredReturnOptionsPerOutbound: maxReturnOptionsPerOutbound,
      outboundBranchSummaries: branchSummaries,
      selectionMethod:
        minimumStopDurationMinutes > 0
          ? "card_stopover_match_with_duration_filter"
          : "card_stopover_match",
      searchTerms: outboundScan.searchTerms,
      stopoverCityCode: queryInput.stopoverCityCode,
      stopoverCityName: resolveCityName(queryInput.stopoverCityCode)
    };
    finalizeQuerySummary(db, queryExecutionId, summary, [], queryInput.baseResultUrl);

    return createdCandidates;
  } finally {
    await queryPage.close().catch(() => {});
  }
}

const paths = ensureFlyEasyPaths();
const runDir = path.join(paths.artifactsDir, "baseline-runs", runId);
fs.mkdirSync(runDir, { recursive: true });

const db = new Database(paths.dbPath, {
  nativeBinding: resolveBetterSqliteBindingPath()
});
db.pragma("foreign_keys = ON");

const runRow = db
  .prepare(
    `select
      r.id,
      r.session_id,
      r.status,
      s.origin_airport,
      s.outbound_destination_city,
      s.return_destination_airport,
      s.return_origin_city,
      s.return_origin_mode,
      s.monitoring_state,
      s.departure_start_date,
      s.departure_end_date,
      s.duration_min_days,
      s.duration_max_days,
      s.require_included_checked_baggage,
      s.restrict_to_chinese_airlines,
      s.stop_duration_min_days,
      s.stop_duration_max_days,
      s.refresh_interval_hours,
      s.return_start_date,
      s.return_end_date,
      s.search_intensity
    from search_run r
    inner join session s on s.id = r.session_id
    where r.id = ?`
  )
  .get(runId);

if (!runRow) {
  db.close();
  throw new Error(`Run ${runId} was not found.`);
}

const strategyRow = db
  .prepare(
    `select id, strategy_payload_json
    from strategy_execution
    where search_run_id = ?
    order by priority asc
    limit 1`
  )
  .get(runId);
const strategies = selectStrategies(db, runId);

if (!strategyRow || strategies.length === 0) {
  db.close();
  throw new Error(`Run ${runId} has no strategy row.`);
}

writeWorkerState({
  activeRunId: runId,
  lastError: null,
  lastHeartbeatAt: nowIso(),
  pid: process.pid,
  startedAt: nowIso(),
  status: "running"
});

db.prepare(
  `update search_run
   set status = 'running', summary_text = ?, recovery_state = ?, failure_reason = null, finished_at = null
   where id = ?`
).run(
  isResume
    ? "Recovery confirmed. Resuming the blocked run from the last safe checkpoint."
    : "Launching Trip.com search strategies.",
  isResume ? "pending" : "not_required",
  runId
);

const browserStateDir = path.join(paths.browserStateDir, "app");
const context = await chromium.launchPersistentContext(browserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? (await context.newPage());

const artifactRecords = [];
const EARLY_EXIT = { earlyExit: true };
let activeStrategy = strategies[0];
let shouldDispatchQueue = false;

try {
  let baseCandidates = [];
  let latestAnalysisSnapshot = null;
  const baselineStrategy = strategies[0];
  activeStrategy = baselineStrategy;
  const baselineExisting = selectStrategyCandidates(db, baselineStrategy.id);

  if (baselineStrategy.status === "completed" && baselineExisting.length > 0) {
    baseCandidates = baselineExisting;
  } else {
    await page.goto("https://au.trip.com/flights/", {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded"
    });

    const connectionObservation = await collectConnectionObservation(page, context);
    writeConnectionState({
      detail: connectionObservation.classification.detail,
      lastCheckedAt: nowIso(),
      lastUrl: connectionObservation.tripcomUrl,
      state: connectionObservation.classification.state,
      updatedBy: "automation"
    });

    if (forceBlocked) {
      await appendStageArtifacts(
        page,
        runDir,
        "blocked-state",
        "Forced blocked-state Trip.com",
        artifactRecords
      );

      markRunBlocked(
        db,
        runRow,
        baselineStrategy.id,
        "Forced blocked-state for recovery verification.",
        {
          blockedStage: "forced_block",
          strategyId: baselineStrategy.id,
          strategyType: baselineStrategy.strategy_type
        },
        artifactRecords
      );
      throw EARLY_EXIT;
    }

    if (isBlockedState(connectionObservation)) {
      await appendStageArtifacts(
        page,
        runDir,
        "blocked-state",
        "Blocked-state Trip.com",
        artifactRecords
      );

      markRunBlocked(
        db,
        runRow,
        baselineStrategy.id,
        connectionObservation.classification.detail,
        {
          blockedStage: "public_search",
          strategyId: baselineStrategy.id,
          strategyType: baselineStrategy.strategy_type
        },
        artifactRecords
      );
      throw EARLY_EXIT;
    }

    updateStrategyStatus(db, baselineStrategy.id, {
      actual_search_cost: 0,
      failure_reason: null,
      finished_at: null,
      started_at: nowIso(),
      status: "running"
    });
    const baselinePayload = parseStrategyPayload(
      baselineStrategy.strategy_payload_json ?? baselineStrategy.strategyPayloadJson ?? "{}"
    );
    const directSweepLimit = Number(baselinePayload.directSweepLimit ?? 3);
    const { allPairs, sampledPairs } = enumerateDatePairs(
      runRow,
      directSweepLimit
    );
    const directPairUniverse = allPairs.length > 0 ? allPairs : sampledPairs;
    const samplingMode =
      baselinePayload.samplingMode === "adaptive_coverage"
        ? "adaptive_coverage"
        : "even_coverage";
    const adaptivePlanner =
      samplingMode === "adaptive_coverage"
        ? createAdaptiveDirectSweepPlanner({
            allPairs: directPairUniverse,
            limit: directSweepLimit,
            runSeed: `${runId}:${baselineStrategy.id}`,
            seedSweepLimit: Math.max(
              1,
              Number(
                baselinePayload.initialSeedSweepLimit ??
                  Math.max(2, Math.ceil(directSweepLimit / 2))
              )
            ),
            sessionSignals: collectHistoricalDatePairSignals(db, runRow.session_id)
          })
        : null;
    const directSweepQueue = adaptivePlanner?.seedPairs ?? sampledPairs;
    const seedSweepQueryCount = adaptivePlanner?.seedPairs?.length ?? directSweepQueue.length;
    const directSweepOutcomes = [];
    let executedDirectSweepCount = 0;
    const maxDirectSweepIterations = adaptivePlanner?.totalLimit ?? directSweepQueue.length;

    for (let queryPriority = 0; queryPriority < maxDirectSweepIterations; queryPriority += 1) {
      if (isRunCancelled(db, runId)) {
        break;
      }

      const pair =
        queryPriority < directSweepQueue.length
          ? directSweepQueue[queryPriority]
          : adaptivePlanner
            ? selectNextAdaptiveDirectSweepPair(adaptivePlanner)
            : null;

      if (!pair) {
        break;
      }

      const queryExecution = insertQueryExecution(db, {
        parentQueryExecutionId: null,
        priority: queryPriority,
        queryInput: {
          allPossibleDatePairCount: allPairs.length,
          departDate: pair.departDate,
          destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
          durationDays: pair.durationDays,
          returnDate: pair.returnDate,
          samplingMode
        },
        queryType: "direct_round_trip",
        reason:
          samplingMode === "adaptive_coverage"
            ? `Adaptive coverage direct sweep query for ${pair.departDate} to ${pair.returnDate}, chosen from the remaining date pairs using current-run rewards, coverage balance, and weak historical session priors.`
            : `Direct sweep query for ${pair.departDate} to ${pair.returnDate}.`,
        searchRunId: runId,
        source: "planned",
        strategyExecutionId: baselineStrategy.id
      });

      try {
        const queryResult = await executeDirectQuery({
          artifactRecords,
          context,
          db,
          page,
          queryExecutionId: queryExecution.id,
          queryInput: {
            departDate: pair.departDate,
            destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
            returnDate: pair.returnDate
          },
          queryPriority,
          runDir,
          runId,
          runRow,
          strategy: baselineStrategy
        });

        baseCandidates.push(...queryResult.createdCandidates);
          directSweepOutcomes.push({
            candidateCount: queryResult.createdCandidates.length,
            cheapestPrice:
              queryResult.createdCandidates.length > 0
                ? Math.min(...queryResult.createdCandidates.map((candidate) => candidate.displayedAmount))
              : null,
          departDate: pair.departDate,
          distinctFamilyCount: new Set(
            queryResult.createdCandidates.map((candidate) => candidate.candidateFamilyId).filter(Boolean)
          ).size,
          familyIds: queryResult.createdCandidates
            .map((candidate) => candidate.candidateFamilyId)
            .filter(Boolean),
          observedStopoverCityCodes: queryResult.observedStopovers
            .map((entry) => entry.cityCode)
            .filter(Boolean),
            observedStopoverCityCount: queryResult.observedStopovers.length,
            priority: queryPriority,
            historicalPairCandidateCount: Number(
              queryResult.outboundStage?.historicalPairCandidateCount ?? 0
            ),
            returnDate: pair.returnDate,
            resultStageDetail: queryResult.outboundStage?.detail ?? null,
            resultStageKind: queryResult.outboundStage?.kind ?? null,
            rewardScore: computeDirectSweepQueryReward(queryResult),
            selectionPhase:
              samplingMode === "adaptive_coverage"
                ? queryPriority < seedSweepQueryCount
                  ? "seed"
                  : "adaptive"
                : "coverage",
            suspiciousEmptyRetryCount: Number(
              queryResult.outboundStage?.suspiciousEmptyRetryCount ?? 0
            )
          });
        if (adaptivePlanner) {
          recordAdaptiveDirectSweepOutcome(adaptivePlanner, pair, queryResult);
        }
      } catch (queryError) {
        failQueryExecution(
          db,
          queryExecution.id,
          queryError instanceof Error ? queryError.message : "Direct sweep query failed."
        );
        directSweepOutcomes.push({
          candidateCount: 0,
          cheapestPrice: null,
          departDate: pair.departDate,
          distinctFamilyCount: 0,
          familyIds: [],
          observedStopoverCityCodes: [],
          observedStopoverCityCount: 0,
          priority: queryPriority,
          returnDate: pair.returnDate,
          resultStageDetail: null,
          resultStageKind: "failed",
          rewardScore: 0,
          selectionPhase:
            samplingMode === "adaptive_coverage"
              ? queryPriority < seedSweepQueryCount
                ? "seed"
                : "adaptive"
              : "coverage",
          suspiciousEmptyRetryCount: 0
        });
        if (adaptivePlanner) {
          recordAdaptiveDirectSweepOutcome(adaptivePlanner, pair, { createdCandidates: [] });
        }
      }

      executedDirectSweepCount += 1;

      writeWorkerState({
        activeRunId: runId,
        lastError: null,
        lastHeartbeatAt: nowIso(),
        pid: process.pid,
        startedAt: nowIso(),
        status: "running"
      });
      }

      if (baseCandidates.length === 0) {
        const suspiciousHistoricallyEmptyCount = directSweepOutcomes.filter(
          (outcome) =>
            outcome.resultStageKind === "no_results" &&
            Number(outcome.historicalPairCandidateCount ?? 0) > 0
        ).length;

        if (suspiciousHistoricallyEmptyCount > 0) {
          throw new Error(
            `The direct sweep finished without any displayable Trip.com candidates. ${suspiciousHistoricallyEmptyCount} historically productive date pair${suspiciousHistoricallyEmptyCount === 1 ? "" : "s"} returned Trip.com empty pages even after refresh/retry.`
          );
        }

        throw new Error("The direct sweep finished without any displayable Trip.com candidates.");
      }

    const baselineBest = [...baseCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0];
    updateStrategyStatus(db, baselineStrategy.id, {
      best_candidate_id: baselineBest.id,
      candidate_count: baseCandidates.length,
      actual_search_cost: executedDirectSweepCount,
      finished_at: nowIso(),
      status: "completed",
      verified_candidate_count: 0
    });
    insertRunAnalysisSnapshot(db, {
      analysisType: "baseline_execution_efficiency",
      searchRunId: runRow.id,
      strategyExecutionId: baselineStrategy.id,
      summary: buildBaselineExecutionEfficiencySummary({
        candidates: baseCandidates,
        directSweepLimit,
        executedQueryCount: executedDirectSweepCount,
        outcomes: directSweepOutcomes,
        pairUniverseCount: directPairUniverse.length,
        samplingMode,
        seedSweepLimit: seedSweepQueryCount
      })
    });
  }

  for (const strategy of strategies.slice(1)) {
    if (isRunCancelled(db, runId)) {
      break;
    }

    activeStrategy = strategy;

    if (strategy.strategy_type === "packaged_return_option_expansion") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const expansionPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const candidateTargetLimit = Math.max(
        1,
        Number(expansionPayload.candidateTargetLimit ?? 4)
      );
      const expansionHistory = readReturnOptionExpansionHistory(db, runRow.session_id, runId);
      const hasRepeatedZeroYieldHistory =
        Number(expansionHistory.completedExecutions ?? 0) >= 2 &&
        Number(expansionHistory.totalCandidates ?? 0) <= 0;

      if (hasRepeatedZeroYieldHistory) {
        insertRunAnalysisSnapshot(db, {
          analysisType: "baseline_return_option_expansion",
          searchRunId: runRow.id,
          strategyExecutionId: strategy.id,
          summary: {
            analysedAt: nowIso(),
            analysisType: "baseline_return_option_expansion",
            completedExecutionsBeforeRun: Number(expansionHistory.completedExecutions ?? 0),
            expandedCandidateCount: 0,
            expandedFamilyCount: 0,
            expandedQueryCount: 0,
            familyResults: [],
            plannedTargetCount: 0,
            skipReason:
              "Skipped because this session has already completed repeated return-option expansion passes without producing any candidates."
          }
        });

        updateStrategyStatus(db, strategy.id, {
          actual_search_cost: 0,
          best_candidate_id: null,
          candidate_count: 0,
          failure_reason: null,
          finished_at: nowIso(),
          status: "skipped",
          verified_candidate_count: 0
        });
        continue;
      }

      const expansionTargets = buildBaselineReturnExpansionTargetQueue(
        selectBaselineExpansionCandidates(db, baselineStrategy.id),
        candidateTargetLimit,
        `${runId}:${strategy.id}`
      );
      const familyState = new Map();
      const expandedCandidates = [];
      const expansionFailures = [];
      let queryPriority = 0;

      for (const target of expansionTargets) {
        const familyEntry = familyState.get(target.familyKey) ?? {
          discoveredCityCodes: new Set(),
          executedCount: 0,
          isSaturated: false,
          repeatedNoNewInsightCount: 0,
          sourceCandidateCount: 0
        };

        if (familyEntry.isSaturated) {
          continue;
        }

        const queryExecution = insertQueryExecution(db, {
          parentQueryExecutionId: target.parentQueryExecutionId,
          priority: queryPriority,
          queryInput: {
            baseResultUrl: target.resumeUrl,
            departDate: target.departDate,
            destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
            returnDate: target.returnDate,
            selectionPhase: target.selectionPhase,
            sourceCandidateFamilyKey: target.familyKey,
            sourceCandidateId: target.candidateId,
            sourceCandidatePrice: target.displayedAmount,
            sourceOutboundCard: target.outboundCard,
            sourceReturnCard: target.returnCard
          },
          queryType: "return_option_expansion",
          reason:
            target.selectionPhase === "family_repeat"
              ? `Baseline return-option expansion revisiting family ${target.familyKey} on a different date bucket to check whether the deeper return choices expose any new stopover-city patterns.`
              : `Baseline return-option expansion covering a new candidate family from the direct sweep so repeated cheap variants do not crowd out broader stopover-city discovery.`,
          searchRunId: runId,
          source: "derived_from_result",
          strategyExecutionId: strategy.id
        });

        try {
          const created = await executeReturnOptionExpansionQuery({
            artifactRecords,
            context,
            db,
            queryExecutionId: queryExecution.id,
            queryInput: {
              baseResultUrl: target.resumeUrl,
              departDate: target.departDate,
              destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
              returnDate: target.returnDate,
              selectionPhase: target.selectionPhase,
              sourceCandidateFamilyKey: target.familyKey,
              sourceCandidateId: target.candidateId,
              sourceCandidatePrice: target.displayedAmount,
              sourceOutboundCard: target.outboundCard,
              sourceReturnCard: target.returnCard
            },
            queryPriority,
            runDir,
            runId,
            runRow,
            strategy
          });
          const observedCityCodes = new Set(
            created.observedStopovers.map((entry) => entry.cityCode).filter(Boolean)
          );
          const newCityCodes = [...observedCityCodes].filter(
            (cityCode) => !familyEntry.discoveredCityCodes.has(cityCode)
          );

          newCityCodes.forEach((cityCode) => familyEntry.discoveredCityCodes.add(cityCode));
          familyEntry.executedCount += 1;
          familyEntry.sourceCandidateCount += 1;
          if (newCityCodes.length === 0) {
            familyEntry.repeatedNoNewInsightCount += 1;
          } else {
            familyEntry.repeatedNoNewInsightCount = 0;
          }
          if (familyEntry.repeatedNoNewInsightCount >= 1) {
            familyEntry.isSaturated = true;
          }
          familyState.set(target.familyKey, familyEntry);

          expandedCandidates.push(...created.createdCandidates);
          baseCandidates.push(...created.createdCandidates);
        } catch (queryError) {
          const message =
            queryError instanceof Error
              ? queryError.message
              : "Return-option expansion query failed.";
          failQueryExecution(db, queryExecution.id, message);
          expansionFailures.push(`${target.candidateId}: ${message}`);
        }

        queryPriority += 1;
      }

      insertRunAnalysisSnapshot(db, {
        analysisType: "baseline_return_option_expansion",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "baseline_return_option_expansion",
          expandedCandidateCount: expandedCandidates.length,
          expandedFamilyCount: familyState.size,
          expandedQueryCount: queryPriority,
          familyResults: [...familyState.entries()].map(([familyKey, entry]) => ({
            discoveredStopoverCities: [...entry.discoveredCityCodes].map((cityCode) => ({
              cityCode,
              cityName: resolveCityName(cityCode)
            })),
            discoveredStopoverCityCount: entry.discoveredCityCodes.size,
            executedCount: entry.executedCount,
            familyKey,
            isSaturated: entry.isSaturated,
            repeatedNoNewInsightCount: entry.repeatedNoNewInsightCount
          })),
          plannedTargetCount: expansionTargets.length
        }
      });

      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: queryPriority,
        best_candidate_id:
          [...expandedCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: expandedCandidates.length,
        failure_reason: expansionFailures.length > 0 ? expansionFailures.join(" | ") : null,
        finished_at: nowIso(),
        status:
          queryPriority === 0
            ? "skipped"
            : expandedCandidates.length > 0
              ? "completed"
              : expansionFailures.length > 0
                ? "failed"
                : "completed",
        verified_candidate_count: 0
      });
    } else if (strategy.strategy_type === "pass1_analysis") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const analysisPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const baselineSourceStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        ["packaged_direct_sweep", "packaged_return_option_expansion"],
        { requireCandidates: true }
      );
      latestAnalysisSnapshot = analyzeDirectSweep(
        db,
        runRow,
        baselineSourceStrategyIds.length > 0 ? baselineSourceStrategyIds : [baselineStrategy.id],
        strategy,
        analysisPayload
      );
    } else if (strategy.strategy_type === "packaged_departure_anchor_followup") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const analysisSnapshot =
        latestAnalysisSnapshot ??
        getLatestRunAnalysisSnapshot(db, runId, "pass1_market_scan");
      const anchorPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const anchorLimitValue = Number(anchorPayload.anchorDepartureDateLimit);
      const anchorLimit = Number.isFinite(anchorLimitValue) && anchorLimitValue > 0
        ? anchorLimitValue
        : 2;
      const anchoredReturnSweepLimitValue = Number(anchorPayload.anchoredReturnSweepLimit);
      const anchoredReturnSweepLimit =
        Number.isFinite(anchoredReturnSweepLimitValue) && anchoredReturnSweepLimitValue > 0
          ? anchoredReturnSweepLimitValue
          : 3;
      const recommendedAnchors = Array.isArray(analysisSnapshot?.summary?.recommendedDepartureAnchors)
        ? analysisSnapshot.summary.recommendedDepartureAnchors
        : [];
      const departureDateFallback = Array.isArray(analysisSnapshot?.summary?.departureDateFindings)
        ? analysisSnapshot.summary.departureDateFindings.map((entry) => ({
            cheapestPrice: entry.cheapestPrice ?? null,
            departDate: entry.departDate,
            rationale: "Derived from the pass-1 cheapest departure-date findings.",
            sampledReturnDates: entry.observedReturnDates ?? []
          }))
        : [];
      const existingDirectPairKeys = new Set(
        db
          .prepare(
            `select query_input_json
             from query_execution
             where search_run_id = ? and query_type = 'direct_round_trip'`
          )
          .all(runId)
          .map((row) => {
            const input = safeJsonParse(row.query_input_json, {});
            return input.departDate && input.returnDate ? `${input.departDate}__${input.returnDate}` : null;
          })
          .filter(Boolean)
      );
      const selectedAnchors = (recommendedAnchors.length > 0 ? recommendedAnchors : departureDateFallback)
        .slice(0, anchorLimit);
      const anchoredCandidates = [];
      const anchorFailures = [];
      let queryPriority = 0;

      for (const anchor of selectedAnchors) {
        const anchoredPairs = enumerateAnchoredDatePairs(
          runRow,
          anchor.departDate,
          anchoredReturnSweepLimit,
          existingDirectPairKeys
        );

        for (const pair of anchoredPairs) {
          const pairKey = `${pair.departDate}__${pair.returnDate}`;
          const queryExecution = insertQueryExecution(db, {
            parentQueryExecutionId: null,
            priority: queryPriority,
            queryInput: {
              allPossibleDatePairCount: anchoredPairs.length,
              anchorCheapestPrice: anchor.cheapestPrice ?? null,
              anchorDepartDate: anchor.departDate,
              anchorRationale: anchor.rationale,
              departDate: pair.departDate,
              destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
              durationDays: pair.durationDays,
              returnDate: pair.returnDate
            },
            queryType: "direct_round_trip",
            reason: `Anchored departure follow-up for ${pair.departDate}, testing return ${pair.returnDate} after pass-1 analysis marked this departure date as cheap.`,
            searchRunId: runId,
            source: "derived_from_result",
            strategyExecutionId: strategy.id
          });

          try {
            const queryResult = await executeDirectQuery({
              artifactRecords,
              context,
              db,
              queryExecutionId: queryExecution.id,
              queryInput: {
                departDate: pair.departDate,
                destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
                returnDate: pair.returnDate
              },
              queryPriority,
              runDir,
              runId,
              runRow,
              strategy
            });

            anchoredCandidates.push(...queryResult.createdCandidates);
            baseCandidates.push(...queryResult.createdCandidates);
            existingDirectPairKeys.add(pairKey);
          } catch (queryError) {
            const message =
              queryError instanceof Error
                ? queryError.message
                : "Anchored departure follow-up query failed.";
            failQueryExecution(db, queryExecution.id, message);
            anchorFailures.push(`${pair.departDate} -> ${pair.returnDate}: ${message}`);
          }

          queryPriority += 1;
        }
      }

      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: queryPriority,
        best_candidate_id:
          [...anchoredCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: anchoredCandidates.length,
        failure_reason: anchorFailures.length > 0 ? anchorFailures.join(" | ") : null,
        finished_at: nowIso(),
        status:
          queryPriority === 0
            ? "skipped"
            : anchoredCandidates.length > 0
              ? "completed"
              : anchorFailures.length > 0
                ? "failed"
                : "skipped",
        verified_candidate_count: 0
      });
    } else if (strategy.strategy_type === "packaged_stopover_followup") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const baselineStopoverStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        [
          "packaged_direct_sweep",
          "packaged_return_option_expansion",
          "packaged_departure_anchor_followup"
        ]
      );
      const stopoverEvidence = collectRecordedStopoverEvidenceForStrategies(
        db,
        baselineStopoverStrategyIds.length > 0 ? baselineStopoverStrategyIds : [baselineStrategy.id],
        resolveCityCode(runRow.outbound_destination_city)
      );
      const analysisSnapshot =
        latestAnalysisSnapshot ??
        getLatestRunAnalysisSnapshot(db, runId, "pass1_market_scan");
      const followupPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const candidateReviewLimit = Math.max(1, Number(followupPayload.candidateReviewLimit ?? 10));
      const followupCityLimit = Math.max(1, Number(followupPayload.followupCityLimit ?? 2));
      const seedContextsPerCityLimit = Math.max(
        1,
        Number(followupPayload.seedContextsPerCityLimit ?? 2)
      );
      const priorRoundTripStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        [
          "packaged_direct_sweep",
          "packaged_return_option_expansion",
          "packaged_departure_anchor_followup"
        ]
      );
      const preferredSignals = buildPreferredSignalSets(analysisSnapshot);
      const anchorDates = Array.isArray(analysisSnapshot?.summary?.recommendedDepartureAnchors)
        ? analysisSnapshot.summary.recommendedDepartureAnchors
            .map((entry) => entry?.departDate)
            .filter(Boolean)
        : preferredSignals.preferredDepartureDates;
      const seedBoard = buildMultiCityVerificationSeedBoard({
        anchorDates,
        candidateReviewLimit,
        db,
        destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
        preferredSignals,
        runSeed: runId,
        strategyIds:
          priorRoundTripStrategyIds.length > 0 ? priorRoundTripStrategyIds : [baselineStrategy.id]
      });
      const rankedStopoverEvidence = buildMultiCityVerificationEvidence({
        baselineCheapestPrice: seedBoard.baselineCheapestPrice,
        candidateEvidence: seedBoard.reviewedSeeds,
        candidateReviewLimit,
        preferredSignals,
        queryEvidence: stopoverEvidence
      });
      const selectedCityTargets = buildMultiCityVerificationFollowupTargets({
        followupCityLimit,
        rankedCities: rankedStopoverEvidence,
        runSeed: runId,
        seedContextsPerCityLimit
      });
      insertRunAnalysisSnapshot(db, {
        analysisType: "multi_city_verification_rank",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "multi_city_verification_rank",
          baselineCheapestPrice: seedBoard.baselineCheapestPrice,
          cityEntryFindings: seedBoard.cityEntryFindings.slice(0, 8),
          preferredAirlines: preferredSignals.preferredAirlines,
          preferredDepartureDates: preferredSignals.preferredDepartureDates,
          preferredReturnDates: preferredSignals.preferredReturnDates,
          rankedCities: rankedStopoverEvidence.slice(0, 8).map((entry) => ({
            baselinePriceDelta: entry.baselinePriceDelta,
            cheapestCandidatePrice: entry.cheapestCandidatePrice,
            cityCode: entry.cityCode,
            cityName: entry.cityName,
            familyCount: entry.familyCount,
            longestStopDurationMinutes: entry.longestStopDurationMinutes,
            lowestObservedPrice: entry.lowestObservedPrice,
            matchingAirlineCount: entry.matchingAirlineCount,
            matchingDepartureTrendCount: entry.matchingDepartureTrendCount,
            matchingReturnTrendCount: entry.matchingReturnTrendCount,
            observationCount: entry.observationCount,
            reviewedCandidateCount: entry.reviewedCandidateCount,
            reviewedSeedContexts: (entry.seedContexts ?? []).slice(0, 3).map((seed) => ({
              baselinePriceDelta: seed.baselinePriceDelta,
              candidateFamilyId: seed.candidateFamilyId,
              departDate: seed.departDate,
              discoverySources: seed.discoverySources,
              familyKey: seed.familyKey,
              outboundAirline: seed.outboundAirline,
              returnAirline: seed.returnAirline,
              returnDate: seed.returnDate,
              seedScore: seed.seedScore
            })),
            sampleAirlines: entry.sampleAirlines,
            sampleDepartureDates: entry.sampleDepartureDates,
            score: entry.score,
            totalIntentionalStopCount: entry.totalIntentionalStopCount
          })),
          selectedCityTargets: selectedCityTargets.map((entry) => ({
            cityCode: entry.cityCode,
            cityName: entry.cityName,
            selectedSeedContexts: (entry.selectedSeedContexts ?? []).map((seed) => ({
              baselinePriceDelta: seed.baselinePriceDelta,
              candidateFamilyId: seed.candidateFamilyId,
              departDate: seed.departDate,
              familyKey: seed.familyKey,
              outboundAirline: seed.outboundAirline,
              returnAirline: seed.returnAirline,
              returnDate: seed.returnDate
            }))
          })),
          reviewedCandidateCount: seedBoard.reviewedSeeds.length,
          reviewedSeeds: seedBoard.reviewedSeeds.slice(0, 12).map((seed) => ({
            baselinePriceDelta: seed.baselinePriceDelta,
            candidateFamilyId: seed.candidateFamilyId,
            cityCode: seed.cityCode,
            cityName: seed.cityName,
            departDate: seed.departDate,
            discoverySources: seed.discoverySources,
            familyKey: seed.familyKey,
            outboundAirline: seed.outboundAirline,
            returnAirline: seed.returnAirline,
            returnDate: seed.returnDate,
            seedScore: seed.seedScore
          })),
          totalAvailableSeedCount: seedBoard.totalAvailableSeedCount
        }
      });
      const followupCandidates = [];
      const followupFailures = [];
      const followupSeedResults = [];
      let executedSeedQueryCount = 0;

      for (const cityEvidence of selectedCityTargets) {
        for (const seedContext of cityEvidence.selectedSeedContexts ?? []) {
          const evidenceParts = [];
          if (cityEvidence.reviewedSeedCount > 0) {
            evidenceParts.push(
              `${cityEvidence.reviewedSeedCount} of ${cityEvidence.candidateReviewLimit} reviewed baseline contexts used this city`
            );
          }
          if (cityEvidence.familyCount > 0) {
            evidenceParts.push(`${cityEvidence.familyCount} distinct baseline families exposed this city`);
          }
          if (typeof seedContext.baselinePriceDelta === "number") {
            evidenceParts.push(`seed stays within AUD ${seedContext.baselinePriceDelta} of the baseline cheapest fare`);
          }
          if (seedContext.departDate || seedContext.returnDate) {
            evidenceParts.push(
              `seed date pair ${seedContext.departDate ?? "?"} to ${seedContext.returnDate ?? "?"}`
            );
          }
          if (seedContext.outboundAirline || seedContext.returnAirline) {
            evidenceParts.push(
              `seed carriers ${[seedContext.outboundAirline, seedContext.returnAirline].filter(Boolean).join(" / ")}`
            );
          }
          const queryExecution = insertQueryExecution(db, {
            parentQueryExecutionId: seedContext.sourceQueryExecutionId,
            priority: executedSeedQueryCount,
            queryInput: {
              baseResultUrl: seedContext.sourceResultUrl,
              baselinePriceDelta: seedContext.baselinePriceDelta,
              candidateReviewLimit,
              candidateFamilyId: seedContext.candidateFamilyId,
              familyKey: seedContext.familyKey,
              followupCityLimit,
              matchingAirlineCount: cityEvidence.matchingAirlineCount,
              matchingDepartureTrendCount: cityEvidence.matchingDepartureTrendCount,
              matchingReturnTrendCount: cityEvidence.matchingReturnTrendCount,
              outboundAirline: seedContext.outboundAirline,
              parentQueryExecutionId: seedContext.sourceQueryExecutionId,
              preferredAirlines: cityEvidence.preferredAirlines,
              preferredDepartureDates: cityEvidence.preferredDepartureDates,
              preferredReturnDates: cityEvidence.preferredReturnDates,
              returnAirline: seedContext.returnAirline,
              reviewedSeedCount: cityEvidence.reviewedSeedCount,
              seedDepartDate: seedContext.departDate,
              seedReturnDate: seedContext.returnDate,
              stopoverCityCode: cityEvidence.cityCode,
              stopoverCityName: cityEvidence.cityName
            },
            queryType: "stopover_filtered_round_trip",
            reason: `Multi-city verification probe for ${cityEvidence.cityName} after the round-trip baseline ranked it highly${evidenceParts.length > 0 ? ` (${evidenceParts.join("; ")})` : ""}.`,
            searchRunId: runId,
            source: "derived_from_result",
            strategyExecutionId: strategy.id
          });

          try {
            const created = await executeStopoverFollowupQuery({
              artifactRecords,
              context,
              db,
              minimumStopDurationMinutes: 0,
              queryExecutionId: queryExecution.id,
              queryInput: {
                baseResultUrl: seedContext.sourceResultUrl,
                parentQueryExecutionId: seedContext.sourceQueryExecutionId,
                stopoverCityCode: cityEvidence.cityCode
              },
              queryPriority: executedSeedQueryCount,
              runDir,
              runId,
              runRow,
              strategy
            });

            followupCandidates.push(...created);
            baseCandidates.push(...created);
            followupSeedResults.push({
              cityCode: cityEvidence.cityCode,
              cityName: cityEvidence.cityName,
              createdCandidates: created,
              queryExecutionId: queryExecution.id,
              seedContext
            });
          } catch (queryError) {
            const message =
              queryError instanceof Error ? queryError.message : "Stopover follow-up query failed.";
            failQueryExecution(db, queryExecution.id, message);
            followupFailures.push(
              `${cityEvidence.cityCode}/${seedContext.candidateFamilyId}: ${message}`
            );
            followupSeedResults.push({
              cityCode: cityEvidence.cityCode,
              cityName: cityEvidence.cityName,
              createdCandidates: [],
              failureMessage: message,
              queryExecutionId: queryExecution.id,
              seedContext
            });
          }

          executedSeedQueryCount += 1;
        }
      }

      const verificationResultsSummary = buildMultiCityVerificationResultsSummary({
        baselineCheapestPrice: seedBoard.baselineCheapestPrice,
        seedResults: followupSeedResults
      });

      insertRunAnalysisSnapshot(db, {
        analysisType: "multi_city_verification_results",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "multi_city_verification_results",
          sessionStopDurationMaxDays: Number(runRow.stop_duration_max_days ?? null),
          sessionStopDurationMinDays: Number(runRow.stop_duration_min_days ?? null),
          ...verificationResultsSummary
        }
      });

      const followupStatus =
        selectedCityTargets.length === 0
          ? "skipped"
          : followupCandidates.length > 0
            ? "completed"
            : followupFailures.length > 0
              ? "failed"
              : "skipped";
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: executedSeedQueryCount,
        best_candidate_id:
          verificationResultsSummary.cheapestMultiCityCandidate?.candidateId ??
          [...followupCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: followupCandidates.length,
        failure_reason:
          followupStatus === "failed" && followupFailures.length > 0
            ? followupFailures.join(" | ")
            : null,
        finished_at: nowIso(),
        status: followupStatus,
        verified_candidate_count: Array.isArray(verificationResultsSummary.cityResults)
          ? verificationResultsSummary.cityResults.filter(
              (entry) => Number(entry.intentionalCandidateCount ?? 0) > 0
            ).length
          : 0
      });
    } else if (strategy.strategy_type === "anchored_multi_city_probe") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const anchoredPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const candidateReviewLimit = Math.max(
        1,
        Number(anchoredPayload.candidateReviewLimit ?? 10)
      );
      const followupCityLimit = Math.max(1, Number(anchoredPayload.followupCityLimit ?? 2));
      const seedContextsPerCityLimit = Math.max(
        1,
        Number(anchoredPayload.seedContextsPerCityLimit ?? 1)
      );
      const dateVariationLimit = Math.max(1, Number(anchoredPayload.dateVariationLimit ?? 3));
      const destinationCityCode = resolveCityCode(runRow.outbound_destination_city);
      const pass1Snapshot =
        latestAnalysisSnapshot ?? getLatestRunAnalysisSnapshot(db, runId, "pass1_market_scan");
      const baselineStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        [
          "packaged_direct_sweep",
          "packaged_return_option_expansion",
          "packaged_departure_anchor_followup"
        ]
      );
      const baselineStopoverEvidence = collectRecordedStopoverEvidenceForStrategies(
        db,
        baselineStrategyIds.length > 0 ? baselineStrategyIds : [baselineStrategy.id],
        destinationCityCode
      );
      const preferredSignals = buildPreferredSignalSets(pass1Snapshot);
      const anchorDates = Array.isArray(pass1Snapshot?.summary?.recommendedDepartureAnchors)
        ? pass1Snapshot.summary.recommendedDepartureAnchors
            .map((entry) => entry?.departDate)
            .filter(Boolean)
        : preferredSignals.preferredDepartureDates;
      const seedBoard = buildMultiCityVerificationSeedBoard({
        anchorDates,
        candidateReviewLimit,
        db,
        destinationCityCode,
        preferredSignals,
        runSeed: `${runId}:${strategy.id}:anchored`,
        strategyIds: baselineStrategyIds.length > 0 ? baselineStrategyIds : [baselineStrategy.id]
      });
      const rankedStopoverEvidence = buildMultiCityVerificationEvidence({
        baselineCheapestPrice: seedBoard.baselineCheapestPrice,
        candidateEvidence: seedBoard.reviewedSeeds,
        candidateReviewLimit,
        preferredSignals,
        queryEvidence: baselineStopoverEvidence
      });
      const selectedCityTargets = buildMultiCityVerificationFollowupTargets({
        followupCityLimit,
        rankedCities: rankedStopoverEvidence,
        runSeed: `${runId}:${strategy.id}:anchored`,
        seedContextsPerCityLimit
      });
      const anchoredSeedResults = [];
      const anchoredFailures = [];
      const anchoredCandidates = [];
      let executedAnchoredQueryCount = 0;

      for (const cityEvidence of selectedCityTargets) {
        for (const seedContext of cityEvidence.selectedSeedContexts ?? []) {
          const seedDepartDate = seedContext.departDate;
          const seedReturnDate = seedContext.returnDate;

          if (!seedDepartDate || !seedReturnDate) {
            anchoredSeedResults.push({
              cityCode: cityEvidence.cityCode,
              cityName: cityEvidence.cityName,
              createdCandidates: [],
              failureMessage: "Baseline seed was missing anchored dates.",
              seedContext
            });
            continue;
          }

          const dateVariations = enumerateAnchoredMultiCityStopDates({
            departDate: seedDepartDate,
            limit: dateVariationLimit,
            maxStopDays: runRow.stop_duration_max_days,
            minStopDays: runRow.stop_duration_min_days,
            returnDate: seedReturnDate,
            runSeed: `${runId}:${strategy.id}:${cityEvidence.cityCode}:${seedContext.seedKey ?? seedContext.candidateFamilyId ?? "seed"}`
          });

          for (const stopoverDepartDate of dateVariations) {
            const reasonParts = [
              `baseline family ${seedContext.candidateFamilyId ?? "unknown"} exposed ${cityEvidence.cityName}`,
              `anchored dates ${seedDepartDate} -> ${seedReturnDate}`,
              `stopover date ${stopoverDepartDate}`
            ];
            if (typeof seedContext.baselinePriceDelta === "number") {
              reasonParts.push(
                `baseline delta AUD ${seedContext.baselinePriceDelta.toLocaleString("en-AU", {
                  maximumFractionDigits: 0
                })}`
              );
            }

            const queryExecution = insertQueryExecution(db, {
              parentQueryExecutionId: seedContext.sourceQueryExecutionId,
              priority: executedAnchoredQueryCount,
              queryInput: {
                baselinePriceDelta: seedContext.baselinePriceDelta ?? null,
                candidateFamilyId: seedContext.candidateFamilyId ?? null,
                candidateReviewLimit,
                citySeedScore: cityEvidence.score ?? null,
                dateVariationLimit,
                departDate: seedDepartDate,
                destinationCityCode,
                familyKey: seedContext.familyKey ?? null,
                finalReturnAirport: runRow.return_destination_airport,
                followupCityLimit,
                outboundAirline: seedContext.outboundAirline ?? null,
                returnAirline: seedContext.returnAirline ?? null,
                returnDate: seedReturnDate,
                seedContextsPerCityLimit,
                segmentOptionLimit: Number(anchoredPayload.segmentOptionLimit ?? 1),
                stopoverCityCode: cityEvidence.cityCode,
                stopoverCityName: cityEvidence.cityName,
                stopoverDepartDate
              },
              queryType: "anchored_multi_city",
              reason: `Anchored multi-city Trip.com probe for ${cityEvidence.cityName} (${reasonParts.join("; ")}).`,
              searchRunId: runId,
              source: "derived_from_result",
              strategyExecutionId: strategy.id
            });

            try {
              const created = await executeAnchoredMultiCityQuery({
                artifactRecords,
                context,
                db,
                queryExecutionId: queryExecution.id,
                queryInput: {
                  departDate: seedDepartDate,
                  destinationCityCode,
                  finalReturnAirport: runRow.return_destination_airport,
                  returnDate: seedReturnDate,
                  segmentOptionLimit: Number(anchoredPayload.segmentOptionLimit ?? 1),
                  stopoverCityCode: cityEvidence.cityCode,
                  stopoverDepartDate
                },
                queryPriority: executedAnchoredQueryCount,
                runDir,
                runId,
                runRow,
                strategy
              });

              anchoredCandidates.push(...created);
              baseCandidates.push(...created);
              anchoredSeedResults.push({
                cityCode: cityEvidence.cityCode,
                cityName: cityEvidence.cityName,
                createdCandidates: created,
                queryExecutionId: queryExecution.id,
                seedContext: {
                  ...seedContext,
                  cityCode: cityEvidence.cityCode,
                  cityName: cityEvidence.cityName
                }
              });
            } catch (queryError) {
              const message =
                queryError instanceof Error ? queryError.message : "Anchored multi-city query failed.";
              failQueryExecution(db, queryExecution.id, message);
              anchoredFailures.push(
                `${cityEvidence.cityCode}/${seedContext.candidateFamilyId ?? "unknown"}@${stopoverDepartDate}: ${message}`
              );
              anchoredSeedResults.push({
                cityCode: cityEvidence.cityCode,
                cityName: cityEvidence.cityName,
                createdCandidates: [],
                failureMessage: message,
                queryExecutionId: queryExecution.id,
                seedContext: {
                  ...seedContext,
                  cityCode: cityEvidence.cityCode,
                  cityName: cityEvidence.cityName
                }
              });
            }

            executedAnchoredQueryCount += 1;
          }
        }
      }

      const anchoredResultsSummary = buildAnchoredMultiCityResultsSummary({
        baselineCheapestPrice: seedBoard.baselineCheapestPrice,
        seedResults: anchoredSeedResults
      });

      insertRunAnalysisSnapshot(db, {
        analysisType: "anchored_multi_city_results",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "anchored_multi_city_results",
          candidateReviewLimit,
          dateVariationLimit,
          followupCityLimit,
          segmentOptionLimit: Number(anchoredPayload.segmentOptionLimit ?? 1),
          selectedCityTargets: selectedCityTargets.map((entry) => ({
            cityCode: entry.cityCode,
            cityName: entry.cityName,
            score: entry.score,
            selectedSeedContexts: (entry.selectedSeedContexts ?? []).map((seed) => ({
              baselinePriceDelta: seed.baselinePriceDelta,
              candidateFamilyId: seed.candidateFamilyId,
              departDate: seed.departDate,
              familyKey: seed.familyKey,
              outboundAirline: seed.outboundAirline,
              returnAirline: seed.returnAirline,
              returnDate: seed.returnDate
            }))
          })),
          sessionStopDurationMaxDays: Number(runRow.stop_duration_max_days ?? null),
          sessionStopDurationMinDays: Number(runRow.stop_duration_min_days ?? null),
          testedDateVariationCount: executedAnchoredQueryCount,
          ...anchoredResultsSummary
        }
      });

      const anchoredStatus =
        selectedCityTargets.length === 0
          ? "skipped"
          : anchoredCandidates.length > 0
            ? "completed"
            : anchoredFailures.length > 0
              ? "failed"
              : "skipped";
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: executedAnchoredQueryCount,
        best_candidate_id:
          anchoredResultsSummary.cheapestMultiCityCandidate?.candidateId ??
          anchoredResultsSummary.cheapestVerifiedMultiCityCandidate?.candidateId ??
          [...anchoredCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: anchoredCandidates.length,
        failure_reason:
          anchoredStatus === "failed" && anchoredFailures.length > 0
            ? anchoredFailures.join(" | ")
            : null,
        finished_at: nowIso(),
        status: anchoredStatus,
        verified_candidate_count: Array.isArray(anchoredResultsSummary.cityResults)
          ? anchoredResultsSummary.cityResults.filter(
              (entry) => Number(entry.intentionalCandidateCount ?? 0) > 0
            ).length
          : 0
      });
    } else if (strategy.strategy_type === "multi_city_long_stop_validation") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const validationPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const sourceStrategy = [...strategies]
        .filter(
          (plannedStrategy) =>
            plannedStrategy.priority < strategy.priority &&
            plannedStrategy.strategy_type === "packaged_stopover_followup"
        )
        .sort((left, right) => right.priority - left.priority)[0] ?? null;
      const rankingSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_verification_rank"
      );
      const cityValidations = buildLongStopValidationSummary({
        db,
        minimumLongStopHours: Number(validationPayload.minimumLongStopHours ?? 18),
        rankingSnapshot,
        sourceStrategyId: sourceStrategy?.id ?? null
      });

      insertRunAnalysisSnapshot(db, {
        analysisType: "multi_city_long_stop_validation",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "multi_city_long_stop_validation",
          cityValidations,
          minimumLongStopHours: Number(validationPayload.minimumLongStopHours ?? 18),
          sourceStrategyExecutionId: sourceStrategy?.id ?? null
        }
      });

      const promisingCity = cityValidations.find((entry) => entry.recommendation === "promising");
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        best_candidate_id: null,
        candidate_count: cityValidations.length,
        failure_reason: null,
        finished_at: nowIso(),
        status: cityValidations.length > 0 ? "completed" : "skipped",
        verified_candidate_count: promisingCity ? 1 : 0
      });
    } else if (strategy.strategy_type === "multi_city_long_stop_followup") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const followupPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const minimumLongStopHours = Math.max(
        1,
        Number(followupPayload.minimumLongStopHours ?? 18)
      );
      const followupCityLimit = Math.max(1, Number(followupPayload.followupCityLimit ?? 1));
      const longStopValidationSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_long_stop_validation"
      );
      const longStopValidationSummary = safeJsonParse(
        longStopValidationSnapshot?.summaryJson ?? null,
        null
      );
      const multiCityVerificationResultsSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_verification_results"
      );
      const multiCityVerificationResultsSummary = safeJsonParse(
        multiCityVerificationResultsSnapshot?.summaryJson ?? null,
        null
      );
      const selectedCities = buildLongStopFollowupTargets(
        longStopValidationSummary,
        followupCityLimit
      );
      const baselineStopoverStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        [
          "packaged_direct_sweep",
          "packaged_return_option_expansion",
          "packaged_departure_anchor_followup"
        ]
      );
      const baselineStopoverEvidence = collectRecordedStopoverEvidenceForStrategies(
        db,
        baselineStopoverStrategyIds.length > 0 ? baselineStopoverStrategyIds : [baselineStrategy.id],
        resolveCityCode(runRow.outbound_destination_city)
      );
      const verificationResultsByCity = new Map(
        Array.isArray(multiCityVerificationResultsSummary?.cityResults)
          ? multiCityVerificationResultsSummary.cityResults.map((entry) => [entry.cityCode, entry])
          : []
      );
      const baselineEvidenceByCity = new Map(
        baselineStopoverEvidence.map((entry) => [entry.cityCode, entry])
      );
      const minimumStopDurationMinutes = minimumLongStopHours * 60;
      const longStopCandidates = [];
      const longStopFailures = [];
      const cityResults = [];

      for (const [queryPriority, validationEntry] of selectedCities.entries()) {
        const verificationResult = verificationResultsByCity.get(validationEntry.cityCode) ?? null;
        const bestSeedContext = verificationResult?.bestSeedContext ?? null;
        const baseEvidence = baselineEvidenceByCity.get(validationEntry.cityCode);
        const baseResultUrl = bestSeedContext?.sourceResultUrl ?? baseEvidence?.resultUrl ?? null;
        const parentQueryExecutionId =
          bestSeedContext?.sourceQueryExecutionId ?? baseEvidence?.parentQueryExecutionId ?? null;

        if (!baseResultUrl) {
          longStopFailures.push(
            `${validationEntry.cityCode}: no baseline result page was recorded for long-stop follow-up.`
          );
          continue;
        }

        const queryExecution = insertQueryExecution(db, {
          parentQueryExecutionId,
          priority: queryPriority,
          queryInput: {
            baseResultUrl,
            baselinePriceDelta: bestSeedContext?.baselinePriceDelta ?? null,
            candidateFamilyId: bestSeedContext?.candidateFamilyId ?? null,
            familyKey: bestSeedContext?.familyKey ?? null,
            minimumLongStopHours,
            parentQueryExecutionId,
            recommendation: validationEntry.recommendation,
            seedDepartDate: bestSeedContext?.departDate ?? null,
            seedReturnDate: bestSeedContext?.returnDate ?? null,
            stopoverCityCode: validationEntry.cityCode,
            stopoverCityName: validationEntry.cityName,
            validatedCandidateCount: validationEntry.verifiedCandidateCount ?? 0
          },
          queryType: "long_stop_stopover_round_trip",
          reason: `Long-stop follow-up for ${validationEntry.cityName} after multi-city verification marked it ${validationEntry.recommendation ?? "watch"} with a target stop length of at least ${minimumLongStopHours}h.`,
          searchRunId: runId,
          source: "derived_from_result",
          strategyExecutionId: strategy.id
        });

        try {
          const created = await executeStopoverFollowupQuery({
            artifactRecords,
            context,
            db,
            minimumStopDurationMinutes,
            queryExecutionId: queryExecution.id,
            queryInput: {
              baseResultUrl,
              parentQueryExecutionId,
              stopoverCityCode: validationEntry.cityCode
            },
            queryPriority,
            runDir,
            runId,
            runRow,
            strategy
          });
          const cityCandidates = created.filter((candidate) =>
            Array.isArray(candidate.stopovers)
              ? candidate.stopovers.some(
                  (stopover) => stopover.cityCode === validationEntry.cityCode
                )
              : false
          );
          const cityDurations = cityCandidates.flatMap((candidate) =>
            (candidate.stopovers ?? []).map((stopover) => Number(stopover.durationMinutes ?? 0))
          );

          cityResults.push({
            candidateCount: cityCandidates.length,
            cheapestCandidatePrice:
              cityCandidates.length > 0
                ? Math.min(...cityCandidates.map((candidate) => candidate.displayedAmount))
                : null,
            cityCode: validationEntry.cityCode,
            cityName: validationEntry.cityName,
            longestObservedStopHours:
              cityDurations.length > 0
                ? Number((Math.max(...cityDurations) / 60).toFixed(1))
                : null,
            recommendation: validationEntry.recommendation
          });
          longStopCandidates.push(...created);
          baseCandidates.push(...created);
        } catch (queryError) {
          const message =
            queryError instanceof Error ? queryError.message : "Long-stop follow-up query failed.";
          failQueryExecution(db, queryExecution.id, message);
          longStopFailures.push(`${validationEntry.cityCode}: ${message}`);
          cityResults.push({
            candidateCount: 0,
            cheapestCandidatePrice: null,
            cityCode: validationEntry.cityCode,
            cityName: validationEntry.cityName,
            longestObservedStopHours: null,
            recommendation: validationEntry.recommendation
          });
        }
      }

      insertRunAnalysisSnapshot(db, {
        analysisType: "multi_city_long_stop_followup",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "multi_city_long_stop_followup",
          candidateCount: longStopCandidates.length,
          cheapestCandidatePrice:
            longStopCandidates.length > 0
              ? Math.min(...longStopCandidates.map((candidate) => candidate.displayedAmount))
              : null,
          cityResults,
          minimumLongStopHours,
          queriedCityCount: cityResults.length
        }
      });

      const longStopStatus =
        selectedCities.length === 0
          ? "skipped"
          : longStopCandidates.length > 0
            ? "completed"
            : longStopFailures.length > 0
              ? "failed"
              : "skipped";
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: cityResults.length,
        best_candidate_id:
          [...longStopCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: longStopCandidates.length,
        failure_reason:
          longStopStatus === "failed" && longStopFailures.length > 0
            ? longStopFailures.join(" | ")
            : null,
        finished_at: nowIso(),
        status: longStopStatus,
        verified_candidate_count: cityResults.filter((entry) => entry.candidateCount > 0).length
      });
    } else if (strategy.strategy_type === "alternate_return_city_probe") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const probePayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const pass1Snapshot =
        latestAnalysisSnapshot ??
        getLatestRunAnalysisSnapshot(db, runId, "pass1_market_scan");
      const multiCityRankingSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_verification_rank"
      );
      const longStopValidationSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_long_stop_validation"
      );
      const longStopFollowupSnapshot = getLatestRunAnalysisSnapshot(
        db,
        runId,
        "multi_city_long_stop_followup"
      );
      const candidateCityLimit = Math.max(1, Number(probePayload.candidateCityLimit ?? 2));
      const datePairLimit = Math.max(1, Number(probePayload.datePairLimit ?? 3));
      const selectedCities = buildAlternateReturnCityTargets({
        candidateCityLimit,
        destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
        longStopFollowupSnapshot,
        longStopValidationSnapshot,
        multiCityRankingSnapshot,
        pass1Snapshot
      });
      const datePairs = buildAlternateReturnCityDatePairs(runRow, pass1Snapshot, datePairLimit);
      const probeCandidates = [];
      const probeFailures = [];
      let queryPriority = 0;

      for (const cityTarget of selectedCities) {
        for (const pair of datePairs) {
          const queryExecution = insertQueryExecution(db, {
            parentQueryExecutionId: null,
            priority: queryPriority,
            queryInput: {
              datePairLimit,
              departDate: pair.departDate,
              destinationCityCode: cityTarget.cityCode,
              destinationCityName: cityTarget.cityName,
              reasons: cityTarget.reasons,
              returnDate: pair.returnDate,
              targetScore: cityTarget.targetScore
            },
            queryType: "direct_round_trip",
            reason: `Alternate-city comparison for ${cityTarget.cityName}. This is a bounded round-trip probe to evaluate a possible flexible return-origin city, not a true open-jaw search.${cityTarget.reasons.length > 0 ? ` Evidence: ${cityTarget.reasons.slice(0, 3).join("; ")}.` : ""}`,
            searchRunId: runId,
            source: "derived_from_result",
            strategyExecutionId: strategy.id
          });

          try {
            const created = await executeDirectQuery({
              artifactRecords,
              db,
              context,
              queryExecutionId: queryExecution.id,
              queryInput: {
                departDate: pair.departDate,
                destinationCityCode: cityTarget.cityCode,
                returnDate: pair.returnDate
              },
              queryPriority,
              runDir,
              runId,
              runRow,
              strategy
            });

            probeCandidates.push(...created.createdCandidates);
            baseCandidates.push(...created.createdCandidates);
          } catch (queryError) {
            const message =
              queryError instanceof Error ? queryError.message : "Alternate city comparison query failed.";
            failQueryExecution(db, queryExecution.id, message);
            probeFailures.push(`${cityTarget.cityCode} ${pair.departDate}/${pair.returnDate}: ${message}`);
          }

          queryPriority += 1;
        }
      }

      const probeStatus =
        selectedCities.length === 0 || datePairs.length === 0
          ? "skipped"
          : probeCandidates.length > 0
            ? "completed"
            : probeFailures.length > 0
              ? "failed"
              : "skipped";
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: queryPriority,
        best_candidate_id:
          [...probeCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]?.id ??
          null,
        candidate_count: probeCandidates.length,
        failure_reason:
          probeStatus === "failed" && probeFailures.length > 0
            ? probeFailures.join(" | ")
            : null,
        finished_at: nowIso(),
        status: probeStatus,
        verified_candidate_count: 0
      });
    } else if (strategy.strategy_type === "alternate_return_city_summary") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const summaryPayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const sourceStrategy = [...strategies]
        .filter(
          (plannedStrategy) =>
            plannedStrategy.priority < strategy.priority &&
            plannedStrategy.strategy_type === "alternate_return_city_probe"
        )
        .sort((left, right) => right.priority - left.priority)[0] ?? null;
      const pass1Snapshot =
        latestAnalysisSnapshot ??
        getLatestRunAnalysisSnapshot(db, runId, "pass1_market_scan");
      const targetCities = buildAlternateReturnCityTargets({
        candidateCityLimit: Number(summaryPayload.candidateCityLimit ?? 2),
        destinationCityCode: resolveCityCode(runRow.outbound_destination_city),
        longStopFollowupSnapshot: getLatestRunAnalysisSnapshot(db, runId, "multi_city_long_stop_followup"),
        longStopValidationSnapshot: getLatestRunAnalysisSnapshot(db, runId, "multi_city_long_stop_validation"),
        multiCityRankingSnapshot: getLatestRunAnalysisSnapshot(db, runId, "multi_city_verification_rank"),
        pass1Snapshot
      });
      const comparedCities = buildAlternateReturnCitySummary(
        db,
        sourceStrategy?.id ?? null,
        targetCities
      );

      insertRunAnalysisSnapshot(db, {
        analysisType: "alternate_return_city_summary",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "alternate_return_city_summary",
          cityTargetCount: targetCities.length,
          comparedCities,
          datePairLimit: Number(summaryPayload.datePairLimit ?? 3),
          sourceStrategyExecutionId: sourceStrategy?.id ?? null
        }
      });

      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        best_candidate_id: null,
        candidate_count: comparedCities.length,
        failure_reason: null,
        finished_at: nowIso(),
        status: comparedCities.length > 0 ? "completed" : "skipped",
        verified_candidate_count: comparedCities.filter((entry) => entry.candidateCount > 0).length
      });
    } else if (strategy.strategy_type === "recommendation_date_coverage_probe") {
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: 0,
        failure_reason: null,
        finished_at: null,
        started_at: nowIso(),
        status: "running"
      });

      const coveragePayload = parseStrategyPayload(
        strategy.strategy_payload_json ?? strategy.strategyPayloadJson ?? "{}"
      );
      const candidateReviewLimit = Math.max(
        1,
        Number(coveragePayload.candidateReviewLimit ?? 12)
      );
      const routeTargetLimit = Math.max(1, Number(coveragePayload.routeTargetLimit ?? 3));
      const dateVariationLimit = Math.max(1, Number(coveragePayload.dateVariationLimit ?? 3));
      const coverageSourceStrategyIds = collectStrategyIdsByTypeBeforePriority(
        strategies,
        strategy.priority,
        [
          "packaged_direct_sweep",
          "packaged_return_option_expansion",
          "packaged_departure_anchor_followup",
          "packaged_stopover_followup",
          "anchored_multi_city_probe",
          "multi_city_long_stop_followup",
          "alternate_return_city_probe"
        ],
        { requireCandidates: true }
      );
      const coverageTargetsSummary = buildRecommendationDateCoverageTargets({
        candidateReviewLimit,
        db,
        routeTargetLimit,
        runSeed: `${runId}:${strategy.id}:coverage`,
        strategyIds:
          coverageSourceStrategyIds.length > 0 ? coverageSourceStrategyIds : [baselineStrategy.id]
      });
      const coverageCandidates = [];
      const coverageFailures = [];
      const coverageRouteResults = [];
      let executedCoverageQueryCount = 0;

      for (const routeTarget of coverageTargetsSummary.routeTargets) {
        const routeResult = {
          candidateCount: 0,
          candidateFamilyId: routeTarget.candidateFamilyId,
          currentVariantCount: routeTarget.currentVariantCount,
          departDate: routeTarget.departDate,
          destinationCityCode: routeTarget.destinationCityCode,
          displayedAmount: routeTarget.displayedAmount,
          familyKey: routeTarget.familyKey,
          failureCount: 0,
          queries: [],
          returnDate: routeTarget.returnDate,
          selectionReasons: routeTarget.selectionReasons ?? [],
          stopoverCityCode: routeTarget.stopoverCityCode ?? null,
          stopoverDepartDate: routeTarget.stopoverDepartDate ?? null,
          targetType: routeTarget.targetType
        };

        if (routeTarget.targetType === "anchored_multi_city") {
          const stopoverDateVariations = enumerateAnchoredMultiCityStopDates({
            departDate: routeTarget.departDate,
            limit: dateVariationLimit + 1,
            maxStopDays: runRow.stop_duration_max_days,
            minStopDays: runRow.stop_duration_min_days,
            returnDate: routeTarget.returnDate,
            runSeed: `${runId}:${strategy.id}:${routeTarget.familyKey}:stopover`
          }).filter((dateValue) => dateValue !== routeTarget.stopoverDepartDate);

          if (stopoverDateVariations.length === 0) {
            routeResult.queries.push({
              candidateCount: 0,
              reason:
                "No alternate anchored stopover dates were available inside the current stop window for this route.",
              status: "skipped"
            });
            coverageRouteResults.push(routeResult);
            continue;
          }

          for (const stopoverDepartDate of stopoverDateVariations) {
            const queryExecution = insertQueryExecution(db, {
              parentQueryExecutionId: null,
              priority: executedCoverageQueryCount,
              queryInput: {
                candidateFamilyId: routeTarget.candidateFamilyId,
                coverageTargetType: routeTarget.targetType,
                dateVariationLimit,
                departDate: routeTarget.departDate,
                destinationCityCode: routeTarget.destinationCityCode,
                familyKey: routeTarget.familyKey,
                finalReturnAirport: runRow.return_destination_airport,
                returnDate: routeTarget.returnDate,
                stopoverCityCode: routeTarget.stopoverCityCode,
                stopoverCityName: routeTarget.stopoverCityName ?? null,
                stopoverDepartDate
              },
              queryType: "anchored_multi_city",
              reason: `Recommendation date coverage probe for ${routeTarget.familyKey} using anchored stopover ${routeTarget.stopoverCityCode ?? "unknown"} on ${stopoverDepartDate}.`,
              searchRunId: runId,
              source: "derived_from_result",
              strategyExecutionId: strategy.id
            });

            try {
              const created = await executeAnchoredMultiCityQuery({
                artifactRecords,
                context,
                db,
                queryExecutionId: queryExecution.id,
                queryInput: {
                  departDate: routeTarget.departDate,
                  destinationCityCode: routeTarget.destinationCityCode,
                  finalReturnAirport: runRow.return_destination_airport,
                  returnDate: routeTarget.returnDate,
                  segmentOptionLimit: 1,
                  stopoverCityCode: routeTarget.stopoverCityCode,
                  stopoverDepartDate
                },
                queryPriority: executedCoverageQueryCount,
                runDir,
                runId,
                runRow,
                strategy
              });

              coverageCandidates.push(...created);
              baseCandidates.push(...created);
              routeResult.candidateCount += created.length;
              routeResult.queries.push({
                candidateCount: created.length,
                status: created.length > 0 ? "completed" : "skipped",
                stopoverDepartDate
              });
            } catch (queryError) {
              const message =
                queryError instanceof Error ? queryError.message : "Recommendation date coverage query failed.";
              failQueryExecution(db, queryExecution.id, message);
              coverageFailures.push(
                `${routeTarget.familyKey}@${stopoverDepartDate}: ${message}`
              );
              routeResult.failureCount += 1;
              routeResult.queries.push({
                candidateCount: 0,
                reason: message,
                status: "failed",
                stopoverDepartDate
              });
            }

            executedCoverageQueryCount += 1;
          }
        } else {
          const coverageDatePairs = enumerateRecommendationCoverageDatePairs({
            departDate: routeTarget.departDate,
            limit: dateVariationLimit,
            returnDate: routeTarget.returnDate,
            runRow,
            runSeed: `${runId}:${strategy.id}:${routeTarget.familyKey}:pair`
          });

          if (coverageDatePairs.length === 0) {
            routeResult.queries.push({
              candidateCount: 0,
              reason: "No nearby date pairs were available inside the current session window for this route.",
              status: "skipped"
            });
            coverageRouteResults.push(routeResult);
            continue;
          }

          for (const pair of coverageDatePairs) {
            const queryExecution = insertQueryExecution(db, {
              parentQueryExecutionId: null,
              priority: executedCoverageQueryCount,
              queryInput: {
                candidateFamilyId: routeTarget.candidateFamilyId,
                coverageTargetType: routeTarget.targetType,
                dateVariationLimit,
                departDate: pair.departDate,
                destinationCityCode: routeTarget.destinationCityCode,
                familyKey: routeTarget.familyKey,
                returnDate: pair.returnDate
              },
              queryType: "direct_round_trip",
              reason: `Recommendation date coverage probe for ${routeTarget.familyKey} using nearby pair ${pair.departDate} to ${pair.returnDate}.`,
              searchRunId: runId,
              source: "derived_from_result",
              strategyExecutionId: strategy.id
            });

            try {
              const result = await executeDirectQuery({
                artifactRecords,
                context,
                db,
                queryExecutionId: queryExecution.id,
                queryInput: {
                  departDate: pair.departDate,
                  destinationCityCode: routeTarget.destinationCityCode,
                  returnDate: pair.returnDate
                },
                queryPriority: executedCoverageQueryCount,
                runDir,
                runId,
                runRow,
                strategy
              });

              coverageCandidates.push(...result.createdCandidates);
              baseCandidates.push(...result.createdCandidates);
              routeResult.candidateCount += result.createdCandidates.length;
              routeResult.queries.push({
                candidateCount: result.createdCandidates.length,
                departDate: pair.departDate,
                returnDate: pair.returnDate,
                status: result.createdCandidates.length > 0 ? "completed" : "skipped"
              });
            } catch (queryError) {
              const message =
                queryError instanceof Error ? queryError.message : "Recommendation date coverage query failed.";
              failQueryExecution(db, queryExecution.id, message);
              coverageFailures.push(
                `${routeTarget.familyKey}@${pair.departDate}__${pair.returnDate}: ${message}`
              );
              routeResult.failureCount += 1;
              routeResult.queries.push({
                candidateCount: 0,
                departDate: pair.departDate,
                reason: message,
                returnDate: pair.returnDate,
                status: "failed"
              });
            }

            executedCoverageQueryCount += 1;
          }
        }

        coverageRouteResults.push(routeResult);
      }

      insertRunAnalysisSnapshot(db, {
        analysisType: "recommendation_date_coverage_results",
        searchRunId: runRow.id,
        strategyExecutionId: strategy.id,
        summary: {
          analysedAt: nowIso(),
          analysisType: "recommendation_date_coverage_results",
          candidateReviewLimit,
          dateVariationLimit,
          reviewedRouteCount: coverageTargetsSummary.reviewedRouteCount,
          reviewedVariantCount: coverageTargetsSummary.reviewedVariantCount,
          routeTargetCount: coverageTargetsSummary.routeTargets.length,
          routeTargetLimit,
          routeTargets: coverageTargetsSummary.routeTargets.map((target) => ({
            candidateFamilyId: target.candidateFamilyId,
            currentVariantCount: target.currentVariantCount,
            departDate: target.departDate,
            destinationCityCode: target.destinationCityCode,
            displayedAmount: target.displayedAmount,
            familyKey: target.familyKey,
            returnDate: target.returnDate,
            selectionReasons: target.selectionReasons ?? [],
            stopoverCityCode: target.stopoverCityCode ?? null,
            stopoverCityName: target.stopoverCityName ?? null,
            stopoverDepartDate: target.stopoverDepartDate ?? null,
            targetType: target.targetType
          })),
          routeResults: coverageRouteResults,
          totalCreatedCandidateCount: coverageCandidates.length
        }
      });

      const coverageStatus =
        coverageTargetsSummary.routeTargets.length === 0
          ? "skipped"
          : coverageCandidates.length > 0
            ? "completed"
            : coverageFailures.length > 0
              ? "failed"
              : "skipped";
      updateStrategyStatus(db, strategy.id, {
        actual_search_cost: executedCoverageQueryCount,
        best_candidate_id:
          [...coverageCandidates].sort((left, right) => left.displayedAmount - right.displayedAmount)[0]
            ?.id ?? null,
        candidate_count: coverageCandidates.length,
        failure_reason:
          coverageStatus === "failed" && coverageFailures.length > 0
            ? coverageFailures.join(" | ")
            : null,
        finished_at: nowIso(),
        status: coverageStatus,
        verified_candidate_count: coverageRouteResults.filter((entry) => entry.candidateCount > 0).length
      });
    } else if (strategy.strategy_type === "stitched_followup") {
      deriveStitchedCandidates(db, runRow, strategy, baseCandidates);
    }
  }

  if (isRunCancelled(db, runId)) {
    writeWorkerState({
      activeRunId: null,
      lastError: null,
      lastHeartbeatAt: nowIso(),
      pid: null,
      startedAt: null,
      status: "idle"
    });
    shouldDispatchQueue = true;
    throw EARLY_EXIT;
  }

  insertRunAnalysisSnapshot(db, {
    analysisType: "strategy_outcome_telemetry",
    searchRunId: runRow.id,
    strategyExecutionId: baselineStrategy.id,
    summary: buildStrategyOutcomeTelemetry(db, runRow.id)
  });

  insertArtifacts(db, runId, baselineStrategy.id, nowIso(), artifactRecords);
  finalizeRunSuccess(db, runRow, isResume);
  shouldDispatchQueue = true;
} catch (error) {
  if (error && typeof error === "object" && error.earlyExit) {
    // The run state has already been updated explicitly.
  } else {
    const timestamp = nowIso();
    const currentUrl = page.url();
    const rawMessage = error instanceof Error ? error.message : "Trip.com baseline automation failed.";
    const message = `${rawMessage}${currentUrl ? ` Current URL: ${currentUrl}` : ""}`;
    const blocked = /login|captcha|challenge|authentication/i.test(message);

    await tryAppendStageArtifacts(
      page,
      runDir,
      blocked ? "blocked-failure-state" : "failure-state",
      blocked ? "Blocked Trip.com failure state" : "Trip.com failure state",
      artifactRecords
    );

    insertArtifacts(db, runId, strategyRow.id, timestamp, artifactRecords);

    db.prepare(
      `update strategy_execution
       set status = ?, finished_at = ?, failure_reason = ?
       where id = ?`
    ).run(blocked ? "blocked" : "failed", timestamp, message, activeStrategy.id);

    if (!blocked) {
      db.prepare(
        `update strategy_execution
         set status = 'cancelled', finished_at = ?, failure_reason = ?
         where search_run_id = ?
           and id <> ?
           and status in ('queued', 'running')`
      ).run(timestamp, "Run aborted after another strategy failed.", runId, activeStrategy.id);
    }

    db.prepare(
      `update search_run
       set status = ?, finished_at = ?, summary_text = ?, failure_reason = ?, recovery_state = ?, recovery_type = ?,
           recovery_reason = ?, blocked_at = ?, resume_available = ?, resume_mode = ?, resume_checkpoint_json = ?
       where id = ?`
    ).run(
      blocked ? "blocked" : "failed",
      blocked ? null : timestamp,
      blocked ? "Trip.com blocked the run and user recovery is required." : "Trip.com baseline automation failed.",
      message,
      blocked ? "pending" : "not_required",
      blocked ? "challenge_required" : null,
      blocked ? message : null,
      blocked ? timestamp : null,
      blocked ? 1 : 0,
      blocked ? "partial_restart" : null,
      blocked
        ? JSON.stringify({
            blockedStage: "strategy_execution",
            runId,
            strategyId: activeStrategy.id
          })
        : null,
      runId
    );

    db.prepare(
      `update session
       set lifecycle_state = ?, is_live = ?, next_refresh_at = ?, updated_at = ?
       where id = ?`
    ).run(
      blocked ? "needs_attention" : runRow.monitoring_state === "enabled" ? "live_idle" : "not_live",
      runRow.monitoring_state === "enabled" ? 1 : 0,
      !blocked && runRow.monitoring_state === "enabled"
        ? addMinutes(timestamp, Number(runRow.refresh_interval_hours ?? 12) * 60)
        : null,
      timestamp,
      runRow.session_id
    );

    refreshStrategyExperimentGroup(db, runRow.strategy_experiment_group_id);

    writeConnectionState({
      detail: message,
      lastCheckedAt: timestamp,
      lastUrl: currentUrl || "https://au.trip.com/flights/",
      state: blocked ? "blocked" : "unknown",
      updatedBy: "automation"
    });

    writeWorkerState({
      activeRunId: null,
      lastError: message,
      lastHeartbeatAt: timestamp,
      pid: null,
      startedAt: null,
      status: blocked ? "blocked" : "failed"
    });
    shouldDispatchQueue = !blocked;
  }
} finally {
  db.close();
  await context.close();

  if (shouldDispatchQueue) {
    requestQueuedRunDispatch();
  }
}
