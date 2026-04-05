import { and, asc, desc, eq } from "drizzle-orm";

import { createId } from "@/lib/db/ids";
import { getDb } from "@/lib/db/client";
import { listCandidatesForRun } from "@/lib/db/queries/candidates";
import {
  candidateFamilies,
  candidateLegs,
  candidateStopovers,
  itineraryCandidates,
  priceObservations
} from "@/lib/db/schema/candidate";
import {
  queryExecutions,
  runAnalysisSnapshots,
  searchRuns,
  strategyExecutions
} from "@/lib/db/schema/run";
import { refreshStrategyExperimentGroup } from "@/lib/runs/strategy-experiments";
import { sessions } from "@/lib/db/schema/session";

const RUN_QUEUE_MS = 2000;
const RUN_COMPLETE_MS = 8000;

function nowIso() {
  return new Date().toISOString();
}

function elapsedMs(startedAt: string) {
  return Date.now() - new Date(startedAt).getTime();
}

function addMinutes(baseIso: string, minutes: number) {
  return new Date(new Date(baseIso).getTime() + minutes * 60_000).toISOString();
}

function formatQueryTypeLabel(queryType: string) {
  if (queryType === "direct_round_trip") {
    return "Direct sweep";
  }

  if (queryType === "return_option_expansion") {
    return "Return option expansion";
  }

  if (queryType === "long_stop_stopover_round_trip") {
    return "Long-stop follow-up";
  }

  if (queryType === "stopover_filtered_round_trip") {
    return "Multi-city verification";
  }

  return "Stopover follow-up";
}

function usesDeterministicEngine(strategyPayloadJson: string) {
  try {
    const payload = JSON.parse(strategyPayloadJson) as {
      engine?: string;
    };

    return payload.engine !== "tripcom_live";
  } catch {
    return true;
  }
}

function buildTemplates(session: typeof sessions.$inferSelect) {
  const preferredStopoverCity = "SHA";
  const secondaryStopoverCity = "CAN";

  return [
    {
      familyKey: `${session.originAirport}-${preferredStopoverCity}-${session.outboundDestinationCity}-pkg-best`,
      dedupeKey: `${session.originAirport}-${preferredStopoverCity}-${session.outboundDestinationCity}-${secondaryStopoverCity}-best`,
      stopCities: [preferredStopoverCity],
      intentionalStopCount: 1,
      stopCount: 1,
      displayedAmount: 954,
      riskNotes: `Deterministic best packaged fare via ${preferredStopoverCity}.`,
      totalTravelMinutes: 910
    },
    {
      familyKey: `${session.originAirport}-${session.outboundDestinationCity}-direct-core`,
      dedupeKey: `${session.originAirport}-${session.outboundDestinationCity}-direct-core`,
      stopCities: [],
      intentionalStopCount: 0,
      stopCount: 0,
      displayedAmount: 1571,
      riskNotes: "Direct baseline comparison option.",
      totalTravelMinutes: 560
    },
    {
      familyKey: `${session.originAirport}-${secondaryStopoverCity}-${session.outboundDestinationCity}-pkg-alt`,
      dedupeKey: `${session.originAirport}-${secondaryStopoverCity}-${session.outboundDestinationCity}-pkg-alt`,
      stopCities: [secondaryStopoverCity],
      intentionalStopCount: 1,
      stopCount: 1,
      displayedAmount: 1046,
      riskNotes: `Alternative packaged fare via ${secondaryStopoverCity}.`,
      totalTravelMinutes: 845
    }
  ];
}

