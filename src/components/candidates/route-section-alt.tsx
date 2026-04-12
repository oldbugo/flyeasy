import { cn } from "@/components/shared/ui";
import {
  formatDurationMinutes,
  getMinimumIntentionalStopDurationMinutes
} from "@/lib/formatting";

type RouteSectionAltLeg = {
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

type RouteSectionAltStopover = {
  airportCode: string;
  arrivalAt?: string;
  cityCode: string;
  departureAt?: string;
  durationMinutes: number;
  id: string;
  isIntentional: boolean;
};

type RouteSectionAltProps = {
  className?: string;
  legs: RouteSectionAltLeg[];
  stopDurationMinDays?: number | null;
  stopovers: RouteSectionAltStopover[];
};

type RouteTone = "info" | "neutral" | "success";

type RouteSegment = {
  arrivalAt: string;
  departureAt: string;
  durationMinutes: number;
  endAirportCode: string;
  endTone: RouteTone;
  key: string;
  lineTone: RouteTone;
  startAirportCode: string;
  startTone: RouteTone;
};

type RouteBreak = {
  durationLabel: string;
  key: string;
  tone: Exclude<RouteTone, "neutral">;
};

type RouteSectionAltModel = {
  breaks: RouteBreak[];
  segments: RouteSegment[];
};

export function RouteSectionAlt({
  className,
  legs,
  stopDurationMinDays,
  stopovers
}: RouteSectionAltProps) {
  const model = buildRouteSectionAltModel(legs, stopovers, stopDurationMinDays);

  if (!model || model.segments.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[22px] border border-dashed border-line bg-white/70 px-4 py-4 text-sm text-slate-500",
          className
        )}
      >
        No extracted flight details yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {model.segments.map((segment, index) => (
        <div key={segment.key} className="space-y-2">
          <RouteLane segment={segment} />
          {index < model.breaks.length ? <RouteStayBand stayBreak={model.breaks[index]} /> : null}
        </div>
      ))}
    </div>
  );
}

function buildRouteSectionAltModel(
  legs: RouteSectionAltLeg[],
  stopovers: RouteSectionAltStopover[],
  stopDurationMinDays: number | null | undefined
): RouteSectionAltModel | null {
  if (legs.length === 0) {
    return null;
  }

  const thresholdMinutes = getMinimumIntentionalStopDurationMinutes(stopDurationMinDays);
  const orderedGroups = new Map<string, RouteSectionAltLeg[]>();
  const sortedLegs = [...legs].sort(
    (left, right) =>
      new Date(left.departureAt).getTime() - new Date(right.departureAt).getTime()
  );

  for (const leg of sortedLegs) {
    const current = orderedGroups.get(leg.segmentGroup) ?? [];
    current.push(leg);
    orderedGroups.set(leg.segmentGroup, current);
  }

  const rawSegments = [...orderedGroups.values()].map((segmentLegs) => {
    const firstLeg = segmentLegs[0];
    const lastLeg = segmentLegs[segmentLegs.length - 1];

    return {
      arrivalAt: lastLeg.arrivalAt,
      departureAt: firstLeg.departureAt,
      durationMinutes: Math.max(
        1,
        Math.round(
          (new Date(lastLeg.arrivalAt).getTime() - new Date(firstLeg.departureAt).getTime()) /
            60_000
        )
      ),
      endAirportCode: lastLeg.destinationAirport,
      startAirportCode: firstLeg.originAirport
    };
  });

  const breaks: RouteBreak[] = rawSegments.slice(0, -1).map((segment, index) => {
    const nextSegment = rawSegments[index + 1];
    const gapMinutes = Math.max(
      0,
      Math.round(
        (new Date(nextSegment.departureAt).getTime() - new Date(segment.arrivalAt).getTime()) /
          60_000
      )
    );
    const breakTone: RouteBreak["tone"] = stopovers.some(
      (stopover) =>
        stopover.isIntentional &&
        stopover.airportCode === segment.endAirportCode &&
        stopover.durationMinutes >= thresholdMinutes
    )
      ? "success"
      : "info";

    return {
      durationLabel: formatStayDuration(gapMinutes),
      key: `${segment.arrivalAt}-${nextSegment.departureAt}-${segment.endAirportCode}`,
      tone: breakTone
    };
  });

  const segments: RouteSegment[] = rawSegments.map((segment, index) => ({
    ...segment,
    endTone: index < breaks.length ? breaks[index].tone : "neutral",
    key: `${segment.startAirportCode}-${segment.departureAt}-${segment.endAirportCode}-${segment.arrivalAt}`,
    lineTone: index === 0 ? "neutral" : breaks[index - 1].tone,
    startTone: index === 0 ? "neutral" : breaks[index - 1].tone
  }));

  return {
    breaks,
    segments
  };
}

