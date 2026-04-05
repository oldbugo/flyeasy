import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { searchRuns } from "@/lib/db/schema/run";
import { getRunProgress } from "@/lib/runs/deterministic-engine";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<unknown>;
  }
) {
  const { sessionId } = (await context.params) as { sessionId: string };
  const db = getDb();
  const latestRun = db
    .select({
      id: searchRuns.id,
      status: searchRuns.status
    })
    .from(searchRuns)
    .where(eq(searchRuns.sessionId, sessionId))
    .orderBy(desc(searchRuns.startedAt))
    .get();

  if (!latestRun) {
    return NextResponse.json({
      progress: null,
      runId: null,
      status: "idle"
    });
  }

  const progress = await getRunProgress(latestRun.id);

  return NextResponse.json({
    progress,
    runId: latestRun.id,
    status: latestRun.status
  });
}
