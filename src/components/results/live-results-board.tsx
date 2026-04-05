"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  buildCandidateRecommendationGroups,
  type CandidateLeg,
  type CandidateResult,
  type CandidateStopover,
  isMultiCityCandidate
} from "@/lib/candidates/result-groups";
import { formatDurationMinutes } from "@/lib/formatting";

type ResultsLivePayload = {
  progress: null | {
    candidates: Array<
      Omit<CandidateResult, "isShortlisted" | "runId"> & {
        isCurrentBest?: boolean;
      }
    >;
    run: {
      id: string;
      startedAt: string;
      status: string;
      summaryText: string | null;
    };
  };
  runId: string | null;
  status: string;
};

type LiveResultsBoardProps = {
  initialPayload: ResultsLivePayload;
  sessionId: string;
};

function fingerprintPayload(payload: ResultsLivePayload) {
  if (!payload.progress) {
    return `idle:${payload.status}:${payload.runId ?? ""}`;
  }

  const candidates = payload.progress.candidates ?? [];
  const last = candidates[candidates.length - 1];
  const lastKey = last
    ? `${last.id}:${last.displayedDisplayAmount}:${last.isCurrentBest ? "1" : "0"}`
    : "none";

  return `run:${payload.progress.run.id}:${payload.progress.run.status}:${candidates.length}:${lastKey}`;
}

function formatMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-AU", {
    maximumFractionDigits: 0
  })}`;
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatExactDateTime(isoDateTime: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(isoDateTime));
}

function formatExactTime(isoDateTime: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(isoDateTime));
}

function formatJourneyDate(isoDateTime: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(isoDateTime));
}

function formatCompactDate(isoDateTime: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(new Date(isoDateTime));
}

function buildStopoverStatusLabel(stopovers: CandidateStopover[]) {
  const intentionalStopovers = stopovers.filter((stopover) => stopover.isIntentional);

  if (intentionalStopovers.length > 0) {
    const cities = [...new Set(intentionalStopovers.map((stopover) => stopover.cityCode))];
    return {
      label: `${intentionalStopovers.length} intentional stop${intentionalStopovers.length === 1 ? "" : "s"}`,
      tone: "intentional" as const,
      tooltip: cities.length > 0 ? `Intentional stopovers: ${cities.join(", ")}` : "Intentional stopovers recorded"
    };
  }

  if (stopovers.length > 0) {
    const cities = [...new Set(stopovers.map((stopover) => stopover.cityCode))];
    return {
      label: `${stopovers.length} recorded stop${stopovers.length === 1 ? "" : "s"}`,
      tone: "recorded" as const,
      tooltip: cities.length > 0 ? `Recorded stopovers: ${cities.join(", ")}` : "Recorded stopovers"
    };
  }

  return {
    label: "Direct",
    tone: "direct" as const,
    tooltip: "No stopovers recorded"
  };
}

function formatProviderLabel(leg: CandidateLeg) {
  const parts = [leg.carrierCode, leg.flightNumber].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return leg.fareBrand ?? "Provider pending";
}

function buildRouteProviderLabel(legs: CandidateLeg[]) {
  return legs.map((leg) => formatProviderLabel(leg)).join(" · ");
}

function getCalendarDayShift(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startUtcDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtcDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  return Math.max(0, Math.round((endUtcDay - startUtcDay) / (24 * 60 * 60 * 1000)));
}

function resolveCandidateBounds(candidate: Pick<CandidateResult, "legs">) {
  if (candidate.legs.length === 0) {
    return null;
  }

  const departureMs = Math.min(...candidate.legs.map((leg) => new Date(leg.departureAt).getTime()));
  const arrivalMs = Math.max(...candidate.legs.map((leg) => new Date(leg.arrivalAt).getTime()));

  return {
    arrivalAt: new Date(arrivalMs).toISOString(),
    arrivalMs,
    departureAt: new Date(departureMs).toISOString(),
    departureMs
  };
}

function resolveGroupBounds(group: { variants: CandidateResult[] }) {
  const variantBounds = group.variants
    .map((variant) => resolveCandidateBounds(variant))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (variantBounds.length === 0) {
    return null;
  }

  const departureMs = Math.min(...variantBounds.map((entry) => entry.departureMs));
  const arrivalMs = Math.max(...variantBounds.map((entry) => entry.arrivalMs));

  return {
    arrivalAt: new Date(arrivalMs).toISOString(),
    arrivalMs,
    departureAt: new Date(departureMs).toISOString(),
    departureMs
  };
}

function resolveTimelineBounds(groups: Array<{ variants: CandidateResult[] }>) {
  const bounds = groups
    .map((group) => resolveGroupBounds(group))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (bounds.length === 0) {
    return null;
  }

  return {
    arrivalAt: new Date(Math.max(...bounds.map((entry) => entry.arrivalMs))).toISOString(),
    arrivalMs: Math.max(...bounds.map((entry) => entry.arrivalMs)),
    departureAt: new Date(Math.min(...bounds.map((entry) => entry.departureMs))).toISOString(),
    departureMs: Math.min(...bounds.map((entry) => entry.departureMs))
  };
}

function resolveSegmentTimelines(candidate: Pick<CandidateResult, "legs" | "stopovers">) {
  const segmentGroups = ["outbound", "return"] as const;

  return segmentGroups
    .map((segmentGroup) => {
      const segmentLegs = candidate.legs.filter((leg) => leg.segmentGroup === segmentGroup);

      if (segmentLegs.length === 0) {
        return null;
      }

      const firstLeg = segmentLegs[0];
      const finalLeg = segmentLegs[segmentLegs.length - 1];
      const departureMs = new Date(firstLeg.departureAt).getTime();
      const arrivalMs = new Date(finalLeg.arrivalAt).getTime();
      const durationMinutes = Math.max(1, Math.round((arrivalMs - departureMs) / 60_000));
      const segmentStopovers = candidate.stopovers.filter((stopover) => {
        const compareIso = stopover.departureAt ?? stopover.arrivalAt;

        if (!compareIso) {
          return false;
        }

        const compareMs = new Date(compareIso).getTime();
        return compareMs >= departureMs && compareMs <= arrivalMs;
      });
      const stopMarkers = segmentStopovers
    .map((stopover) => {
      if (!stopover.arrivalAt || !stopover.departureAt) {
        return null;
      }

      const midpointMs =
        (new Date(stopover.arrivalAt).getTime() + new Date(stopover.departureAt).getTime()) / 2;

      return {
        cityCode: stopover.cityCode,
        isIntentional: stopover.isIntentional,
        leftPercent: clampPercentage(((midpointMs - departureMs) / Math.max(arrivalMs - departureMs, 1)) * 100)
      };
    })
    .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

      return {
        arrivalAt: finalLeg.arrivalAt,
        arrivalDayShift: getCalendarDayShift(firstLeg.departureAt, finalLeg.arrivalAt),
        arrivalTimeLabel: formatExactTime(finalLeg.arrivalAt),
        departureAt: firstLeg.departureAt,
        departureTimeLabel: formatExactTime(firstLeg.departureAt),
        durationMinutes,
        label: segmentGroup === "outbound" ? "Outbound route" : "Return route",
        providerLabel: buildRouteProviderLabel(segmentLegs),
        routeLabel: `${firstLeg.originAirport} to ${finalLeg.destinationAirport}`,
        stopCountLabel:
          segmentStopovers.length > 0
            ? `${segmentStopovers.length} stop${segmentStopovers.length === 1 ? "" : "s"}`
            : "Direct",
        stopMarkers
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function SpinnerBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-emerald-300 border-r-emerald-800" />
      Running
    </span>
  );
}

function buildHoverLabel(candidate: Pick<CandidateResult, "legs" | "stopovers">, variantCount: number) {
  const outboundLegs = candidate.legs.filter((leg) => leg.segmentGroup === "outbound");
  const firstOutbound = outboundLegs[0];
  const finalOutbound = outboundLegs[outboundLegs.length - 1];
  const firstReturn = candidate.legs.find((leg) => leg.segmentGroup === "return") ?? null;
  const outboundStopovers = candidate.stopovers.filter((stopover) => {
    const compareIso = stopover.departureAt ?? stopover.arrivalAt;

    if (!compareIso) {
      return false;
    }

    return firstReturn
      ? new Date(compareIso).getTime() < new Date(firstReturn.departureAt).getTime()
      : true;
  });
  const stopSummary =
    outboundStopovers.length > 0
      ? outboundStopovers
          .map(
            (stopover) =>
              `${stopover.cityCode} ${formatDurationMinutes(stopover.durationMinutes)} ${stopover.isIntentional ? "intentional" : "incidental"}`
          )
          .join(", ")
      : "Direct";

  return [
    `Depart: ${
      firstOutbound
        ? `${formatExactDateTime(firstOutbound.departureAt)} ${firstOutbound.originAirport}`
        : "Not recorded"
    }`,
    `Arrive: ${
      finalOutbound
        ? `${formatExactDateTime(finalOutbound.arrivalAt)} ${finalOutbound.destinationAirport}`
        : "Not recorded"
    }`,
    `Stops: ${stopSummary}`,
    variantCount > 1 ? `Grouped variants: ${variantCount}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function CandidateVariantDetails(props: { candidate: CandidateResult; variantCount: number }) {
  const outboundLegs = props.candidate.legs.filter((leg) => leg.segmentGroup === "outbound");
  const returnLegs = props.candidate.legs.filter((leg) => leg.segmentGroup === "return");
  const firstOutbound = outboundLegs[0] ?? props.candidate.legs[0] ?? null;
  const finalReturn =
    returnLegs[returnLegs.length - 1] ?? props.candidate.legs[props.candidate.legs.length - 1] ?? null;
  const segmentTimelines = resolveSegmentTimelines(props.candidate);
  const maxSegmentDurationMinutes = Math.max(
    ...segmentTimelines.map((entry) => entry.durationMinutes),
    1
  );
  const stopoverStatus = buildStopoverStatusLabel(props.candidate.stopovers);

  return (
    <div className="rounded-[18px] border border-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {firstOutbound ? formatExactDateTime(firstOutbound.departureAt) : "Departure pending"}
            {" -> "}
            {finalReturn ? formatExactDateTime(finalReturn.arrivalAt) : "Return pending"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {props.candidate.bookingType} | {formatDurationMinutes(props.candidate.totalTravelMinutes ?? null)} total travel
            {props.variantCount > 1 ? " | grouped variant" : ""}
          </p>
          <div className="mt-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                stopoverStatus.tone === "intentional"
                  ? "bg-emerald-100 text-emerald-800"
                  : stopoverStatus.tone === "recorded"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
              }`}
              title={stopoverStatus.tooltip}
            >
              {stopoverStatus.label}
            </span>
          </div>
          {props.candidate.riskNotes ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">{props.candidate.riskNotes}</p>
          ) : null}
        </div>
        <div className="rounded-[16px] bg-mist px-3 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fare</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatMoney(
              props.candidate.displayedDisplayCurrency,
              props.candidate.displayedDisplayAmount
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-[16px] bg-mist px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">
            Route timelines
          </p>
          <div className="mt-3 space-y-4">
            {segmentTimelines.map((segment) => {
              const lineWidthPercent = clampPercentage(
                (segment.durationMinutes / maxSegmentDurationMinutes) * 100
              );

              return (
                <div key={`${props.candidate.id}-${segment.label}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{segment.label}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {segment.providerLabel} | {segment.routeLabel}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDurationMinutes(segment.durationMinutes)} | {segment.stopCountLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
                    <div className="min-w-[56px] text-sm font-semibold text-ink md:text-right">
                      {segment.departureTimeLabel}
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <div
                        className="relative h-8"
                        style={{ width: `${Math.max(28, lineWidthPercent)}%` }}
                      >
                        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
                        <div className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-emerald-500" />
                        {segment.stopMarkers.map((marker, index) => (
                          <span
                            key={`${props.candidate.id}-${segment.label}-${marker.cityCode}-${index}`}
                            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${
                              marker.isIntentional ? "bg-emerald-700" : "bg-slate-600"
                            }`}
                            style={{ left: `${marker.leftPercent}%` }}
                            title={`${marker.cityCode} ${marker.isIntentional ? "intentional" : "incidental"} stop`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="min-w-[72px] text-sm font-semibold text-ink">
                      <span>{segment.arrivalTimeLabel}</span>
                      {segment.arrivalDayShift > 0 ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                          +{segment.arrivalDayShift}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {props.candidate.legs.map((leg) => (
          <div
            key={leg.id}
            className="rounded-[16px] bg-mist px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">
                  {leg.segmentGroup === "outbound" ? "Outbound flight" : "Return flight"}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatProviderLabel(leg)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {leg.originAirport} to {leg.destinationAirport}
                </p>
                {leg.fareBrand ? (
                  <p className="mt-1 text-sm text-slate-500">{leg.fareBrand}</p>
                ) : null}
              </div>
              <div className="text-sm text-slate-600">
                <p>Depart {formatExactDateTime(leg.departureAt)}</p>
                <p className="mt-1">Arrive {formatExactDateTime(leg.arrivalAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {props.candidate.stopovers.length > 0 ? (
        <div className="mt-4 rounded-[16px] bg-mist px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">
            Stopovers
          </p>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            {props.candidate.stopovers.map((stopover) => (
              <p key={stopover.id}>
                {stopover.cityCode} ({stopover.airportCode}) | {formatDurationMinutes(stopover.durationMinutes)} |{" "}
                {stopover.isIntentional ? "intentional" : "incidental"}
                {stopover.arrivalAt ? ` | arrive ${formatExactDateTime(stopover.arrivalAt)}` : ""}
                {stopover.departureAt ? ` | depart ${formatExactDateTime(stopover.departureAt)}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LiveResultsBoard({
  initialPayload,
  sessionId
}: LiveResultsBoardProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [_, startTransition] = useTransition();
  const lastFingerprintRef = useRef(fingerprintPayload(initialPayload));
  const inflightRef = useRef(false);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      if (document.hidden || inflightRef.current) {
        return;
      }

      inflightRef.current = true;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/results-live`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const nextPayload = (await response.json()) as ResultsLivePayload;
        const nextFingerprint = fingerprintPayload(nextPayload);
        if (nextFingerprint === lastFingerprintRef.current) {
          return;
        }

        lastFingerprintRef.current = nextFingerprint;
        startTransition(() => {
          setPayload(nextPayload);
        });
      } finally {
        inflightRef.current = false;
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [sessionId]);

  const progress = payload.progress;
  const groupedCandidates = useMemo(() => {
    const nextCandidates = progress?.candidates ?? [];
    const normalizedCandidates: CandidateResult[] = nextCandidates.map((candidate) => ({
      ...candidate,
      intentionalStopCount: candidate.intentionalStopCount ?? 0,
      isCurrentBest: candidate.isCurrentBest ?? false,
      isShortlisted: false,
      runId: progress?.run.id ?? "latest-live-run",
      sessionId
    }));

    return buildCandidateRecommendationGroups(normalizedCandidates).recommendationGroups;
  }, [progress?.candidates, progress?.run, sessionId]);
  const roundTripGroups = useMemo(
    () => groupedCandidates.filter((group) => !isMultiCityCandidate(group.representative)),
    [groupedCandidates]
  );
  const multiCityGroups = useMemo(
    () => groupedCandidates.filter((group) => isMultiCityCandidate(group.representative)),
    [groupedCandidates]
  );

  const runStatus = progress?.run.status ?? payload.status;
  const active = runStatus === "queued" || runStatus === "running";
  const roundTripHighlightedIds = new Set(
    roundTripGroups.slice(0, 3).map((group) => group.representative.id)
  );
  const multiCityHighlightedIds = new Set(
    multiCityGroups.slice(0, 3).map((group) => group.representative.id)
  );
  const roundTripTimelineBounds = resolveTimelineBounds(roundTripGroups);
  const multiCityTimelineBounds = resolveTimelineBounds(multiCityGroups);

  function renderTimelineSection(props: {
    emptyCopy: string;
    groups: typeof groupedCandidates;
    highlightedIds: Set<string>;
    summaryAxisLabel: string;
    summaryKindLabel: string;
    timelineBounds: ReturnType<typeof resolveTimelineBounds>;
    title: string;
  }) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink">{props.title}</p>
          <p className="mt-1 text-sm text-slate-500">{props.summaryKindLabel}</p>
        </div>
        {props.timelineBounds ? (
          <div className="grid gap-3 rounded-[18px] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[90px_1fr_90px_140px] md:items-center">
            <span>{formatJourneyDate(props.timelineBounds.departureAt)}</span>
            <span className="text-center">{props.summaryAxisLabel}</span>
            <span className="md:text-right">{formatJourneyDate(props.timelineBounds.arrivalAt)}</span>
            <span className="md:text-right">Representative fare</span>
          </div>
        ) : null}
          {props.groups.length > 0 ? (
            props.groups.map((group) => (
              <ResultGroupRow
                key={group.groupKey}
                group={group}
                highlighted={props.highlightedIds.has(group.representative.id)}
                timelineBounds={props.timelineBounds}
              />
            ))
          ) : (
            <div className="rounded-[20px] bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
              {props.emptyCopy}
            </div>
          )}
      </div>
    );
  }

  function ResultGroupRow(props: {
    group: { groupKey: string; representative: CandidateResult; variants: CandidateResult[] };
    highlighted: boolean;
    timelineBounds: ReturnType<typeof resolveTimelineBounds>;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const candidate = props.group.representative;
    const groupBounds = resolveGroupBounds(props.group);

    if (!groupBounds || !props.timelineBounds) {
      return null;
    }

    const totalRangeMs = Math.max(
      1,
      props.timelineBounds.arrivalMs - props.timelineBounds.departureMs
    );
    const lineStartPercent = clampPercentage(
      ((groupBounds.departureMs - props.timelineBounds.departureMs) / totalRangeMs) * 100
    );
    const lineWidthPercent = clampPercentage(
      ((groupBounds.arrivalMs - groupBounds.departureMs) / totalRangeMs) * 100
    );
    const outboundLegs = candidate.legs.filter((leg) => leg.segmentGroup === "outbound");
    const representativeProvider = buildRouteProviderLabel(outboundLegs);
    const outboundDestination =
      outboundLegs[outboundLegs.length - 1]?.destinationAirport ?? candidate.outboundDestinationCity;
    const stopoverStatus = buildStopoverStatusLabel(candidate.stopovers);
    const tripKindLabel = isMultiCityCandidate(candidate) ? "Multi-city itinerary" : "Round trip";

    return (
      <details
        className={`rounded-[20px] ${props.highlighted ? "bg-white shadow-sm" : "bg-white/70"}`}
        onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary
          className="list-none cursor-pointer px-4 py-4 marker:hidden"
          title={buildHoverLabel(candidate, props.group.variants.length)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{representativeProvider}</p>
              <p className="mt-1 text-sm text-slate-600">
                {outboundLegs[0]?.originAirport ?? "Origin pending"} to {outboundDestination}{" "}
                {tripKindLabel.toLowerCase()}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {tripKindLabel}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    stopoverStatus.tone === "intentional"
                      ? "bg-emerald-100 text-emerald-800"
                      : stopoverStatus.tone === "recorded"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                  title={stopoverStatus.tooltip}
                >
                  {stopoverStatus.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tracking-tight text-ink">
                {formatMoney(candidate.displayedDisplayCurrency, candidate.displayedDisplayAmount)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                {props.group.variants.length > 1
                  ? `${props.group.variants.length} timing variants`
                  : "Single routing"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[90px_1fr_90px_140px] md:items-center">
            <div className="text-sm font-semibold text-ink">
              {formatCompactDate(groupBounds.departureAt)}
            </div>
            <div className="relative h-8">
              <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
              <div
                className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${
                  props.highlighted ? "bg-emerald-500" : "bg-sky-400"
                }`}
                style={{
                  left: `${lineStartPercent}%`,
                  width: `${Math.max(2, lineWidthPercent)}%`
                }}
                title={`${formatJourneyDate(groupBounds.departureAt)} to ${formatJourneyDate(groupBounds.arrivalAt)}`}
              />
            </div>
            <div className="text-sm font-semibold text-ink md:text-right">
              {formatCompactDate(groupBounds.arrivalAt)}
            </div>
            <div className="text-sm text-slate-600 md:text-right">
              <p className="font-semibold text-ink">
                {props.group.variants.length > 1
                  ? `${props.group.variants.length} variants`
                  : "1 variant"}
              </p>
              <p className="mt-1">Expand for route lines</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Expand to inspect separate outbound and return lines for each exact route variant.
          </p>
        </summary>
        {isOpen ? (
          <div className="border-t border-line px-3 pb-3 pt-4">
            <div className="rounded-[18px] bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-ink">Exact flight details</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Variants are only grouped when the provider chain matches exactly and the
                differences are timing-only.
              </p>
              <div className="mt-4 space-y-4">
                {props.group.variants.map((variant) => (
                  <CandidateVariantDetails
                    key={variant.id}
                    candidate={variant}
                    variantCount={props.group.variants.length}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </details>
    );
  }

  return (
    <section className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            {active ? "Live search timeline" : "Latest run timeline"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {progress?.run.summaryText ?? "Timeline view of recorded routes"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            The timeline is split between round-trip and multi-city itineraries. Each section
            keeps grouped rows aligned on its own shared date axis from the earliest departure to
            the latest arrival. Expand a row to inspect separate outbound and return route lines
            for each exact route variant.
          </p>
        </div>
        {active ? <SpinnerBadge /> : null}
      </div>

      <div className="mt-8 rounded-[24px] bg-mist/60 p-5">
        <div className="rounded-[18px] bg-white/70 px-4 py-3 text-sm text-slate-600">
          The grouped summary uses trip dates within each trip type section. Inside the details
          area, each exact route variant shows separate outbound and return timeline lines. A small{" "}
          <span className="font-semibold text-ink">+1</span> badge means the route arrives the
          next day.
        </div>
        <div className="mt-4 space-y-6">
          {renderTimelineSection({
            emptyCopy: active
              ? "The run is active. Round-trip rows will stack here as candidates are recorded."
              : "No round-trip route lines are available for the latest run yet.",
            groups: roundTripGroups,
            highlightedIds: roundTripHighlightedIds,
            summaryAxisLabel: "Round-trip date axis",
            summaryKindLabel:
              "Baseline, verification, and other round-trip candidates stay grouped here.",
            timelineBounds: roundTripTimelineBounds,
            title: "Round-trip routes"
          })}
          {renderTimelineSection({
            emptyCopy: active
              ? "The run is active. Multi-city rows will appear here when true multi-city candidates are recorded."
              : "No multi-city route lines are available for the latest run yet.",
            groups: multiCityGroups,
            highlightedIds: multiCityHighlightedIds,
            summaryAxisLabel: "Multi-city date axis",
            summaryKindLabel:
              "True multi-city itineraries are shown separately so they do not blend into normal round trips.",
            timelineBounds: multiCityTimelineBounds,
            title: "Multi-city routes"
          })}
        </div>
      </div>
    </section>
  );
}
