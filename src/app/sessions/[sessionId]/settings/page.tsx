import { notFound } from "next/navigation";

import {
  deleteSessionAction,
  duplicateSessionAction,
  toggleMonitoringSessionAction,
  forkSessionFromUpdateAction,
  updateSessionAction
} from "@/app/sessions/actions";
import { SessionForm } from "@/components/sessions/session-form";
import { Panel, getButtonClassName } from "@/components/shared/ui";
import { getSessionById } from "@/lib/db/queries/sessions";

type SessionSettingsPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    formError?: string | string[];
    saved?: string | string[];
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
  const showSavedState =
    (Array.isArray(resolvedSearchParams?.saved)
      ? resolvedSearchParams?.saved[0]
      : resolvedSearchParams?.saved) === "1";
  const record = await getSessionById(sessionId);

  if (!record) {
    notFound();
  }

  const { session } = record;
  const formId = `session-settings-form-${session.id}`;

  return (
    <div className="space-y-8">
      <Panel className="p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Session controls
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
            Monitoring, duplication, and deletion
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            These actions apply immediately. Trip constraints below still use the normal save flow.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <div className="flex flex-col gap-4 rounded-[24px] border border-line bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">Live monitor</h3>
              <p className="text-sm leading-6 text-slate-600">
                {session.isLive
                  ? "This session is currently live and will keep refreshing on the configured cadence."
                  : "This session is currently not live. Turn monitoring on to keep it refreshing automatically."}
              </p>
            </div>
            <form action={toggleMonitoringSessionAction} className="shrink-0">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="returnTo" value={`/sessions/${session.id}/settings`} />
              <input
                type="hidden"
                name="intent"
                value={session.isLive ? "disable" : "enable"}
              />
              <button
                type="submit"
                className={getButtonClassName({
                  size: "sm",
                  tone: session.isLive ? "secondary" : "primary"
                })}
              >
                {session.isLive ? "Turn off live monitor" : "Turn on live monitor"}
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4 rounded-[24px] border border-line bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">Duplicate session</h3>
              <p className="text-sm leading-6 text-slate-600">
                Create a copy of this session and keep experimenting without disturbing the current one.
              </p>
            </div>
            <form action={duplicateSessionAction} className="shrink-0">
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                type="submit"
                className={getButtonClassName({ size: "sm", tone: "secondary" })}
              >
                Duplicate session
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4 rounded-[24px] border border-rose-200 bg-rose-50/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-rose-700">Delete session</h3>
              <p className="text-sm leading-6 text-rose-700">
                Permanently remove this session and all associated runs, candidates, and history.
              </p>
            </div>
            <form action={deleteSessionAction} className="shrink-0">
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                type="submit"
                className={getButtonClassName({ size: "sm", tone: "danger" })}
              >
                Delete session
              </button>
            </form>
          </div>
        </div>
      </Panel>

      <SessionForm
        action={updateSessionAction}
        formError={formError}
        formId={formId}
        showSavedState={showSavedState}
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
          returnTo: `/sessions/${session.id}/settings?saved=1`,
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
    </div>
  );
}
