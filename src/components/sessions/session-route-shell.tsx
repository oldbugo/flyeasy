import type { CSSProperties, ReactNode } from "react";

import {
  stopAndClearSessionQueueAction,
  stopCurrentSessionRunAction
} from "@/app/sessions/actions";
import { SessionCurrentPathInput } from "@/components/sessions/session-current-path-input";
import { SessionPaneNavigationViewport } from "@/components/sessions/session-navigation-feedback";
import { SessionStickyControlBar } from "@/components/sessions/session-sticky-control-bar";
import { SessionStickyActionsProvider } from "@/components/sessions/session-sticky-actions";
import {
  Panel,
  StatBadge,
  cn,
  getButtonClassName
} from "@/components/shared/ui";
import { formatMoney } from "@/lib/formatting";
import { resolveAirportInput, resolveCityInput } from "@/lib/locations/catalog";

type SessionWorkspaceShellProps = {
  activeRun?: {
    id: string;
    status: string;
  } | null;
  activeRunCount?: number;
  children: ReactNode;
  currentBestFare?: {
    amount: number;
    currency: string;
  } | null;
  isArchived?: boolean;
  isLive?: boolean;
  monitoringEnabled?: boolean;
  resultsIsRunning?: boolean;
  sessionId: string;
  sessionName: string;
  sessionTripSummary?: {
    departureStartDate: string;
    durationMaxDays: number | null;
    durationMinDays: number | null;
    originAirport: string;
    outboundDestinationCity: string;
    returnDestinationAirport: string;
    returnEndDate: string | null;
  } | null;
};

type SessionPageHeaderProps = {
  badges?: Array<{
    label: string;
    value: ReactNode;
  }>;
  description: string;
  eyebrow?: string;
  title: string;
};

function formatHeaderSettingDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    weekday: "short"
  }).format(new Date(value));
}

function formatDurationRange(minDays: number | null, maxDays: number | null) {
  if (typeof minDays === "number" && typeof maxDays === "number") {
    return minDays === maxDays ? `${minDays} days` : `${minDays}–${maxDays} days`;
  }

  if (typeof minDays === "number") {
    return `${minDays}+ days`;
  }

  if (typeof maxDays === "number") {
    return `Up to ${maxDays} days`;
  }

  return "Flexible stay";
}

function buildHeaderTripSummary(
  tripSummary: NonNullable<SessionWorkspaceShellProps["sessionTripSummary"]>
) {
  const originCode = resolveAirportInput(tripSummary.originAirport)?.code ?? tripSummary.originAirport;
  const destinationCode =
    resolveCityInput(tripSummary.outboundDestinationCity)?.code ?? tripSummary.outboundDestinationCity;
  const returnCode =
    resolveAirportInput(tripSummary.returnDestinationAirport)?.code ??
    tripSummary.returnDestinationAirport;

  return {
    departureLabel: formatHeaderSettingDate(tripSummary.departureStartDate) ?? "Date pending",
    destinationCode,
    durationLabel: formatDurationRange(
      tripSummary.durationMinDays,
      tripSummary.durationMaxDays
    ),
    originCode,
    returnCode,
    returnLabel: formatHeaderSettingDate(tripSummary.returnEndDate) ?? "Date pending"
  };
}

function HeaderTripConnector() {
  return <span aria-hidden className="mt-4 h-px w-5 shrink-0 bg-slate-300 sm:w-7" />;
}

function HeaderTripBadge({
  centered = false,
  code,
  detail
}: {
  centered?: boolean;
  code: string;
  detail: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1", centered && "items-center")}>
      <span className="rounded-full border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        {code}
      </span>
      <span
        className={cn(
          "text-xs font-medium text-slate-500",
          centered ? "text-center" : "text-left"
        )}
      >
        {detail}
      </span>
    </div>
  );
}

