import { notFound } from "next/navigation";
import Link from "next/link";

import { resumeBlockedRunAction, stopRunAction } from "@/app/sessions/actions";
import { RunProgressPanel } from "@/components/runs/run-progress-panel";
import { SessionPageHeader } from "@/components/sessions/session-route-shell";
import { getSessionById } from "@/lib/db/queries/sessions";
import { getRunProgress } from "@/lib/runs/deterministic-engine";

type RunPageProps = {
  params: Promise<{
    runId: string;
    sessionId: string;
  }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { runId, sessionId } = await params;
  const [record, runRecord] = await Promise.all([getSessionById(sessionId), getRunProgress(runId)]);

  if (!record || !runRecord || runRecord.run.sessionId !== sessionId) {
    notFound();
  }

  const { session } = record;
  const { run } = runRecord;
  const canStop =
    run.status === "queued" ||
    run.status === "running" ||
    run.status === "blocked" ||
    run.status === "paused";

  return (
    <div className="space-y-8">
      <SessionPageHeader
        badges={[
          { label: "Run status", value: run.status },
          { label: "Strategies planned", value: String(run.totalStrategiesPlanned) }
        ]}
        description="This route will become the live run surface for strategy progress, blocked-state recovery, and partial results as the worker executes."
        eyebrow="Run detail"
        title={`Run ${runId}`}
      />
      <div className="flex justify-end">
        {canStop ? (
          <form action={stopRunAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="runId" value={run.id} />
            <button
              type="submit"
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:text-rose-800"
            >
              Stop run
            </button>
          </form>
        ) : null}
      </div>

      {run.status === "blocked" ? (
        <section className="rounded-[24px] border border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
            Recovery required
          </p>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            This run is waiting on Trip.com recovery. Open the settings recovery flow, complete the
            browser step in the FlyEasy-managed profile, then return here to resume or rerun.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/settings"
              className="rounded-full border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-600"
            >
              Open settings
            </Link>
            {run.resumeAvailable ? (
              <form action={resumeBlockedRunAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="runId" value={run.id} />
                <button
                  type="submit"
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Resume run
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      <RunProgressPanel initialData={runRecord} runId={runId} />
    </div>
  );
}
