import { desc, eq } from "drizzle-orm";

import { ensureAiStrategyProposals, listLatestRunAiStrategyInfluence } from "@/lib/ai/strategy-proposals";
import { getDb } from "@/lib/db/client";
import { aiStrategyProposals } from "@/lib/db/schema/ai";
import { sessions } from "@/lib/db/schema/session";

export async function listAiStrategyProposalsForSession(sessionId: string) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    return [];
  }

  const proposals = await ensureAiStrategyProposals(session);

  return proposals.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function listAcceptedAiStrategyProposalsForSession(sessionId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(aiStrategyProposals)
    .where(eq(aiStrategyProposals.sessionId, sessionId))
    .orderBy(desc(aiStrategyProposals.updatedAt))
    .all();

  return rows.filter((row) => row.status === "accepted" && row.validationStatus === "valid");
}

export async function listLatestAiInfluenceForSession(sessionId: string) {
  return listLatestRunAiStrategyInfluence(sessionId);
}
