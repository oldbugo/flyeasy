import { notFound } from "next/navigation";

import {
  forkSessionFromUpdateAction,
  updateSessionAction
} from "@/app/sessions/actions";
import { SessionForm } from "@/components/sessions/session-form";
import { SessionRouteShell } from "@/components/sessions/session-route-shell";
import { getSessionById } from "@/lib/db/queries/sessions";

type SessionSettingsPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    formError?: string | string[];
  }>;
};

export default async function SessionSettingsPage({
  params,
  searchParams
}: SessionSettingsPageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const formError = Array.isArray(resolvedSearchParams?.formError)
    ? resolvedSearchParams?.formError[0]
    : resolvedSearchParams?.formError;
  const record = await getSessionById(sessionId);

  if (!record) {
    notFound();
  }

  const { currentBestCandidate, session } = record;
  const resultsIsRunning = record.hasRunnableActiveRun;

  return (
    <SessionRouteShell
      activeRun={record.currentActiveRun}
      activeRunCount={record.activeRunCount}
      badges={[
        { label: "Lifecycle", value: session.lifecycleState },
        {
          label: "Best current fare",
          value: currentBestCandidate
            ? `${currentBestCandidate.displayedDisplayCurrency} ${currentBestCandidate.displayedDisplayAmount.toLocaleString("en-AU", {
                maximumFractionDigits: 0
              })}`
            : "No fare yet"
        }
      ]}
      currentTab="settings"
      description="Trip settings define the route constraints, duration window, cadence, and booking rules that future runs will use."
      isArchived={session.lifecycleState === "archived"}
      monitoringEnabled={session.monitoringState === "enabled"}
      returnTo={`/sessions/${session.id}/settings`}
      resultsIsRunning={resultsIsRunning}
      sessionId={session.id}
      sessionName={session.name}
      title="Trip settings"
    >
      {session.lastSuccessfulRunId || session.currentBestCandidateId ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            Fork recommendation
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
            Duplicate before major changes
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
            This session already has run history or a current best candidate.
            If you want to change the route shape or date logic materially, save a fork instead so
            the original evidence stays comparable.
          </p>
        </section>
      ) : null}

      <SessionForm
        action={updateSessionAction}
        formError={formError}
        secondaryAction={
          session.lastSuccessfulRunId || session.currentBestCandidateId
            ? forkSessionFromUpdateAction
            : undefined
        }
        secondaryLabel={
          session.lastSuccessfulRunId || session.currentBestCandidateId
            ? "Save as forked session"
            : undefined
        }
        submitLabel="Save trip settings"
        defaults={{
          sessionId: session.id,
          bookingMode: session.bookingMode,
          departureStartDate: session.departureStartDate,
          durationMaxDays: session.durationMaxDays,
          durationMinDays: session.durationMinDays,
          latestReturnDate: session.returnEndDate ?? session.departureEndDate,
          maxStops: session.maxStops,
          name: session.name,
          notes: session.notes,
          originAirport: session.originAirport,
          outboundDestinationCity: session.outboundDestinationCity,
          requireIncludedCheckedBaggage: session.requireIncludedCheckedBaggage,
          refreshIntervalHours: session.refreshIntervalHours,
          returnDestinationAirport: session.returnDestinationAirport,
          returnOriginCity: session.returnOriginCity,
          returnOriginMode: session.returnOriginMode,
          restrictToChineseAirlines: session.restrictToChineseAirlines,
          searchIntensity: session.searchIntensity,
          stopDurationMaxDays: session.stopDurationMaxDays,
          stopDurationMinDays: session.stopDurationMinDays
        }}
      />
    </SessionRouteShell>
  );
}
