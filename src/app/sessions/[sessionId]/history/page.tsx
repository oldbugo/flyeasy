import Link from "next/link";
import { notFound } from "next/navigation";

import { rerunSessionAction } from "@/app/sessions/actions";
import { SessionRouteShell } from "@/components/sessions/session-route-shell";
import { listCandidateFamilySummaries } from "@/lib/db/queries/candidates";
import { getSessionHistorySnapshot } from "@/lib/db/queries/history";
import { getSessionById } from "@/lib/db/queries/sessions";
import { formatIsoDateTime, formatMoney } from "@/lib/formatting";

type HistoryPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { sessionId } = await params;
  const [record, historySnapshot, familySummaries] = await Promise.all([
    getSessionById(sessionId),
    getSessionHistorySnapshot(sessionId),
    listCandidateFamilySummaries(sessionId)
  ]);

  if (!record) {
    notFound();
  }

  const { session } = record;
  const resultsIsRunning = record.hasRunnableActiveRun;

  return (
    <SessionRouteShell
      activeRun={record.currentActiveRun}
      activeRunCount={record.activeRunCount}
      currentTab="history"
      title="Monitoring and history"
      description="History keeps repeated runs explainable. It shows what changed, which route families survived, and when the last displayed prices were observed."
      isArchived={session.lifecycleState === "archived"}
      monitoringEnabled={session.monitoringState === "enabled"}
      returnTo={`/sessions/${session.id}/history`}
      resultsIsRunning={resultsIsRunning}
      sessionId={session.id}
      sessionName={session.name}
      badges={[
        { label: "Monitoring", value: session.monitoringState },
        { label: "Lifecycle", value: session.lifecycleState }
      ]}
    >
      <div className="space-y-6">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Monitoring controls
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              Run again when you want a fresh displayed-price snapshot.
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Current shortlist families: {historySnapshot.shortlistCount}. Last successful run:{" "}
              {formatIsoDateTime(session.lastRunFinishedAt)}.
            </p>
          </div>
          <form action={rerunSessionAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <button
              type="submit"
              className="rounded-full bg-sea px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Rerun now
            </button>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Run history
            </p>
            <div className="mt-4 space-y-3">
              {historySnapshot.runs.map((run) => (
                <div key={run.id} className="rounded-[22px] bg-mist px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-ink">{run.id}</p>
                      <p className="text-sm text-slate-600">
                        {run.summaryText ?? "No summary recorded yet."}
                      </p>
                      <p className="text-sm text-slate-500">
                        Candidates: {run.totalCandidatesFound}
                        {run.candidateDelta !== null
                          ? ` | change vs previous run: ${run.candidateDelta >= 0 ? "+" : ""}${run.candidateDelta}`
                          : ""}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Status: {run.status}</p>
                      <p>Started: {formatIsoDateTime(run.startedAt)}</p>
                      <Link
                        href={`/sessions/${session.id}/runs/${run.id}`}
                        className="inline-block font-semibold text-sea transition hover:text-emerald-800"
                      >
                        Open run
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
                Recent price observations
              </p>
              <div className="mt-4 space-y-3">
                {historySnapshot.recentPrices.length > 0 ? (
                  historySnapshot.recentPrices.map((observation) => (
                    <div key={`${observation.candidateFamilyId}:${observation.observedAt}`} className="rounded-[20px] bg-mist px-4 py-4">
                      <p className="text-sm font-semibold text-ink">
                        {formatMoney(observation.currency, observation.displayAmount)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {observation.outboundDestinationCity} | {observation.priceKind}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatIsoDateTime(observation.observedAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-slate-600">
                    No price observations are recorded yet for this session.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
                Route-family continuity
              </p>
              <div className="mt-4 space-y-3">
                {familySummaries.map((family) => (
                  <div key={family.familyId} className="rounded-[20px] bg-mist px-4 py-4">
                    <p className="text-sm font-semibold text-ink">{family.familyKey}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {family.bookingType} | {family.candidateCount} observations | lowest displayed fare{" "}
                      {family.lowestDisplayedAmount !== null
                        ? `AUD ${family.lowestDisplayedAmount.toLocaleString("en-AU", {
                            maximumFractionDigits: 0
                          })}`
                        : "not recorded"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Last seen {formatIsoDateTime(family.latestRunStartedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </SessionRouteShell>
  );
}