async function ensureDeterministicCandidates(runId: string) {
  const db = getDb();
  const run = db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();

  if (!run) {
    return [];
  }

  const strategy = db
    .select()
    .from(strategyExecutions)
    .where(eq(strategyExecutions.searchRunId, runId))
    .orderBy(asc(strategyExecutions.priority))
    .get();

  if (!strategy) {
    return [];
  }

  const session = db.select().from(sessions).where(eq(sessions.id, run.sessionId)).get();
  if (!session) {
    return [];
  }

  const existing = db
    .select()
    .from(itineraryCandidates)
    .where(eq(itineraryCandidates.searchRunId, runId))
    .orderBy(asc(itineraryCandidates.displayedDisplayAmount))
    .all();

  if (existing.length > 0) {
    return existing;
  }

  const templates = buildTemplates(session);
  const createdAt = nowIso();
  const departAt = `${session.departureStartDate}T08:00:00.000Z`;
  const returnAt = addMinutes(departAt, 7 * 24 * 60);

  const createdCandidates = templates.map((template, index) => {
    let familyId = db
      .select()
      .from(candidateFamilies)
      .where(
        and(
          eq(candidateFamilies.sessionId, session.id),
          eq(candidateFamilies.familyKey, template.familyKey)
        )
      )
      .get()?.id;

    if (!familyId) {
      familyId = createId("family");
      db.insert(candidateFamilies)
        .values({
          id: familyId,
          sessionId: session.id,
          familyKey: template.familyKey,
          bookingType: "single_booking",
          tripShape: "round_trip",
          routeSummaryJson: JSON.stringify({
            originAirport: session.originAirport,
            destinationCity: session.outboundDestinationCity,
            stopCities: template.stopCities
          }),
          firstSeenAt: createdAt,
          lastSeenAt: createdAt
        })
        .run();
    } else {
      db.update(candidateFamilies)
        .set({
          lastSeenAt: createdAt
        })
        .where(eq(candidateFamilies.id, familyId))
        .run();
    }

    const candidateId = createId("candidate");

    db.insert(itineraryCandidates)
      .values({
        id: candidateId,
        searchRunId: runId,
        strategyExecutionId: strategy.id,
        candidateFamilyId: familyId,
        dedupeKey: template.dedupeKey,
        bookingType: "single_booking",
        tripShape: "round_trip",
        outboundDestinationCity: session.outboundDestinationCity,
        returnOriginCity:
          session.returnOriginMode === "fixed_city"
            ? session.returnOriginCity
            : session.outboundDestinationCity,
        stopCount: template.stopCount,
        intentionalStopCount: template.intentionalStopCount,
        displayedSourceCurrency: "AUD",
        displayedSourceAmount: template.displayedAmount,
        displayedDisplayCurrency: "AUD",
        displayedDisplayAmount: template.displayedAmount,
        latestVerifiedSourceCurrency: null,
        latestVerifiedSourceAmount: null,
        latestVerifiedDisplayCurrency: null,
        latestVerifiedDisplayAmount: null,
        latestVerificationStatus: "not_checked",
        fareClassSummary: "Economy",
        totalTravelMinutes: template.totalTravelMinutes,
        stitchedRiskLevel: null,
        riskNotes: template.riskNotes,
        tripcomResumeUrl: null,
        tripcomResumeToken: null,
        firstSeenAt: createdAt,
        lastSeenAt: createdAt,
        lastRankedAt: createdAt,
        isCurrentBest: index === 0
      })
      .run();

    db.insert(candidateLegs)
      .values([
        {
          id: createId("leg"),
          itineraryCandidateId: candidateId,
          legIndex: 0,
          segmentGroup: "outbound",
          bookingReferenceGroup: "pkg_1",
          carrierCode: "MU",
          flightNumber: template.stopCities.length > 0 ? "MU738" : "CZ322",
          originAirport: session.originAirport,
          destinationAirport: template.stopCities[0] ?? "CAN",
          departureAt: departAt,
          arrivalAt: addMinutes(departAt, template.stopCities.length > 0 ? 600 : 560),
          cabinClass: "Economy",
          fareBrand: "Standard",
          baggageSummary: "Standard baggage",
          rawLegPayloadJson: null,
          createdAt
        },
        {
          id: createId("leg"),
          itineraryCandidateId: candidateId,
          legIndex: 1,
          segmentGroup: "return",
          bookingReferenceGroup: "pkg_1",
          carrierCode: "MU",
          flightNumber: template.stopCities.length > 0 ? "MU851" : "CZ321",
          originAirport: "CAN",
          destinationAirport: session.returnDestinationAirport,
          departureAt: returnAt,
          arrivalAt: addMinutes(returnAt, template.stopCities.length > 0 ? 610 : 560),
          cabinClass: "Economy",
          fareBrand: "Standard",
          baggageSummary: "Standard baggage",
          rawLegPayloadJson: null,
          createdAt
        }
      ])
      .run();

    if (template.stopCities.length > 0) {
      db.insert(candidateStopovers)
        .values({
          id: createId("stopover"),
          itineraryCandidateId: candidateId,
          stopIndex: 0,
          cityCode: template.stopCities[0],
          airportCode: template.stopCities[0],
          countryCode: "CN",
          arrivalAt: addMinutes(departAt, 360),
          departureAt: addMinutes(departAt, 540),
          durationMinutes: 180,
          isIntentional: true,
          isMainlandChina: true,
          createdAt
        })
        .run();
    }

    db.insert(priceObservations)
      .values({
        id: createId("price_obs"),
        itineraryCandidateId: candidateId,
        searchRunId: runId,
        verificationAttemptId: null,
        priceKind: "displayed_search_price",
        sourceCurrency: "AUD",
        sourceAmount: template.displayedAmount,
        displayCurrency: "AUD",
        displayAmount: template.displayedAmount,
        fxProvider: null,
        fxRate: null,
        fxRateTimestamp: null,
        observedAt: createdAt
      })
      .run();

    return db
      .select()
      .from(itineraryCandidates)
      .where(eq(itineraryCandidates.id, candidateId))
      .get();
  });

  const bestCandidate = createdCandidates[0];

  db.update(strategyExecutions)
    .set({
      status: "completed",
      finishedAt: createdAt,
      candidateCount: createdCandidates.length,
      verifiedCandidateCount: 0,
      bestCandidateId: bestCandidate?.id ?? null
    })
    .where(eq(strategyExecutions.id, strategy.id))
    .run();

  db.update(searchRuns)
    .set({
      status: "completed",
      finishedAt: createdAt,
      totalStrategiesExecuted: 1,
      totalCandidatesFound: createdCandidates.length,
      totalCandidatesVerified: 0,
      bestCandidateId: bestCandidate?.id ?? null,
      summaryText: `Deterministic placeholder execution completed with ${createdCandidates.length} candidates.`
    })
    .where(eq(searchRuns.id, runId))
    .run();

  db.update(sessions)
    .set({
      lifecycleState: session.monitoringState === "enabled" ? "live_idle" : "not_live",
      isLive: session.monitoringState === "enabled",
      lastRunFinishedAt: createdAt,
      lastSuccessfulRunId: runId,
      currentBestCandidateId: bestCandidate?.id ?? null,
      updatedAt: createdAt
    })
    .where(eq(sessions.id, session.id))
    .run();

  if (run.strategyExperimentGroupId) {
    refreshStrategyExperimentGroup(run.strategyExperimentGroupId);
  }

  return createdCandidates.filter(Boolean);
}

