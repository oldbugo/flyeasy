export function formatMoney(currency: string | null, amount: number | null) {
  if (!currency || amount === null) {
    return "No fare yet";
  }

  return `${currency} ${amount.toLocaleString("en-AU", {
    maximumFractionDigits: 0
  })}`;
}

export function formatIsoDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatIsoDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatIsoTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDurationMinutes(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "Not recorded";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function formatStopSummary(stopCount: number, intentionalStopCount?: number | null) {
  const stopText = `${stopCount} stop${stopCount === 1 ? "" : "s"}`;

  if (intentionalStopCount === undefined || intentionalStopCount === null) {
    return stopText;
  }

  return `${stopText} | ${intentionalStopCount} intentional`;
}

export function resolveDisplayedStopCount({
  extractedStopoverCount,
  intentionalStopCount,
  storedStopCount
}: {
  extractedStopoverCount: number;
  intentionalStopCount?: number | null;
  storedStopCount: number;
}) {
  const fallbackCount = Math.max(extractedStopoverCount, intentionalStopCount ?? 0, 1);

  if (storedStopCount === 0) {
    return extractedStopoverCount > 0 ? fallbackCount : 0;
  }

  if (storedStopCount > 3 && extractedStopoverCount > 0) {
    return fallbackCount;
  }

  return storedStopCount;
}

export function getMinimumIntentionalStopDurationMinutes(stopDurationMinDays: number | null | undefined) {
  return Math.max(1, Number(stopDurationMinDays ?? 1)) * 24 * 60;
}

export function isDisplayedIntentionalStopover(
  stopover: { durationMinutes: number; isIntentional: boolean },
  stopDurationMinDays: number | null | undefined
) {
  return (
    stopover.isIntentional &&
    stopover.durationMinutes >= getMinimumIntentionalStopDurationMinutes(stopDurationMinDays)
  );
}

export function resolveDisplayedIntentionalStopCount({
  stopDurationMinDays,
  stopovers,
  storedIntentionalStopCount
}: {
  stopDurationMinDays: number | null | undefined;
  stopovers: Array<{ durationMinutes: number; isIntentional: boolean }>;
  storedIntentionalStopCount?: number | null;
}) {
  if (stopovers.length === 0) {
    return storedIntentionalStopCount ?? 0;
  }

  return stopovers.filter((stopover) =>
    isDisplayedIntentionalStopover(stopover, stopDurationMinDays)
  ).length;
}
