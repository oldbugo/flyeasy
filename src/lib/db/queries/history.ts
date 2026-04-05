import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  candidateFamilies,
  itineraryCandidates,
  priceObservations,
  sessionShortlistEntries
} from "@/lib/db/schema/candidate";
import { searchRuns } from "@/lib/db/schema/run";

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

export async function getSessionHistorySnapshot(sessionId: string) {
  const db = getDb();
  const [runs, recentPrices] = await Promise.all([
    listRunHistoryForSession(sessionId),
    listRecentPriceObservationsForSession(sessionId)
  ]);

  const shortlistCount = db
    .select()
    .from(sessionShortlistEntries)
    .where(eq(sessionShortlistEntries.sessionId, sessionId))
    .all().length;

  return {
    recentPrices,
    runs,
    shortlistCount
  };
}