export async function syncDeterministicRun(runId: string) {
  const db = getDb();
  const run = db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();

  if (!run) {
    return null;
  }

  if (run.status === "cancelled" || run.status === "completed" || run.status === "failed") {
    return run;
  }

  const strategy = db
    .select()
    .from(strategyExecutions)
    .where(eq(strategyExecutions.searchRunId, runId))
    .orderBy(asc(strategyExecutions.priority))
    .get();

  if (strategy && !usesDeterministicEngine(strategy.strategyPayloadJson)) {
    return run;
  }

  const elapsed = elapsedMs(run.startedAt);
  const timestamp = nowIso();

  if (run.status === "queued" && elapsed >= RUN_QUEUE_MS) {
    db.update(searchRuns)
      .set({
        status: "running",
        summaryText: "Deterministic baseline strategy is now running."
      })
      .where(eq(searchRuns.id, runId))
      .run();

    if (strategy) {
      db.update(strategyExecutions)
        .set({
          status: "running"
        })
        .where(eq(strategyExecutions.id, strategy.id))
        .run();
    }
  }

  if (elapsed >= RUN_COMPLETE_MS) {
    await ensureDeterministicCandidates(runId);
  }

  return db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();
}

export async function stopRun(runId: string) {
  const db = getDb();
  const run = db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();

  if (!run) {
    return null;
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return run;
  }

  const timestamp = nowIso();

  db.update(searchRuns)
    .set({
      status: "cancelled",
      finishedAt: timestamp,
      summaryText: "Run cancelled by the user before automation completed."
    })
    .where(eq(searchRuns.id, runId))
    .run();

  db.update(strategyExecutions)
    .set({
      status: "cancelled",
      finishedAt: timestamp
    })
    .where(eq(strategyExecutions.searchRunId, runId))
    .run();

  const session = db.select().from(sessions).where(eq(sessions.id, run.sessionId)).get();
  if (session) {
    db.update(sessions)
      .set({
        lifecycleState: session.monitoringState === "enabled" ? "live_idle" : "not_live",
        isLive: session.monitoringState === "enabled",
        updatedAt: timestamp
      })
      .where(eq(sessions.id, session.id))
      .run();
  }

  if (run.strategyExperimentGroupId) {
    refreshStrategyExperimentGroup(run.strategyExperimentGroupId);
  }

  return db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();
}

