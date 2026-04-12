import { resolveCityInput } from "@/lib/locations/catalog";
import { formatDateChip } from "@/lib/time/formatting";

export type JourneyPreviewTone = "default" | "info" | "success" | "warning";

export type JourneyPreviewRow = {
  durationLabel: string;
  endCode: string;
  endDateLabel: string;
  endTimeLabel: string;
  endTone: JourneyPreviewTone;
  startCode: string;
  startDateLabel: string;
  startTimeLabel: string;
  startTone: JourneyPreviewTone;
  stayDurationLabel: string | null;
};

type BuildJourneyPreviewRowsProps = {
  departureStartDate: string;
  fallbackDestinationLabel: string;
  legs: Array<{
    arrivalAt: string;
    departureAt: string;
    destinationAirport: string;
    originAirport: string;
  }>;
  originAirport: string;
};

function resolveDestinationCode(cityName: string) {
  return resolveCityInput(cityName)?.code ?? cityName.slice(0, 3).toUpperCase();
}

function formatTimeChip(iso: string | null | undefined) {
  if (!iso) {
    return "Time pending";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Time pending";
  }

  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit"
  })
    .format(date)
    .replace(/\s/g, "")
    .toLowerCase();
}

export function formatJourneyPreviewDuration(totalMinutes: number | null) {
  if (totalMinutes === null || totalMinutes <= 0) {
    return "Direct";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatLegDurationLabel(
  departureAt: string | null | undefined,
  arrivalAt: string | null | undefined
) {
  if (!departureAt || !arrivalAt) {
    return "Direct";
  }

  const departure = new Date(departureAt);
  const arrival = new Date(arrivalAt);

  if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) {
    return "Direct";
  }

  const totalMinutes = Math.max(1, Math.round((arrival.getTime() - departure.getTime()) / 60_000));
  return formatJourneyPreviewDuration(totalMinutes);
}

function formatStayDurationLabel(
  arrivalAt: string | null | undefined,
  nextDepartureAt: string | null | undefined
) {
  if (!arrivalAt || !nextDepartureAt) {
    return null;
  }

  const arrival = new Date(arrivalAt);
  const nextDeparture = new Date(nextDepartureAt);

  if (Number.isNaN(arrival.getTime()) || Number.isNaN(nextDeparture.getTime())) {
    return null;
  }

  const totalMinutes = Math.round((nextDeparture.getTime() - arrival.getTime()) / 60_000);

  if (totalMinutes <= 0) {
    return null;
  }

  if (totalMinutes >= 1440) {
    const days = Math.max(1, Math.round(totalMinutes / 1440));
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return formatJourneyPreviewDuration(totalMinutes);
}

export function buildJourneyPreviewRows({
  departureStartDate,
  fallbackDestinationLabel,
  legs,
  originAirport
}: BuildJourneyPreviewRowsProps): JourneyPreviewRow[] {
  if (legs.length === 0) {
    return [
      {
        durationLabel: "Direct",
        endCode: resolveDestinationCode(fallbackDestinationLabel),
        endDateLabel: "Date pending",
        endTimeLabel: "Time pending",
        endTone: "info",
        startCode: originAirport,
        startDateLabel: formatDateChip(departureStartDate),
        startTimeLabel: formatTimeChip(departureStartDate),
        startTone: "default",
        stayDurationLabel: null
      }
    ];
  }

  const palette: JourneyPreviewTone[] = ["info", "success", "warning"];
  const tones = new Map<string, JourneyPreviewTone>([[originAirport, "default"]]);
  let paletteIndex = 0;

  for (const leg of legs) {
    for (const airportCode of [leg.originAirport, leg.destinationAirport]) {
      if (airportCode === originAirport) {
        tones.set(airportCode, "default");
        continue;
      }

      if (!tones.has(airportCode)) {
        tones.set(airportCode, palette[Math.min(paletteIndex, palette.length - 1)]);
        paletteIndex += 1;
      }
    }
  }

  return legs.map((leg, index) => ({
    durationLabel: formatLegDurationLabel(leg.departureAt, leg.arrivalAt),
    endCode: leg.destinationAirport,
    endDateLabel: formatDateChip(leg.arrivalAt),
    endTimeLabel: formatTimeChip(leg.arrivalAt),
    endTone: tones.get(leg.destinationAirport) ?? "default",
    startCode: leg.originAirport,
    startDateLabel: formatDateChip(leg.departureAt),
    startTimeLabel: formatTimeChip(leg.departureAt),
    startTone: tones.get(leg.originAirport) ?? "default",
    stayDurationLabel: formatStayDurationLabel(
      leg.arrivalAt,
      legs[index + 1]?.departureAt ?? null
    )
  }));
}
