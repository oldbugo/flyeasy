function formatUnit(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatRelativeCountdown(targetIso: string | null | undefined, now = new Date()) {
  if (!targetIso) {
    return "Refresh schedule pending";
  }

  const target = new Date(targetIso);
  const deltaMs = target.getTime() - now.getTime();

  if (Number.isNaN(target.getTime())) {
    return "Refresh schedule pending";
  }

  if (deltaMs <= 0) {
    return "Refresh due now";
  }

  const totalMinutes = Math.max(1, Math.round(deltaMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `Next refresh in ${formatUnit(hours, "hour")} ${formatUnit(minutes, "minute")}`;
  }

  if (hours > 0) {
    return `Next refresh in ${formatUnit(hours, "hour")}`;
  }

  return `Next refresh in ${formatUnit(minutes, "minute")}`;
}

export function formatRelativePast(targetIso: string | null | undefined, now = new Date()) {
  if (!targetIso) {
    return "No completed refresh yet";
  }

  const target = new Date(targetIso);
  const deltaMs = now.getTime() - target.getTime();

  if (Number.isNaN(target.getTime())) {
    return "No completed refresh yet";
  }

  if (deltaMs < 60_000) {
    return "Checked just now";
  }

  const totalMinutes = Math.floor(deltaMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `Checked ${formatUnit(days, "day")} ago`;
  }

  if (hours > 0) {
    return `Checked ${formatUnit(hours, "hour")} ago`;
  }

  return `Checked ${formatUnit(totalMinutes, "minute")} ago`;
}

export function formatDateChip(iso: string | null | undefined) {
  if (!iso) {
    return "Date pending";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Date pending";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    weekday: "short"
  }).format(date);
}

export function formatStopDurationLabel(durationMinutes: number) {
  if (durationMinutes >= 1440) {
    return `${Math.round(durationMinutes / 1440)}d`;
  }

  if (durationMinutes >= 60) {
    return `${Math.round(durationMinutes / 60)}h`;
  }

  return `${durationMinutes}m`;
}

export function formatTripLengthDays(
  departureAt: string | null | undefined,
  returnDepartureAt: string | null | undefined
) {
  if (!departureAt || !returnDepartureAt) {
    return null;
  }

  const departure = new Date(departureAt);
  const returnDeparture = new Date(returnDepartureAt);

  if (Number.isNaN(departure.getTime()) || Number.isNaN(returnDeparture.getTime())) {
    return null;
  }

  const diffMs = returnDeparture.getTime() - departure.getTime();
  const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));

  return `${days} days`;
}
