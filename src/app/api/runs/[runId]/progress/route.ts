import { NextRequest, NextResponse } from "next/server";

import { getRunProgress } from "@/lib/runs/deterministic-engine";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<unknown>;
  }
) {
  const { runId } = (await context.params) as { runId: string };
  const progress = await getRunProgress(runId);

  if (!progress) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(progress);
}