export async function getRunProgress(runId: string) {
  const db = getDb();
  const strategy = db
    .select()
    .from(strategyExecutions)
    .where(eq(strategyExecutions.searchRunId, runId))
    .orderBy(asc(strategyExecutions.priority))
    .get();

  if (!strategy || usesDeterministicEngine(strategy.strategyPayloadJson)) {
    await syncDeterministicRun(runId);
  }

  const run = db.select().from(searchRuns).where(eq(searchRuns.id, runId)).get();

  if (!run) {
    return null;
  }

  const strategies = db
    .select()
    .from(strategyExecutions)
    .where(eq(strategyExecutions.searchRunId, runId))
    .orderBy(asc(strategyExecutions.priority))
    .all();

  const queries = db
    .select({
      failureReason: queryExecutions.failureReason,
      finishedAt: queryExecutions.finishedAt,
      id: queryExecutions.id,
      observedStopoverCitiesJson: queryExecutions.observedStopoverCitiesJson,
      priority: queryExecutions.priority,
      queryInputJson: queryExecutions.queryInputJson,
      querySource: queryExecutions.source,
      queryType: queryExecutions.queryType,
      reason: queryExecutions.reason,
      resultSummaryJson: queryExecutions.resultSummaryJson,
      startedAt: queryExecutions.startedAt,
      status: queryExecutions.status
    })
    .from(queryExecutions)
    .where(eq(queryExecutions.searchRunId, runId))
    .orderBy(asc(queryExecutions.startedAt), asc(queryExecutions.priority))
    .all();

  const analysisSnapshots = db
    .select({
      analysisType: runAnalysisSnapshots.analysisType,
      createdAt: runAnalysisSnapshots.createdAt,
      id: runAnalysisSnapshots.id,
      strategyExecutionId: runAnalysisSnapshots.strategyExecutionId,
      summaryJson: runAnalysisSnapshots.summaryJson
    })
    .from(runAnalysisSnapshots)
    .where(eq(runAnalysisSnapshots.searchRunId, runId))
    .orderBy(desc(runAnalysisSnapshots.createdAt))
    .all();

  const candidates = await listCandidatesForRun(runId);

  const events = [
    {
      id: `${run.id}:created`,
      at: run.createdAt,
      level: "info",
      message:
        strategies.some((strategy) => strategy.sourceType === "ai")
          ? "Run created from the session review screen with accepted suggestion input."
          : "Run created from the session review screen."
    }
  ];

  if (run.status === "running" || run.status === "completed") {
    events.push({
      id: `${run.id}:running`,
      at: run.startedAt,
      level: "info",
      message: usesDeterministicEngine(strategies[0]?.strategyPayloadJson ?? "{}")
        ? "Deterministic baseline strategy is running."
        : "Trip.com baseline search is running in the local automation worker."
    });
  }

  if (candidates.length > 0) {
    events.push({
      id: `${run.id}:candidates`,
      at: run.finishedAt ?? run.startedAt,
      level: "success",
      message: usesDeterministicEngine(strategies[0]?.strategyPayloadJson ?? "{}")
        ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} synthesized from deterministic placeholder execution.`
        : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} extracted from Trip.com results and persisted locally.`
    });
  }

  if (run.status === "cancelled") {
    events.push({
      id: `${run.id}:cancelled`,
      at: run.finishedAt ?? run.startedAt,
      level: "warning",
      message: "Run cancelled before placeholder execution completed."
    });
  }

  if (run.status === "completed") {
    events.push({
      id: `${run.id}:completed`,
      at: run.finishedAt ?? run.startedAt,
      level: "success",
      message: usesDeterministicEngine(strategies[0]?.strategyPayloadJson ?? "{}")
        ? "Run completed and results were persisted to SQLite."
        : "Live Trip.com run completed and results were persisted to SQLite."
    });
  }

  if (run.status === "blocked") {
    events.push({
      id: `${run.id}:blocked`,
      at: run.blockedAt ?? run.startedAt,
      level: "warning",
      message: run.recoveryReason ?? "Trip.com blocked the run and user recovery is required."
    });
  }

  if (run.recoveryCompletedAt) {
    events.push({
      id: `${run.id}:resumed`,
      at: run.recoveryCompletedAt,
      level: "success",
      message: "Recovery completed and the blocked run resumed successfully."
    });
  }

  const aiStrategyCount = strategies.filter((strategy) => strategy.sourceType === "ai").length;

  if (aiStrategyCount > 0) {
    events.push({
      id: `${run.id}:ai`,
      at: run.startedAt,
      level: "info",
      message: `${aiStrategyCount} accepted suggestion${aiStrategyCount === 1 ? " was" : "s were"} added to this run queue.`
    });
  }

  for (const snapshot of analysisSnapshots) {
    const summary = JSON.parse(snapshot.summaryJson);
    if (snapshot.analysisType === "pass1_market_scan") {
      const anchorCount = Array.isArray(summary?.recommendedDepartureAnchors)
        ? summary.recommendedDepartureAnchors.length
        : 0;

      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message:
          anchorCount > 0
            ? `Pass-1 analysis identified ${anchorCount} priority departure date anchor${anchorCount === 1 ? "" : "s"} for follow-up.`
            : "Pass-1 analysis completed without any anchored follow-up recommendations."
      });
      continue;
    }

    if (snapshot.analysisType === "baseline_return_option_expansion") {
      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message: `Baseline return-option expansion covered ${summary?.expandedFamilyCount ?? 0} candidate famil${summary?.expandedFamilyCount === 1 ? "y" : "ies"} across ${summary?.expandedQueryCount ?? 0} probe${summary?.expandedQueryCount === 1 ? "" : "s"}.`
      });
      continue;
    }

    if (snapshot.analysisType === "baseline_execution_efficiency") {
      const bestFareQueryNumber =
        typeof summary?.bestFareFirstSeenQueryNumber === "number"
          ? summary.bestFareFirstSeenQueryNumber
          : null;
      const familyCoverageAfterHalfBudget =
        typeof summary?.familyCoverageAfterHalfBudget === "number"
          ? Math.round(summary.familyCoverageAfterHalfBudget * 100)
          : null;

      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message: `${summary?.baselineLabel ?? "Baseline"} spent ${summary?.executedQueryCount ?? 0} direct-sweep quer${summary?.executedQueryCount === 1 ? "y" : "ies"}, found ${summary?.distinctFamilyCount ?? 0} candidate famil${summary?.distinctFamilyCount === 1 ? "y" : "ies"}${bestFareQueryNumber ? `, and first saw the cheapest fare at query ${bestFareQueryNumber}` : ""}${familyCoverageAfterHalfBudget !== null ? ` with ${familyCoverageAfterHalfBudget}% family coverage by halfway through the sweep` : ""}.`
      });
      continue;
    }

    if (snapshot.analysisType === "baseline_followup_handoff") {
      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message: `Baseline handoff shortlisted ${summary?.recommendedFamilyCount ?? 0} follow-up famil${summary?.recommendedFamilyCount === 1 ? "y" : "ies"} from ${summary?.totalCandidateFamilyCount ?? 0} baseline candidate famil${summary?.totalCandidateFamilyCount === 1 ? "y" : "ies"}.`
      });
      continue;
    }

    if (snapshot.analysisType === "multi_city_verification_rank") {
      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message: `Multi-city ranking reviewed ${summary?.reviewedCandidateCount ?? 0} baseline context${summary?.reviewedCandidateCount === 1 ? "" : "s"} and ranked ${Array.isArray(summary?.rankedCities) ? summary.rankedCities.length : 0} stopover cit${Array.isArray(summary?.rankedCities) && summary.rankedCities.length === 1 ? "y" : "ies"}.`
      });
      continue;
    }

    if (snapshot.analysisType === "multi_city_verification_results") {
      events.push({
        id: `${snapshot.id}:analysis`,
        at: snapshot.createdAt,
        level: "info",
        message: `Multi-city verification queried ${summary?.queriedSeedCount ?? 0} seed context${summary?.queriedSeedCount === 1 ? "" : "s"} across ${summary?.queriedCityCount ?? 0} cit${summary?.queriedCityCount === 1 ? "y" : "ies"} and produced ${summary?.candidateCount ?? 0} candidate${summary?.candidateCount === 1 ? "" : "s"}.`
      });
    }
  }

  for (const query of queries) {
    const summary = query.resultSummaryJson ? JSON.parse(query.resultSummaryJson) : null;

    events.push({
      id: `${query.id}:query`,
      at: query.startedAt,
      level: query.status === "failed" ? "error" : "info",
      message:
        query.status === "completed" && summary?.cheapestPrice
          ? `${formatQueryTypeLabel(query.queryType)} query completed with cheapest price AUD ${Number(summary.cheapestPrice).toLocaleString(
              "en-AU",
              { maximumFractionDigits: 0 }
            )}.`
          : query.status === "failed" && query.failureReason
            ? `${formatQueryTypeLabel(query.queryType)} query failed: ${query.failureReason}`
          : `${formatQueryTypeLabel(query.queryType)} query is ${query.status}.`
    });
  }

  return {
    analysisSnapshots,
    candidates,
    events: events.sort((left, right) => right.at.localeCompare(left.at)).slice(0, 10),
    queries,
    run,
    strategies
  };
}
