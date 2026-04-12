import { RouteSectionAlt } from "@/components/candidates/route-section-alt";
import {
  formatDurationMinutes,
  isDisplayedIntentionalStopover
} from "@/lib/formatting";

type CandidateFlightVisualLeg = {
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

type CandidateFlightVisualStopover = {
  airportCode: string;
  arrivalAt?: string;
  cityCode: string;
  departureAt?: string;
  durationMinutes: number;
  id: string;
  isIntentional: boolean;
};

type CandidateFlightVisualSectionProps = {
  className?: string;
  legs: CandidateFlightVisualLeg[];
  routeClassName?: string;
  showStopDetails?: boolean;
  stopDurationMinDays?: number | null;
  stopovers: CandidateFlightVisualStopover[];
};

export function CandidateFlightVisualSection({
  className,
  legs,
  routeClassName,
  showStopDetails = true,
  stopDurationMinDays,
  stopovers
}: CandidateFlightVisualSectionProps) {
  return (
    <div className={className}>
      <RouteSectionAlt
        className={routeClassName}
        legs={legs}
        stopDurationMinDays={stopDurationMinDays}
        stopovers={stopovers}
      />

      {showStopDetails && stopovers.length > 0 ? (
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
                {stopover.cityCode} ({stopover.airportCode}){" "}
                {formatDurationMinutes(stopover.durationMinutes)}
                {isDisplayedIntentionalStopover(stopover, stopDurationMinDays)
                  ? " intentional"
                  : " incidental"}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
