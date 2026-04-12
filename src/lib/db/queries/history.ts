import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  candidateFamilies,
  candidateLegs,
  itineraryCandidates,
  priceObservations,
  sessionShortlistEntries
} from "@/lib/db/schema/candidate";
import { searchRuns } from "@/lib/db/schema/run";

export type SessionRunTrendPoint = {
  candidateId: string;
  currency: string;
  outboundDepartureAt: string | null;
  outboundDestinationCity: string;
  price: number;
  returnDepartureAt: string | null;
  runId: string;
  scanDate: string;
  totalCandidatesFound: number;
  totalCandidatesVerified: number;
};

export async function listRunHistoryForSession(sessionId: string) {
  const db = getDb();
  const runs = db
    .select()
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .all();

  return runs.map((run, index) => {
    const previousRun = runs[index + 1] ?? null;
    const delta =
      previousRun && previousRun.totalCandidatesFound !== null
        ? run.totalCandidatesFound - previousRun.totalCandidatesFound
        : null;

    return {
      ...run,
      candidateDelta: delta
    };
  });
}

export async function listRecentPriceObservationsForSession(sessionId: string) {
  const db = getDb();
  const families = db
    .select()
    .from(candidateFamilies)
    .where(eq(candidateFamilies.sessionId, sessionId))
    .all();

  const familyIds = new Set(families.map((family) => family.id));
  const observations = db
    .select()
    .from(priceObservations)
    .orderBy(desc(priceObservations.observedAt))
    .all();

  return observations
    .map((observation) => {
      const candidate = db
        .select({
          candidateFamilyId: itineraryCandidates.candidateFamilyId,
          displayedDisplayCurrency: itineraryCandidates.displayedDisplayCurrency,
          outboundDestinationCity: itineraryCandidates.outboundDestinationCity
        })
        .from(itineraryCandidates)
        .where(eq(itineraryCandidates.id, observation.itineraryCandidateId))
        .get();

      if (!candidate || !familyIds.has(candidate.candidateFamilyId)) {
        return null;
      }

      return {
        candidateFamilyId: candidate.candidateFamilyId,
        currency: observation.displayCurrency,
        displayAmount: observation.displayAmount,
        observedAt: observation.observedAt,
        outboundDestinationCity: candidate.outboundDestinationCity,
        priceKind: observation.priceKind
      };
    })
    .filter(
      (
        observation
      ): observation is {
        candidateFamilyId: string;
        currency: string;
        displayAmount: number;
        observedAt: string;
        outboundDestinationCity: string;
        priceKind: string;
      } => observation !== null
    )
    .slice(0, 8);
}

export async function listCompletedRunTrendForSession(
  sessionId: string
): Promise<SessionRunTrendPoint[]> {
  const db = getDb();
  const completedRuns = db
    .select({
      bestCandidateId: searchRuns.bestCandidateId,
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status,
      totalCandidatesFound: searchRuns.totalCandidatesFound,
      totalCandidatesVerified: searchRuns.totalCandidatesVerified
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .all()
    .filter((run) => run.status === "completed" && Boolean(run.bestCandidateId));

  if (completedRuns.length === 0) {
    return [];
  }

  const candidateIds = completedRuns
    .map((run) => run.bestCandidateId)
    .filter((candidateId): candidateId is string => Boolean(candidateId));
  const candidates = db
    .select({
      displayedDisplayAmount: itineraryCandidates.displayedDisplayAmount,
      displayedDisplayCurrency: itineraryCandidates.displayedDisplayCurrency,
      id: itineraryCandidates.id,
      outboundDestinationCity: itineraryCandidates.outboundDestinationCity
    })
    .from(itineraryCandidates)
    .where(inArray(itineraryCandidates.id, candidateIds))
    .all();

  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const legs = db
    .select()
    .from(candidateLegs)
    .where(inArray(candidateLegs.itineraryCandidateId, candidateIds))
    .orderBy(asc(candidateLegs.itineraryCandidateId), asc(candidateLegs.legIndex))
    .all();
  const legsByCandidateId = new Map<string, typeof legs>();

  for (const leg of legs) {
    const current = legsByCandidateId.get(leg.itineraryCandidateId) ?? [];
    current.push(leg);
    legsByCandidateId.set(leg.itineraryCandidateId, current);
  }

  return completedRuns
    .slice()
    .reverse()
    .map((run) => {
      const candidate = candidateMap.get(run.bestCandidateId!);

      if (!candidate) {
        return null;
      }

      const runLegs = legsByCandidateId.get(candidate.id) ?? [];
      const outboundDepartureAt =
        runLegs.find((leg) => leg.segmentGroup === "outbound")?.departureAt ?? null;
      const returnDepartureAt =
        runLegs.find((leg) => leg.segmentGroup === "return")?.departureAt ?? null;

      return {
        candidateId: candidate.id,
        currency: candidate.displayedDisplayCurrency,
        outboundDepartureAt,
        outboundDestinationCity: candidate.outboundDestinationCity,
        price: candidate.displayedDisplayAmount,
        returnDepartureAt,
        runId: run.id,
        scanDate: run.startedAt,
        totalCandidatesFound: run.totalCandidatesFound,
        totalCandidatesVerified: run.totalCandidatesVerified
      };
    })
    .filter((point): point is SessionRunTrendPoint => point !== null);
}

export async function getSessionHistorySnapshot(sessionId: string) {
  const db = getDb();
  const [runs, recentPrices, runTrend] = await Promise.all([
    listRunHistoryForSession(sessionId),
    listRecentPriceObservationsForSession(sessionId),
    listCompletedRunTrendForSession(sessionId)
  ]);

  const shortlistCount = db
    .select()
    .from(sessionShortlistEntries)
    .where(eq(sessionShortlistEntries.sessionId, sessionId))
    .all().length;

  return {
    recentPrices,
    runs,
    runTrend,
    shortlistCount
  };
}
