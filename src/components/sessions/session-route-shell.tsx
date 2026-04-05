import Link from "next/link";

import {
  archiveOrRestoreSessionAction,
  duplicateSessionAction,
  stopAndClearSessionQueueAction,
  stopCurrentSessionRunAction,
  toggleMonitoringSessionAction
} from "@/app/sessions/actions";
import {
  Panel,
  StatBadge,
  getButtonClassName
} from "@/components/shared/ui";

type SessionRouteShellProps = {
  badges?: Array<{
    label: string;
    value: string;
  }>;
  activeRun?: {
    id: string;
    status: string;
  } | null;
  activeRunCount?: number;
  children?: React.ReactNode;
  currentTab: "overview" | "settings" | "strategy" | "results" | "history";
  description: string;
  isArchived?: boolean;
  monitoringEnabled?: boolean;
  returnTo?: string;
  resultsIsRunning?: boolean;
  sessionId: string;
  sessionName: string;
  title: string;
};

const sessionTabs = [
  { id: "overview", label: "Overview", suffix: "" },
  { id: "results", label: "Results", suffix: "/results" },
  { id: "settings", label: "Trip settings", suffix: "/settings" },
  { id: "strategy", label: "Search strategy", suffix: "/strategy" },
  { id: "history", label: "History", suffix: "/history" }
] as const;

export function SessionRouteShell({
  activeRun = null,
  activeRunCount = 0,
  badges = [],
  children,
  currentTab,
  description,
  isArchived = false,
  monitoringEnabled = false,
  returnTo,
  resultsIsRunning = false,
  sessionId,
  sessionName,
  title
}: SessionRouteShellProps) {
  const resolvedReturnTo = returnTo ?? `/sessions/${sessionId}`;
  const showClearAllRunsButton = activeRunCount > 1;

  return (
    <div className="space-y-8">
      <Panel className="p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
              Session workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-lg font-medium text-slate-700">{sessionName}</p>
            <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {activeRun ? (
                <form action={stopCurrentSessionRunAction}>
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="returnTo" value={resolvedReturnTo} />
                  <button
                    type="submit"
                    className={getButtonClassName({ size: "sm", tone: "danger" })}
                  >
                    Stop current run
                  </button>
                </form>
              ) : null}
              {showClearAllRunsButton ? (
                <form action={stopAndClearSessionQueueAction}>
                  <input type="hidden" name="sessionId" value={sessionId} />
                  <input type="hidden" name="returnTo" value={resolvedReturnTo} />
                  <button
                    type="submit"
                    className={getButtonClassName({ size: "sm", tone: "danger" })}
                  >
                    Stop all runs and clear queue ({activeRunCount})
                  </button>
                </form>
              ) : null}
              <form action={duplicateSessionAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <button
                  type="submit"
                  className={getButtonClassName({ size: "sm", tone: "secondary" })}
                >
                  Duplicate session
                </button>
              </form>
              <form action={archiveOrRestoreSessionAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="intent" value={isArchived ? "restore" : "archive"} />
                <button
                  type="submit"
                  className={getButtonClassName({ size: "sm", tone: "secondary" })}
                >
                  {isArchived ? "Restore session" : "Archive session"}
                </button>
              </form>
            </div>
          </div>

          {badges.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[18rem] xl:grid-cols-1">
              {badges.map((badge) => (
                <StatBadge key={badge.label} label={badge.label} value={badge.value} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <nav className="inline-flex flex-wrap gap-3 rounded-[12px] border border-line bg-[var(--surface-subtle)] p-1.5 shadow-sm">
            {sessionTabs.map((tab) => {
              const isActive = tab.id === currentTab;

              return (
                <Link
                  key={tab.id}
                  href={`/sessions/${sessionId}${tab.suffix}` as never}
                  className={getButtonClassName({
                    active: isActive,
                    size: "sm",
                    tone: isActive ? "primary" : "secondary"
                  })}
                >
                  <span>{tab.label}</span>
                  {tab.id === "results" && resultsIsRunning ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-r-current" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <form action={toggleMonitoringSessionAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <input
              type="hidden"
              name="intent"
              value={monitoringEnabled ? "disable" : "enable"}
            />
            <button
              type="submit"
              className={
                monitoringEnabled
                  ? "inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold tracking-[-0.01em] text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
                  : getButtonClassName({ size: "sm", tone: "secondary" })
              }
            >
              {monitoringEnabled ? "Disable monitoring" : "Enable monitoring"}
            </button>
          </form>
        </div>
      </Panel>

      {children}
    </div>
  );
}
