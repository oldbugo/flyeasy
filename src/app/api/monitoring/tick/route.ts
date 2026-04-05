import { queueDueMonitoringRuns } from "@/lib/monitoring/scheduler";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await queueDueMonitoringRuns();

  return Response.json({
    ok: true,
    queuedRunIds: result.queuedRunIds,
    skippedSessionIds: result.skippedSessionIds
  });
}
