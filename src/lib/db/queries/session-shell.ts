import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { itineraryCandidates } from "@/lib/db/schema/candidate";
import { searchRuns } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import { ensureDevelopmentSeed } from "@/lib/db/seed";

export type SessionShellRecord = {
  activeRunCount: number;
  currentActiveRun: {
    id: string;
    status: string;
  } | null;
  currentBestFare: {
    amount: number;
    currency: string;
  } | null;
  hasRunnableActiveRun: boolean;
  session: {
    departureStartDate: string;
    durationMaxDays: number | null;
    durationMinDays: number | null;
    id: string;
    isLive: boolean;
    lifecycleState: string;
    monitoringState: string;
    name: string;
    originAirport: string;
    outboundDestinationCity: string;
    returnDestinationAirport: string;
    returnEndDate: string | null;
  };
};

export async function getSessionShellById(
  sessionId: string
): Promise<SessionShellRecord | null> {
  await ensureDevelopmentSeed();

  const db = getDb();
  const session = db
    .select({
      currentBestCandidateId: sessions.currentBestCandidateId,
      departureStartDate: sessions.departureStartDate,
      durationMaxDays: sessions.durationMaxDays,
      durationMinDays: sessions.durationMinDays,
      id: sessions.id,
      isLive: sessions.isLive,
      lifecycleState: sessions.lifecycleState,
      monitoringState: sessions.monitoringState,
      name: sessions.name
      ,
      originAirport: sessions.originAirport,
      outboundDestinationCity: sessions.outboundDestinationCity,
      returnDestinationAirport: sessions.returnDestinationAirport,
      returnEndDate: sessions.returnEndDate
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) {
    return null;
  }

  const currentBestCandidate = session.currentBestCandidateId
    ? db
        .select({
          amount: itineraryCandidates.displayedDisplayAmount,
          currency: itineraryCandidates.displayedDisplayCurrency,
          id: itineraryCandidates.id
        })
        .from(itineraryCandidates)
        .where(eq(itineraryCandidates.id, session.currentBestCandidateId))
        .get() ?? null
    : null;

  const currentBestFare = currentBestCandidate
    ? {
        amount: currentBestCandidate.amount,
        currency: currentBestCandidate.currency
      }
    : null;

  const activeRuns = db
    .select({
      id: searchRuns.id,
      startedAt: searchRuns.startedAt,
      status: searchRuns.status
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

      return right.startedAt.localeCompare(left.startedAt);
    });

  return {
    activeRunCount: activeRuns.length,
    currentActiveRun: activeRuns[0]
      ? {
          id: activeRuns[0].id,
          status: activeRuns[0].status
        }
      : null,
    currentBestFare,
    hasRunnableActiveRun: activeRuns.some(
      (activeRun) => activeRun.status === "queued" || activeRun.status === "running"
    ),
    session: {
      departureStartDate: session.departureStartDate,
      durationMaxDays: session.durationMaxDays,
      durationMinDays: session.durationMinDays,
      id: session.id,
      isLive: session.isLive,
      lifecycleState: session.lifecycleState,
      monitoringState: session.monitoringState,
      name: session.name,
      originAirport: session.originAirport,
      outboundDestinationCity: session.outboundDestinationCity,
      returnDestinationAirport: session.returnDestinationAirport,
      returnEndDate: session.returnEndDate
    }
  };
}
