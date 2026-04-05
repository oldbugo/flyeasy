import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/db/ids";
import { aiStrategyProposals } from "@/lib/db/schema/ai";
import { searchRuns } from "@/lib/db/schema/run";
import { sessions } from "@/lib/db/schema/session";
import {
  buildStrategySelectionFingerprint,
  listSessionStrategySelections
} from "@/lib/search-strategies/session-strategies";
import type { StrategyPlan } from "@/lib/search-strategies/types";
import { planStrategiesForSession } from "@/lib/runs/plan-strategies";

type SessionRecord = typeof sessions.$inferSelect;
type ProposalStatus = "accepted" | "dismissed" | "proposed";

type StrategyDraft = StrategyPlan & {
  rationale: string;
  summary: string;
  title: string;
};

function nowIso() {
  return new Date().toISOString();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseStrategyPayload(strategyPayloadJson: string) {
  try {
    return JSON.parse(strategyPayloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSessionStrategyFingerprint(session: SessionRecord) {
  return JSON.stringify({
    bookingMode: session.bookingMode,
    departureStartDate: session.departureStartDate,
    durationMaxDays: session.durationMaxDays,
    durationMinDays: session.durationMinDays,
    latestReturnDate: session.returnEndDate ?? session.departureEndDate,
    maxStops: session.maxStops,
    originAirport: session.originAirport,
    outboundDestinationCity: session.outboundDestinationCity,
    returnDestinationAirport: session.returnDestinationAirport,
    returnOriginCity: session.returnOriginCity,
    returnOriginMode: session.returnOriginMode,
    searchIntensity: session.searchIntensity,
    strategySelections: JSON.parse(buildStrategySelectionFingerprint(session.id, session)),
    stopDurationMaxDays: session.stopDurationMaxDays,
    stopDurationMinDays: session.stopDurationMinDays
  });
}

function buildStrategyKey(strategyType: string, strategyPayloadJson: string) {
  return `${strategyType}:${strategyPayloadJson}`;
}

function validateProposal(
  session: SessionRecord,
  draft: StrategyDraft,
  reservedKeys: Set<string>
) {
  const payload = draft.strategyPayload;
  const key = buildStrategyKey(draft.strategyType, JSON.stringify(payload));
  const validationNotes: string[] = [];

  if (reservedKeys.has(key)) {
    validationNotes.push("This proposal duplicates an already planned strategy.");
  }

  if (draft.strategyType === "stitched_followup") {
    if (!(session.bookingMode === "stitched" || session.bookingMode === "both")) {
      validationNotes.push("Stitched strategies require the session booking mode to allow stitched results.");
    }
  }

  return {
    payloadJson: JSON.stringify(payload),
    validationNotes: validationNotes.length > 0 ? validationNotes.join(" ") : null,
    validationStatus: validationNotes.length > 0 ? ("invalid" as const) : ("valid" as const)
  };
}

function buildDrafts(session: SessionRecord) {
  const strategySelections = listSessionStrategySelections(session.id, session);
  const systemPlans = planStrategiesForSession(session, strategySelections);
  const coveredTypes = new Set(systemPlans.map((plan) => plan.strategyType));
  const drafts: StrategyDraft[] = [];

  if (
    !coveredTypes.has("stitched_followup") &&
    (session.bookingMode === "stitched" || session.bookingMode === "both")
  ) {
    drafts.push({
      estimatedSearchCost: 0,
      rationale:
        "The default run will not derive stitched variants at this intensity, so this proposal adds a low-cost stitched comparison from the same packaged baseline.",
      reason: "Derive stitched comparisons from the live baseline results.",
      strategyPayload: {
        aiGoal: "probe_stitched_savings",
        discountRate: 0.92,
        engine: "derived_expansion",
        maxDerivedCandidates: 1,
        type: "stitched_followup"
      },
      strategyType: "stitched_followup",
      summary: "Add one stitched comparison candidate without changing the public search baseline.",
      title: "Probe stitched savings"
    });
  }

  return drafts;
}

export async function ensureAiStrategyProposals(
  session: SessionRecord,
  options?: { forceRegenerate?: boolean }
) {
  const db = getDb();
  const sessionFingerprint = buildSessionStrategyFingerprint(session);
  const existing = db
    .select()
    .from(aiStrategyProposals)
    .where(eq(aiStrategyProposals.sessionId, session.id))
    .all();

  if (
    !options?.forceRegenerate &&
    existing.length > 0 &&
    existing.every((proposal) => proposal.generatedFromSessionUpdatedAt === sessionFingerprint)
  ) {
    return existing;
  }

  if (existing.length > 0) {
    db.delete(aiStrategyProposals).where(eq(aiStrategyProposals.sessionId, session.id)).run();
  }

  const drafts = buildDrafts(session);
  const strategySelections = listSessionStrategySelections(session.id, session);
  const reservedKeys = new Set(
    planStrategiesForSession(session, strategySelections).map((plan) =>
      buildStrategyKey(plan.strategyType, JSON.stringify(plan.strategyPayload))
    )
  );
  const timestamp = nowIso();
  const rows = drafts.map((draft) => {
    const validation = validateProposal(session, draft, reservedKeys);
    reservedKeys.add(buildStrategyKey(draft.strategyType, validation.payloadJson));

    return {
      id: createId("ai_prop"),
      sessionId: session.id,
      strategyType: draft.strategyType,
      title: draft.title,
      summary: draft.summary,
      rationale: draft.rationale,
      strategyPayloadJson: validation.payloadJson,
      status: "proposed" as ProposalStatus,
      validationStatus: validation.validationStatus,
      validationNotes: validation.validationNotes,
      generatedFromSessionUpdatedAt: sessionFingerprint,
      lastAppliedRunId: null,
      acceptedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  if (rows.length > 0) {
    db.insert(aiStrategyProposals).values(rows).run();
  }

  return rows;
}

export async function refreshAiStrategyProposals(sessionId: string) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    return [];
  }

  return ensureAiStrategyProposals(session, { forceRegenerate: true });
}

export async function listAcceptedAiStrategyPlans(sessionId: string) {
  const db = getDb();
  const proposals = db
    .select()
    .from(aiStrategyProposals)
    .where(
      and(
        eq(aiStrategyProposals.sessionId, sessionId),
        eq(aiStrategyProposals.status, "accepted"),
        eq(aiStrategyProposals.validationStatus, "valid")
      )
    )
    .all();

  return proposals.map((proposal) => ({
    estimatedSearchCost:
      Number(parseStrategyPayload(proposal.strategyPayloadJson).maxDerivedCandidates ?? 1) > 0 ? 1 : 0,
    proposalId: proposal.id,
    reason: proposal.summary,
    sourceType: "ai" as const,
    strategyPayload: parseStrategyPayload(proposal.strategyPayloadJson),
    strategyType: proposal.strategyType,
    title: proposal.title
  }));
}

export async function setAiProposalStatus(
  proposalId: string,
  status: ProposalStatus,
  options?: { acceptedAt?: string | null; lastAppliedRunId?: string | null }
) {
  const db = getDb();
  const updatedAt = nowIso();

  db.update(aiStrategyProposals)
    .set({
      status,
      acceptedAt: status === "accepted" ? options?.acceptedAt ?? updatedAt : null,
      lastAppliedRunId: options?.lastAppliedRunId ?? null,
      updatedAt
    })
    .where(eq(aiStrategyProposals.id, proposalId))
    .run();
}

export async function markAcceptedAiProposalsApplied(sessionId: string, proposalIds: string[], runId: string) {
  if (proposalIds.length === 0) {
    return;
  }

  const db = getDb();
  db.update(aiStrategyProposals)
    .set({
      lastAppliedRunId: runId,
      updatedAt: nowIso()
    })
    .where(
      and(
        eq(aiStrategyProposals.sessionId, sessionId),
        inArray(aiStrategyProposals.id, proposalIds)
      )
    )
    .run();
}

export async function listLatestRunAiStrategyInfluence(sessionId: string) {
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

  return db
    .select({
      id: aiStrategyProposals.id,
      lastAppliedRunId: aiStrategyProposals.lastAppliedRunId,
      rationale: aiStrategyProposals.rationale,
      strategyType: aiStrategyProposals.strategyType,
      summary: aiStrategyProposals.summary,
      title: aiStrategyProposals.title
    })
    .from(aiStrategyProposals)
    .where(eq(aiStrategyProposals.lastAppliedRunId, latestRun.id))
    .all();
}
