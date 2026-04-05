import { sql } from "drizzle-orm";

import { createId } from "./ids";
import { getDb } from "./client";
import { computeNextRefreshAt } from "@/lib/monitoring/refresh";
import {
  candidateFamilies,
  itineraryCandidates,
  priceObservations,
  sessionShortlistEntries
} from "./schema/candidate";
import { searchRuns, strategyExecutions } from "./schema/run";
import { sessionCityPreferences, sessions } from "./schema/session";

function nowIso() {
  return new Date().toISOString();
}

export async function ensureDevelopmentSeed() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const db = getDb();
  const existingCount = db.select({ count: sql<number>`count(*)` }).from(sessions).get();

  if ((existingCount?.count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();

  const sessionAId = createId("session");
  const sessionBId = createId("session");
  const runAId = createId("run");
  const runBId = createId("run");
  const strategyAId = createId("strategy");
  const strategyBId = createId("strategy");
  const familyAId = createId("family");
  const familyBId = createId("family");
  const candidateAId = createId("candidate");
  const candidateBId = createId("candidate");

  db.insert(sessions).values([
      {
        id: sessionAId,
        name: "China April Hunt",
        lifecycleState: "live_idle",
        monitoringState: "enabled",
        isLive: true,
        originAirport: "MEL",
        outboundDestinationCity: "Guangzhou",
        returnDestinationAirport: "MEL",
        returnOriginMode: "any_mainland_city",
        returnOriginCity: null,
        departureStartDate: "2026-04-05",
        departureEndDate: "2026-04-15",
        durationMinDays: 21,
        durationMaxDays: 35,
        returnStartDate: null,
        returnEndDate: null,
        layoverScope: "mainland_china",
        maxStops: 2,
        stopDurationMinDays: 1,
        stopDurationMaxDays: 5,
        bookingMode: "both",
        searchIntensity: "balanced",
        cabinPolicy: "any",
        notes: "New low found after a cheaper return via a mainland stopover.",
        refreshIntervalHours: 12,
        nextRefreshAt: computeNextRefreshAt(createdAt, 12),
        lastRunStartedAt: createdAt,
        lastRunFinishedAt: createdAt,
        lastSuccessfulRunId: runAId,
        currentBestCandidateId: candidateAId,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: sessionBId,
        name: "Flexible Guangzhou Backup",
        lifecycleState: "not_live",
        monitoringState: "disabled",
        isLive: false,
        originAirport: "MEL",
        outboundDestinationCity: "Guangzhou",
        returnDestinationAirport: "MEL",
        returnOriginMode: "fixed_city",
        returnOriginCity: "CAN",
        departureStartDate: "2026-05-01",
        departureEndDate: "2026-05-30",
        durationMinDays: 14,
        durationMaxDays: 28,
        returnStartDate: null,
        returnEndDate: null,
        layoverScope: "mainland_china",
        maxStops: 1,
        stopDurationMinDays: 0,
        stopDurationMaxDays: 3,
        bookingMode: "single_booking",
        searchIntensity: "low",
        cabinPolicy: "any",
        notes: "Monitoring paused. Resume later to refresh displayed fares.",
        refreshIntervalHours: 12,
        nextRefreshAt: null,
        lastRunStartedAt: createdAt,
        lastRunFinishedAt: createdAt,
        lastSuccessfulRunId: runBId,
        currentBestCandidateId: candidateBId,
        createdAt,
        updatedAt: createdAt
      }
    ]).run();

  db.insert(sessionCityPreferences).values([
      {
        id: createId("session_city_pref"),
        sessionId: sessionAId,
        cityCode: "SHA",
        role: "preferred_stopover_city",
        priority: 0,
        createdAt
      },
      {
        id: createId("session_city_pref"),
        sessionId: sessionAId,
        cityCode: "BJS",
        role: "excluded_stopover_city",
        priority: 0,
        createdAt
      }
    ]).run();

  db.insert(searchRuns).values([
      {
        id: runAId,
        sessionId: sessionAId,
        runMode: "interactive",
        status: "completed",
        triggerSource: "manual",
        startedAt: createdAt,
        finishedAt: createdAt,
        searchSnapshotJson: JSON.stringify({ originQuery: "Melbourne", destinationQuery: "Guangzhou" }),
        totalStrategiesPlanned: 1,
        totalStrategiesExecuted: 1,
        totalCandidatesFound: 1,
        totalCandidatesVerified: 0,
        bestCandidateId: candidateAId,
        summaryText: "Cheapest current displayed fare uses a Shanghai stopover.",
        failureReason: null,
        recoveryState: "not_required",
        recoveryType: null,
        recoveryReason: null,
        blockedAt: null,
        resumeAvailable: false,
        resumeMode: null,
        resumeCheckpointJson: null,
        recoveryCompletedAt: null,
        createdAt
      },
      {
        id: runBId,
        sessionId: sessionBId,
        runMode: "interactive",
        status: "completed",
        triggerSource: "manual",
        startedAt: createdAt,
        finishedAt: createdAt,
        searchSnapshotJson: JSON.stringify({ originQuery: "Melbourne", destinationQuery: "Guangzhou" }),
        totalStrategiesPlanned: 1,
        totalStrategiesExecuted: 1,
        totalCandidatesFound: 1,
        totalCandidatesVerified: 0,
        bestCandidateId: candidateBId,
        summaryText: "Monitoring paused after the last completed search.",
        failureReason: null,
        recoveryState: "not_required",
        recoveryType: null,
        recoveryReason: null,
        blockedAt: null,
        resumeAvailable: false,
        resumeMode: null,
        resumeCheckpointJson: null,
        recoveryCompletedAt: null,
        createdAt
      }
    ]).run();

  db.insert(strategyExecutions).values([
      {
        id: strategyAId,
        searchRunId: runAId,
        parentStrategyExecutionId: null,
        strategyType: "packaged_baseline",
        sourceType: "system",
        priority: 0,
        reason: "Default baseline search",
        strategyPayloadJson: JSON.stringify({ route: "MEL-CAN-MEL" }),
        status: "completed",
        estimatedSearchCost: 1,
        actualSearchCost: 1,
        startedAt: createdAt,
        finishedAt: createdAt,
        candidateCount: 1,
        verifiedCandidateCount: 0,
        bestCandidateId: candidateAId,
        failureReason: null
      },
      {
        id: strategyBId,
        searchRunId: runBId,
        parentStrategyExecutionId: null,
        strategyType: "packaged_baseline",
        sourceType: "system",
        priority: 0,
        reason: "Default baseline search",
        strategyPayloadJson: JSON.stringify({ route: "MEL-CAN-MEL" }),
        status: "completed",
        estimatedSearchCost: 1,
        actualSearchCost: 1,
        startedAt: createdAt,
        finishedAt: createdAt,
        candidateCount: 1,
        verifiedCandidateCount: 0,
        bestCandidateId: candidateBId,
        failureReason: null
      }
    ]).run();

  db.insert(candidateFamilies).values([
      {
        id: familyAId,
        sessionId: sessionAId,
        familyKey: "mel-can-mel-mu-sha-stop",
        bookingType: "single_booking",
        tripShape: "round_trip",
        routeSummaryJson: JSON.stringify({ carrier: "China Eastern Airlines", stopoverCity: "Shanghai" }),
        firstSeenAt: createdAt,
        lastSeenAt: createdAt
      },
      {
        id: familyBId,
        sessionId: sessionBId,
        familyKey: "mel-can-mel-cz-direct",
        bookingType: "single_booking",
        tripShape: "round_trip",
        routeSummaryJson: JSON.stringify({ carrier: "China Southern Airlines", stopoverCity: null }),
        firstSeenAt: createdAt,
        lastSeenAt: createdAt
      }
    ]).run();

  db.insert(itineraryCandidates).values([
      {
        id: candidateAId,
        searchRunId: runAId,
        strategyExecutionId: strategyAId,
        candidateFamilyId: familyAId,
        dedupeKey: "mel-pvg-can-can-nkg-mel-mu",
        bookingType: "single_booking",
        tripShape: "round_trip",
        outboundDestinationCity: "Guangzhou",
        returnOriginCity: "Guangzhou",
        stopCount: 2,
        intentionalStopCount: 1,
        displayedSourceCurrency: "AUD",
        displayedSourceAmount: 954,
        displayedDisplayCurrency: "AUD",
        displayedDisplayAmount: 954,
        latestVerifiedSourceCurrency: null,
        latestVerifiedSourceAmount: null,
        latestVerifiedDisplayCurrency: null,
        latestVerifiedDisplayAmount: null,
        latestVerificationStatus: "not_checked",
        fareClassSummary: "Economy",
        totalTravelMinutes: 910,
        stitchedRiskLevel: null,
        riskNotes: "Current best displayed fare for this session.",
        tripcomResumeUrl: "https://au.trip.com/flights/",
        tripcomResumeToken: null,
        firstSeenAt: createdAt,
        lastSeenAt: createdAt,
        lastRankedAt: createdAt,
        isCurrentBest: true
      },
      {
        id: candidateBId,
        searchRunId: runBId,
        strategyExecutionId: strategyBId,
        candidateFamilyId: familyBId,
        dedupeKey: "mel-can-mel-cz-direct",
        bookingType: "single_booking",
        tripShape: "round_trip",
        outboundDestinationCity: "Guangzhou",
        returnOriginCity: "Guangzhou",
        stopCount: 0,
        intentionalStopCount: 0,
        displayedSourceCurrency: "AUD",
        displayedSourceAmount: 1571,
        displayedDisplayCurrency: "AUD",
        displayedDisplayAmount: 1571,
        latestVerifiedSourceCurrency: null,
        latestVerifiedSourceAmount: null,
        latestVerifiedDisplayCurrency: null,
        latestVerifiedDisplayAmount: null,
        latestVerificationStatus: "not_checked",
        fareClassSummary: "Economy",
        totalTravelMinutes: 560,
        stitchedRiskLevel: null,
        riskNotes: "Cheaper alternatives may appear once monitoring resumes.",
        tripcomResumeUrl: "https://au.trip.com/flights/",
        tripcomResumeToken: null,
        firstSeenAt: createdAt,
        lastSeenAt: createdAt,
        lastRankedAt: createdAt,
        isCurrentBest: true
      }
    ]).run();

  db.insert(priceObservations).values([
      {
        id: createId("price_obs"),
        itineraryCandidateId: candidateAId,
        searchRunId: runAId,
        verificationAttemptId: null,
        priceKind: "displayed_search_price",
        sourceCurrency: "AUD",
        sourceAmount: 954,
        displayCurrency: "AUD",
        displayAmount: 954,
        fxProvider: null,
        fxRate: null,
        fxRateTimestamp: null,
        observedAt: createdAt
      },
      {
        id: createId("price_obs"),
        itineraryCandidateId: candidateBId,
        searchRunId: runBId,
        verificationAttemptId: null,
        priceKind: "displayed_search_price",
        sourceCurrency: "AUD",
        sourceAmount: 1571,
        displayCurrency: "AUD",
        displayAmount: 1571,
        fxProvider: null,
        fxRate: null,
        fxRateTimestamp: null,
        observedAt: createdAt
      }
    ]).run();

  db.insert(sessionShortlistEntries).values({
      id: createId("shortlist"),
      sessionId: sessionAId,
      candidateFamilyId: familyAId,
      itineraryCandidateId: candidateAId,
      status: "top_pick",
      userNote: "Good stopover fit for the current hunt.",
      createdAt,
      updatedAt: createdAt
    }).run();
}