function RouteLane({ segment }: { segment: RouteSegment }) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(7.25rem,8.75rem)_minmax(0,1fr)_minmax(7.25rem,8.75rem)] md:items-center">
      <RouteEndpointCard
        airportCode={segment.startAirportCode}
        dateLabel={formatJourneyDate(segment.departureAt)}
        tone={segment.startTone}
      />

      <div className="flex items-center gap-4">
        <div className={cn("h-[3px] min-w-[2rem] flex-1 rounded-full", getLineToneClassName(segment.lineTone))} />
        <span
          className={cn(
            "shrink-0 rounded-full border bg-white px-4 py-2 text-base font-semibold leading-none",
            getChipToneClassName(segment.lineTone)
          )}
        >
          {formatDurationMinutes(segment.durationMinutes)}
        </span>
        <div className={cn("h-[3px] min-w-[2rem] flex-1 rounded-full", getLineToneClassName(segment.lineTone))} />
      </div>

      <RouteEndpointCard
        airportCode={segment.endAirportCode}
        dateLabel={formatJourneyDate(segment.arrivalAt)}
        tone={segment.endTone}
      />
    </div>
  );
}

function RouteStayBand({ stayBreak }: { stayBreak: RouteBreak }) {
  return (
    <div
      className={cn(
        "rounded-full px-4 py-2 text-center text-lg font-semibold tracking-[-0.02em]",
        stayBreak.tone === "success"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-sky-100 text-[#315A8D]"
      )}
    >
      {stayBreak.durationLabel}
    </div>
  );
}

function RouteEndpointCard({
  airportCode,
  dateLabel,
  tone
}: {
  airportCode: string;
  dateLabel: string;
  tone: RouteTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[26px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "info"
            ? "border-sky-200 bg-sky-50 text-[#315A8D]"
            : "border-[#0F172A] bg-white text-[#102033]"
      )}
    >
      <p className="text-[2.25rem] font-semibold leading-none tracking-[-0.05em]">
        {airportCode}
      </p>
      <p className="mt-2 text-sm font-semibold leading-5">{dateLabel}</p>
    </div>
  );
}

function formatJourneyDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    weekday: "short"
  }).format(new Date(value));
}

function formatStayDuration(minutes: number) {
  if (minutes >= 24 * 60) {
    const days = Math.max(1, Math.round(minutes / (24 * 60)));
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return formatDurationMinutes(minutes);
}

function getLineToneClassName(tone: RouteTone) {
  if (tone === "success") {
    return "bg-[#2F7F56]";
  }

  if (tone === "info") {
    return "bg-[#6C8FC0]";
  }

  return "bg-[#0F172A]";
}

function getChipToneClassName(tone: RouteTone) {
  if (tone === "success") {
    return "border-[#2F7F56] text-[#0F172A]";
  }

  if (tone === "info") {
    return "border-[#6C8FC0] text-[#0F172A]";
  }

  return "border-[#0F172A] text-[#0F172A]";
}