export function SessionWorkspaceShell({
  activeRun = null,
  activeRunCount = 0,
  children,
  currentBestFare = null,
  isArchived = false,
  isLive = false,
  resultsIsRunning = false,
  sessionId,
  sessionName,
  sessionTripSummary = null
}: SessionWorkspaceShellProps) {
  const showClearAllRunsButton = activeRunCount > 1;
  const hasCurrentBestFare =
    typeof currentBestFare?.amount === "number" && Boolean(currentBestFare?.currency);
  const bestFareLabel = formatMoney(currentBestFare?.currency ?? null, currentBestFare?.amount ?? null);
  const bestFareAmountLabel =
    hasCurrentBestFare && currentBestFare
      ? currentBestFare.amount.toLocaleString("en-AU", {
          maximumFractionDigits: 0
        })
      : null;
  const bestFareCurrencyLabel = hasCurrentBestFare ? currentBestFare?.currency ?? null : null;
  const tripSummary = sessionTripSummary
    ? buildHeaderTripSummary(sessionTripSummary)
    : null;
  const titleSizingStyle = {
    ["--session-title-size" as string]: "clamp(2.25rem, 4vw, 4rem)"
  } satisfies CSSProperties;

  return (
    <SessionStickyActionsProvider>
      <div className="flex min-h-full flex-col gap-4">
        <div className="px-2 py-3 md:px-3 md:py-4">
          <div className="flex flex-col gap-2 xl:gap-1">
            <div className="relative z-10 flex flex-col gap-3">
              <div className="min-w-0">
                <div
                  className="inline-flex max-w-full flex-wrap items-start gap-3"
                  style={titleSizingStyle}
                >
                  <h1
                    className="min-w-0 font-semibold leading-[0.92] tracking-[-0.05em] text-ink"
                    style={{ fontSize: "var(--session-title-size)" }}
                  >
                    {sessionName}
                  </h1>
                  <span
                    aria-label={isLive ? "Session is live" : isArchived ? "Session is archived" : "Session is not live"}
                    className={cn(
                      "mt-[0.55em] h-3 w-3 shrink-0 rounded-full",
                      isLive ? "bg-emerald-500" : "bg-slate-300"
                    )}
                    role="status"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tripSummary ? (
                    <div className="flex flex-wrap items-start gap-2 sm:gap-3">
                      <HeaderTripBadge
                        code={tripSummary.originCode}
                        detail={tripSummary.departureLabel}
                      />
                      <HeaderTripConnector />
                      <HeaderTripBadge
                        centered
                        code={tripSummary.destinationCode}
                        detail={tripSummary.durationLabel}
                      />
                      <HeaderTripConnector />
                      <HeaderTripBadge
                        code={tripSummary.returnCode}
                        detail={tripSummary.returnLabel}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No route data yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="relative z-0 flex flex-col gap-4 lg:-mt-8 lg:flex-row lg:items-end lg:gap-6 xl:-mt-10">
              {activeRun || showClearAllRunsButton ? (
                <div className="flex flex-wrap gap-3 lg:max-w-[32rem] lg:flex-none xl:max-w-[48rem]">
                  {activeRun ? (
                    <form action={stopCurrentSessionRunAction}>
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <SessionCurrentPathInput fallback={`/sessions/${sessionId}`} />
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
                      <SessionCurrentPathInput fallback={`/sessions/${sessionId}`} />
                      <button
                        type="submit"
                        className={getButtonClassName({ size: "sm", tone: "danger" })}
                      >
                        Stop all runs and clear queue ({activeRunCount})
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div
                className="pointer-events-none min-w-0 lg:ml-auto lg:flex-1 lg:-translate-y-10 lg:self-end lg:text-right xl:-translate-y-14 2xl:-translate-y-16"
                style={{ containerType: "inline-size" }}
              >
                {bestFareAmountLabel && bestFareCurrencyLabel ? (
                  <div className="flex flex-col items-start lg:items-end">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 lg:text-right">
                      Current best fare
                    </p>
                    <div className="mt-1 flex flex-col items-start lg:items-end">
                      <span className="pr-[0.04em] text-[clamp(0.95rem,4.8cqi,1.35rem)] font-semibold uppercase tracking-[0.22em] text-sea/75">
                        {bestFareCurrencyLabel}
                      </span>
                      <span className="-mt-[0.02em] text-[clamp(10rem,56cqi,30rem)] font-semibold leading-[0.76] tracking-[-0.11em] text-sea">
                        {bestFareAmountLabel}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start lg:items-end">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 lg:text-right">
                      Current best fare
                    </p>
                    <div className="mt-2 text-[clamp(3rem,7vw,5rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-sea lg:text-right">
                      {bestFareLabel}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden className="h-0" data-session-tab-anchor />

        <SessionStickyControlBar
          className="lg:-mt-[5.5rem] xl:-mt-[6.25rem] 2xl:-mt-[6.75rem]"
          resultsIsRunning={resultsIsRunning}
          sessionId={sessionId}
        />

        <div className="relative flex min-w-0 flex-col">
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-0 w-0"
            data-session-content-start-anchor
          />

          <SessionPaneNavigationViewport sessionId={sessionId}>
            {children}
          </SessionPaneNavigationViewport>
        </div>
      </div>
    </SessionStickyActionsProvider>
  );
}

export function SessionPageHeader({
  badges = [],
  description,
  eyebrow = "Session view",
  title
}: SessionPageHeaderProps) {
  return (
    <Panel className="p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        </div>

        {badges.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[18rem] xl:grid-cols-1">
            {badges.map((badge) => (
              <StatBadge key={badge.label} label={badge.label} value={badge.value} />
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
