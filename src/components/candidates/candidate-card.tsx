import Link from "next/link";

import {
  clearShortlistStatusAction,
  setShortlistStatusAction
} from "@/app/sessions/actions";
import {
  Panel,
  getButtonClassName,
  getPillClassName
} from "@/components/shared/ui";
import {
  formatDurationMinutes,
  formatIsoDate,
  formatIsoTime,
  formatMoney,
  formatStopSummary,
  getMinimumIntentionalStopDurationMinutes,
  isDisplayedIntentionalStopover,
  resolveDisplayedIntentionalStopCount,
  resolveDisplayedStopCount
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
  runId: string;
  sessionId: string;
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

function groupLegs(legs: CandidateLegSummary[], segmentGroup: string) {
  return legs.filter((leg) => leg.segmentGroup === segmentGroup);
}

function LegRow({
  label,
  legs,
  stopovers,
  stopDurationMinDays
}: {
  label: string;
  legs: CandidateLegSummary[];
  stopDurationMinDays?: number | null;
  stopovers: CandidateStopoverSummary[];
}) {
  if (legs.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-line bg-white/70 px-4 py-4 text-sm text-slate-500">
        {label}: not extracted yet.
      </div>
    );
  }

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const carrierLabel = firstLeg.flightNumber ?? firstLeg.carrierCode ?? "Carrier pending";
  const thresholdMinutes = getMinimumIntentionalStopDurationMinutes(stopDurationMinDays);
  const intentionalStopovers = stopovers.filter(
    (stopover) =>
      stopover.durationMinutes >= thresholdMinutes &&
      stopover.isIntentional
  );

  return (
    <div className="rounded-[22px] bg-[var(--surface-subtle)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">{label}</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {formatIsoDate(firstLeg.departureAt)}
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {legs.length > 1 ? `${legs.length} flight legs` : "Single flight leg"}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {formatIsoTime(firstLeg.departureAt)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{firstLeg.originAirport}</p>
        </div>
        <div className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <p>{carrierLabel}</p>
          <p className="mt-2 text-sm normal-case tracking-normal text-slate-500">
            {intentionalStopovers.length > 0
              ? `${firstLeg.originAirport} -> ${intentionalStopovers
                  .map((stopover) => stopover.cityCode)
                  .join(" -> ")} -> ${lastLeg.destinationAirport}`
              : legs.length > 1
                ? `via ${legs.length - 1} change${legs.length === 2 ? "" : "s"}`
                : "direct leg"}
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {formatIsoTime(lastLeg.arrivalAt)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{lastLeg.destinationAirport}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {legs
          .map((leg) => leg.flightNumber ?? leg.carrierCode ?? leg.fareBrand ?? "Trip.com fare")
          .join(" | ")}
      </p>
      {intentionalStopovers.length > 0 ? (
        <p className="mt-2 text-sm text-sea">
          Intentional stop:{" "}
          {intentionalStopovers
            .map(
              (stopover) =>
                `${stopover.cityCode} for ${formatDurationMinutes(stopover.durationMinutes)}`
            )
            .join(" | ")}
        </p>
      ) : null}
    </div>
  );
}

export function CandidateCard({
  bookingType,
  candidateId,
  currency,
  fare,
  href,
  isCurrentBest = false,
  isShortlisted = false,
  intentionalStopCount,
  outboundDestinationCity,
  riskNotes,
  runId,
  sessionId,
  stopDurationMinDays,
  status,
  stopCount,
  stitchedRiskLevel,
  totalTravelMinutes,
  legs,
  stopovers,
  variantDateRanges = [],
  variantGroupCount = 1
}: CandidateCardProps) {
  const returnTo = `/sessions/${sessionId}/results`;
  const outboundLegs = groupLegs(legs, "outbound");
  const returnLegs = groupLegs(legs, "return");
  const displayedIntentionalStopCount = resolveDisplayedIntentionalStopCount({
    stopDurationMinDays,
    stopovers,
    storedIntentionalStopCount: intentionalStopCount
  });
  const displayedStopCount = resolveDisplayedStopCount({
    extractedStopoverCount: stopovers.length,
    intentionalStopCount: displayedIntentionalStopCount,
    storedStopCount: stopCount
  });

  return (
    <Panel as="article" className="p-6">
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
          <p className="mt-2 text-sm text-slate-600">
            {outboundDestinationCity} |{" "}
            {formatStopSummary(displayedStopCount, displayedIntentionalStopCount)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {bookingType} | {formatDurationMinutes(totalTravelMinutes ?? null)} total travel | {status}
            {stitchedRiskLevel ? ` | ${stitchedRiskLevel} stitched risk` : ""}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/70 bg-[var(--surface-subtle)] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Run</p>
          <p className="mt-1 text-sm font-medium text-ink">{runId.slice(-8)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <LegRow
          label="Outbound"
          legs={outboundLegs}
          stopDurationMinDays={stopDurationMinDays}
          stopovers={stopovers.filter((stopover) =>
            isDisplayedIntentionalStopover(stopover, stopDurationMinDays)
          )}
        />
        <LegRow
          label="Return"
          legs={returnLegs}
          stopDurationMinDays={stopDurationMinDays}
          stopovers={stopovers.filter((stopover) =>
            isDisplayedIntentionalStopover(stopover, stopDurationMinDays)
          )}
        />
      </div>

      {stopovers.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Stop details
          </p>
          <div className="flex flex-wrap gap-2">
            {stopovers.map((stopover) => (
              <span
                key={stopover.id}
                className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-600"
              >
                {stopover.cityCode} ({stopover.airportCode}) {formatDurationMinutes(stopover.durationMinutes)}
                {isDisplayedIntentionalStopover(stopover, stopDurationMinDays)
                  ? " intentional"
                  : " incidental"}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {variantGroupCount > 1 ? (
        <div className="mt-5 rounded-[22px] border border-line bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
              Grouped date variants
            </p>
            <p className="text-sm font-medium text-slate-600">{variantGroupCount} similar options</p>
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

      <p className="mt-5 text-sm leading-7 text-slate-600">
        {riskNotes ?? "Displayed Trip.com itinerary for manual review and booking handoff."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={href as never}
          className={getButtonClassName({ size: "sm", tone: "primary" })}
        >
          Candidate detail
        </Link>
        {isShortlisted ? (
          <form action={clearShortlistStatusAction}>
            <input type="hidden" name="candidateId" value={candidateId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold tracking-[-0.01em] text-amber-800 transition hover:border-amber-500 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2"
            >
              Remove shortlist
            </button>
          </form>
        ) : (
          <form action={setShortlistStatusAction}>
            <input type="hidden" name="candidateId" value={candidateId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="status" value="shortlisted" />
            <button
              type="submit"
              className={getButtonClassName({ size: "sm", tone: "secondary" })}
            >
              Shortlist
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}
