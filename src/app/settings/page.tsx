import { resumeBlockedRunAction } from "@/app/sessions/actions";
import {
  runTripcomConnectionCheckAction,
  startTripcomRecoveryAction,
  updateAutomationBrowserPreferenceAction,
  updateSuccessScreenshotPreferenceAction
} from "@/app/settings/actions";
import { listBlockedRuns } from "@/lib/db/queries/runs";
import { formatIsoDateTime } from "@/lib/formatting";
import { getSecretStoreStatus } from "@/lib/runtime/secret-store";
import { readAutomationPreferences } from "@/lib/tripcom/automation-preferences";
import { getTripcomConnectionBadge, readTripcomConnectionSnapshot } from "@/lib/tripcom/connection-state";
import { getAutomationWorkerSnapshot } from "@/workers/automation/worker";

export default async function SettingsPage() {
  const connectionSnapshot = readTripcomConnectionSnapshot();
  const connectionBadge = getTripcomConnectionBadge(connectionSnapshot);
  const workerSnapshot = getAutomationWorkerSnapshot();
  const secretStoreStatus = getSecretStoreStatus();
  const blockedRuns = await listBlockedRuns();
  const automationPreferences = readAutomationPreferences();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          Trip.com connection and local runtime
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          The MVP uses public Trip.com search flows and manual booking handoff. These controls let
          you check local browser readiness, launch a manual recovery window when Trip.com blocks,
          and inspect the local automation worker state.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Connection state
            </p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connectionBadge.className}`}>
              {connectionBadge.label}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>Detail: {connectionSnapshot.detail}</p>
            <p>Last checked: {formatIsoDateTime(connectionSnapshot.lastCheckedAt)}</p>
            <p>Last URL: {connectionSnapshot.lastUrl ?? "Not recorded"}</p>
            <p>Updated by: {connectionSnapshot.updatedBy}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <form action={runTripcomConnectionCheckAction}>
              <button
                type="submit"
                className="rounded-full bg-sea px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Check public readiness
              </button>
            </form>
            <form action={startTripcomRecoveryAction}>
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
              >
                Open recovery window
              </button>
            </form>
          </div>
        </article>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Automation worker
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p>Status: {workerSnapshot.status}</p>
              <p>Active run: {workerSnapshot.activeRunId ?? "None"}</p>
              <p>Started at: {formatIsoDateTime(workerSnapshot.startedAt)}</p>
              <p>Last heartbeat: {formatIsoDateTime(workerSnapshot.lastHeartbeatAt)}</p>
              <p>Last error: {workerSnapshot.lastError ?? "None"}</p>
              <p>
                Automation browser:{" "}
                {automationPreferences.showAutomationBrowser
                  ? "Visible while runs execute"
                  : "Hidden (headless)"}
              </p>
              <p>
                Screenshots of successful searches:{" "}
                {automationPreferences.captureSuccessScreenshots
                  ? "Saved for every search step (slower)"
                  : "Off (failures are always captured)"}
              </p>
            </div>

            <form
              action={updateSuccessScreenshotPreferenceAction}
              className="mt-6 inline-block pr-3"
            >
              <input
                type="hidden"
                name="captureSuccessScreenshots"
                value={automationPreferences.captureSuccessScreenshots ? "0" : "1"}
              />
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
              >
                {automationPreferences.captureSuccessScreenshots
                  ? "Stop saving success screenshots"
                  : "Save success screenshots"}
              </button>
            </form>

            <form action={updateAutomationBrowserPreferenceAction} className="mt-6 inline-block">
              <input
                type="hidden"
                name="showAutomationBrowser"
                value={automationPreferences.showAutomationBrowser ? "0" : "1"}
              />
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
              >
                {automationPreferences.showAutomationBrowser
                  ? "Hide automation browser"
                  : "Show automation browser"}
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Secure storage
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p>Status: {secretStoreStatus}</p>
              <p>
                MVP baseline automation does not store Trip.com credentials. Manual recovery uses
                the FlyEasy-managed browser profile instead.
              </p>
            </div>
          </section>
        </aside>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
          Recovery queue
        </p>
        <div className="mt-5 space-y-3">
          {blockedRuns.length > 0 ? (
            blockedRuns.map((run) => (
              <div key={run.id} className="rounded-[20px] bg-mist px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="font-semibold text-ink">{run.id}</p>
                    <p>{run.recoveryReason ?? "Trip.com recovery is required before the run can continue."}</p>
                    <p>Blocked at: {formatIsoDateTime(run.blockedAt)}</p>
                  </div>
                  <form action={resumeBlockedRunAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="sessionId" value={run.sessionId} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
                    >
                      Resume run
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-600">
              No blocked runs are waiting for recovery right now.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
