import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  candidateFamilies,
  candidateLegs,
  candidateStopovers,
  itineraryCandidates,
  priceObservations,
  sessionShortlistEntries
} from "@/lib/db/schema/candidate";
import { searchRuns } from "@/lib/db/schema/run";

export async function listCandidatesForRun(runId: string) {
  const db = getDb();

  const candidates = db
    .select({
      id: itineraryCandidates.id,
      candidateFamilyId: itineraryCandidates.candidateFamilyId,
      bookingType: itineraryCandidates.bookingType,
      tripShape: itineraryCandidates.tripShape,
      outboundDestinationCity: itineraryCandidates.outboundDestinationCity,
      returnOriginCity: itineraryCandidates.returnOriginCity,
      displayedDisplayCurrency: itineraryCandidates.displayedDisplayCurrency,
      displayedDisplayAmount: itineraryCandidates.displayedDisplayAmount,
      latestVerificationStatus: itineraryCandidates.latestVerificationStatus,
      stopCount: itineraryCandidates.stopCount,
      intentionalStopCount: itineraryCandidates.intentionalStopCount,
      fareClassSummary: itineraryCandidates.fareClassSummary,
      totalTravelMinutes: itineraryCandidates.totalTravelMinutes,
      stitchedRiskLevel: itineraryCandidates.stitchedRiskLevel,
      riskNotes: itineraryCandidates.riskNotes,
      isCurrentBest: itineraryCandidates.isCurrentBest
    })
    .from(itineraryCandidates)
    .where(eq(itineraryCandidates.searchRunId, runId))
    .orderBy(
      asc(itineraryCandidates.displayedDisplayAmount),
      asc(itineraryCandidates.stopCount),
      desc(itineraryCandidates.lastSeenAt)
    )
    .all();

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const legs = db
    .select()
    .from(candidateLegs)
    .where(inArray(candidateLegs.itineraryCandidateId, candidateIds))
    .orderBy(asc(candidateLegs.itineraryCandidateId), asc(candidateLegs.legIndex))
    .all();
  const stopovers = db
    .select()
    .from(candidateStopovers)
    .where(inArray(candidateStopovers.itineraryCandidateId, candidateIds))
    .orderBy(asc(candidateStopovers.itineraryCandidateId), asc(candidateStopovers.stopIndex))
    .all();

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

  return candidates.map((candidate) => ({
    ...candidate,
    legs: legsByCandidateId.get(candidate.id) ?? [],
    stopovers: stopoversByCandidateId.get(candidate.id) ?? []
  }));
}

export async function listCandidatesForSession(sessionId: string) {
  const db = getDb();
  const latestRun = db
    .select({
      id: searchRuns.id
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .get();

  if (!latestRun) {
    return [];
  }

  const shortlistedFamilyIds = new Set(
    db
      .select({
        candidateFamilyId: sessionShortlistEntries.candidateFamilyId
      })
      .from(sessionShortlistEntries)
      .where(eq(sessionShortlistEntries.sessionId, sessionId))
      .all()
      .map((entry) => entry.candidateFamilyId)
  );

  const candidates = await listCandidatesForRun(latestRun.id);

  return candidates.map((candidate) => ({
    ...candidate,
    isShortlisted: shortlistedFamilyIds.has(candidate.candidateFamilyId),
    runId: latestRun.id
  }));
}

export async function getCandidateById(candidateId: string, sessionId?: string) {
  const db = getDb();
  const candidate = db
    .select()
    .from(itineraryCandidates)
    .where(eq(itineraryCandidates.id, candidateId))
    .get();

  if (!candidate) {
    return null;
  }

  const family = db
    .select()
    .from(candidateFamilies)
    .where(eq(candidateFamilies.id, candidate.candidateFamilyId))
    .get();

  const legs = db
    .select()
    .from(candidateLegs)
    .where(eq(candidateLegs.itineraryCandidateId, candidateId))
    .orderBy(asc(candidateLegs.legIndex))
    .all();

  const stopovers = db
    .select()
    .from(candidateStopovers)
    .where(eq(candidateStopovers.itineraryCandidateId, candidateId))
    .orderBy(asc(candidateStopovers.stopIndex))
    .all();

  const observations = db
    .select()
    .from(priceObservations)
    .where(eq(priceObservations.itineraryCandidateId, candidateId))
    .orderBy(desc(priceObservations.observedAt))
    .all();

  const shortlistEntry = sessionId
    ? db
        .select()
        .from(sessionShortlistEntries)
        .where(
          and(
            eq(sessionShortlistEntries.sessionId, sessionId),
            eq(sessionShortlistEntries.candidateFamilyId, candidate.candidateFamilyId)
          )
        )
        .get()
    : null;

  return {
    candidate,
    family,
    legs,
    observations,
    shortlistEntry,
    stopovers
  };
}

export async function listCandidateFamilySummaries(sessionId: string) {
  const db = getDb();
  const families = db
    .select()
    .from(candidateFamilies)
    .where(eq(candidateFamilies.sessionId, sessionId))
    .orderBy(desc(candidateFamilies.lastSeenAt))
    .all();

  return families.map((family) => {
    const candidates = db
      .select({
        displayedDisplayAmount: itineraryCandidates.displayedDisplayAmount
      })
      .from(itineraryCandidates)
      .where(eq(itineraryCandidates.candidateFamilyId, family.id))
      .all();

    const latestRunStartedAt = db
      .select({
        startedAt: searchRuns.startedAt
      })
      .from(searchRuns)
      .innerJoin(itineraryCandidates, eq(itineraryCandidates.searchRunId, searchRuns.id))
      .where(eq(itineraryCandidates.candidateFamilyId, family.id))
      .orderBy(desc(searchRuns.startedAt))
      .get()?.startedAt ?? null;

    return {
      bookingType: family.bookingType,
      candidateCount: candidates.length,
      familyId: family.id,
      familyKey: family.familyKey,
      firstSeenAt: family.firstSeenAt,
      lastSeenAt: family.lastSeenAt,
      latestRunStartedAt,
      lowestDisplayedAmount:
        candidates.length > 0
          ? Math.min(...candidates.map((candidate) => candidate.displayedDisplayAmount))
          : null,
      tripShape: family.tripShape
    };
  });
}
