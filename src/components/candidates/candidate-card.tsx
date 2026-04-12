import type { ReactNode } from "react";
import Link from "next/link";

import {
  JourneyPreviewRoutes
} from "@/components/shared/journey-preview-card";
import {
  Panel,
  getButtonClassName,
  getPillClassName
} from "@/components/shared/ui";
import { buildJourneyPreviewRows } from "@/lib/journeys/route-preview";
import {
  formatMoney,
} from "@/lib/formatting";

type CandidateLegSummary = {
  arrivalAt: string;
  carrierCode: string | null;
  departureAt: string;
  destinationAirport: string;
  fareBrand?: string | null;
  flightNumber: string | null;
  id: string;
  originAirport: string;
  segmentGroup: string;
};

type CandidateStopoverSummary = {
  airportCode: string;
  cityCode: string;
  durationMinutes: number;
  id: string;
  isIntentional: boolean;
};

type CandidateCardProps = {
  bookingType: string;
  candidateId: string;
  currency: string;
  fare: number;
  href: string;
  isCurrentBest?: boolean;
  isShortlisted?: boolean;
  outboundDestinationCity: string;
  riskNotes?: string | null;
  secondaryAction?: ReactNode;
  stopDurationMinDays?: number | null;
  status: string;
  stopCount: number;
  stitchedRiskLevel?: string | null;
  intentionalStopCount?: number;
  totalTravelMinutes?: number | null;
  legs: CandidateLegSummary[];
  stopovers: CandidateStopoverSummary[];
  variantDateRanges?: Array<{
    candidateId: string;
    days: number | null;
    departDate: string | null;
    returnDate: string | null;
  }>;
  variantGroupCount?: number;
};

function formatCompactDate(value: string | null | undefined) {
  if (!value) {
    return "Date pending";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function formatTripWindowSummary(
  outboundDepartureAt: string | null | undefined,
  returnDepartureAt: string | null | undefined
) {
  if (!outboundDepartureAt && !returnDepartureAt) {
    return {
      detail: "Waiting for extracted travel dates",
      label: "Dates pending"
    };
  }

  if (!returnDepartureAt) {
    return {
      detail: "Return date pending",
      label: formatCompactDate(outboundDepartureAt)
    };
  }

  const tripLengthDays = outboundDepartureAt
    ? Math.max(
        0,
        Math.round(
          (new Date(returnDepartureAt).getTime() - new Date(outboundDepartureAt).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : null;

  return {
    detail: tripLengthDays === null ? "Round trip" : `${tripLengthDays} day trip`,
    label: `${formatCompactDate(outboundDepartureAt)} to ${formatCompactDate(returnDepartureAt)}`
  };
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function CandidateCard({
  candidateId,
  currency,
  fare,
  href,
  isCurrentBest = false,
  isShortlisted = false,
  outboundDestinationCity,
  secondaryAction,
  status,
  legs,
  variantDateRanges = [],
  variantGroupCount = 1
}: CandidateCardProps) {
  const tripWindowSummary = formatTripWindowSummary(
    legs.find((leg) => leg.segmentGroup === "outbound")?.departureAt ?? null,
    legs.find((leg) => leg.segmentGroup === "return")?.departureAt ?? null
  );
  const routeRows = buildJourneyPreviewRows({
    departureStartDate: legs[0]?.departureAt ?? new Date().toISOString(),
    fallbackDestinationLabel: outboundDestinationCity,
    legs: legs.map((leg) => ({
      arrivalAt: leg.arrivalAt,
      departureAt: leg.departureAt,
      destinationAirport: leg.destinationAirport,
      originAirport: leg.originAirport
    })),
    originAirport: legs[0]?.originAirport ?? "Origin"
  });
  return (
    <Panel as="article" className="overflow-hidden">
      <div className="px-6 pb-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-semibold tracking-tight text-ink">
                {formatMoney(currency, fare)}
              </h2>
              {isCurrentBest ? (
                <span className={getPillClassName("success")}>Current best</span>
              ) : null}
              {isShortlisted ? (
                <span className={getPillClassName("warning")}>Shortlisted</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-[20px] border border-white/70 bg-[var(--surface-subtle)] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Trip window
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{tripWindowSummary.label}</p>
            <p className="mt-1 text-xs text-slate-500">{tripWindowSummary.detail}</p>
          </div>
        </div>

        <JourneyPreviewRoutes className="mt-6" routeRows={routeRows} />

        {variantGroupCount > 1 ? (
          <div className="mt-5 rounded-[22px] border border-line bg-white px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
                Grouped date variants
              </p>
              <p className="text-sm font-medium text-slate-600">
                {variantGroupCount} similar options
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {variantDateRanges.map((variant) => (
                <p
                  key={variant.candidateId}
                  className={`text-sm ${
                    variant.candidateId === candidateId ? "font-semibold text-ink" : "text-slate-600"
                  }`}
                >
                  {variant.departDate ?? "Unknown"} to {variant.returnDate ?? "Unknown"}
                  {variant.days !== null ? ` | ${variant.days} days` : ""}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-line/80 bg-slate-50/85 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className={`${getPillClassName("info")} px-4 py-2 text-[12px]`}>
            {humanizeLabel(status)}
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {tripWindowSummary.label}
            {tripWindowSummary.detail ? ` | ${tripWindowSummary.detail}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            href={href as never}
            className={getButtonClassName({ size: "md", tone: "primary" })}
          >
            Candidate detail
          </Link>
          {secondaryAction}
        </div>
      </div>
    </Panel>
  );
}
