const DEFAULT_REFRESH_INTERVAL_HOURS = 12;
const MIN_REFRESH_INTERVAL_HOURS = 1;
const MAX_REFRESH_INTERVAL_HOURS = 168;

export function normalizeRefreshIntervalHours(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_REFRESH_INTERVAL_HOURS;
  }

  return Math.min(
    MAX_REFRESH_INTERVAL_HOURS,
    Math.max(MIN_REFRESH_INTERVAL_HOURS, Math.trunc(Number(value)))
  );
}

export function computeNextRefreshAt(
  baseIso: string,
  refreshIntervalHours: number | null | undefined
) {
  const normalizedHours = normalizeRefreshIntervalHours(refreshIntervalHours);
  const nextDate = new Date(baseIso);

  nextDate.setHours(nextDate.getHours() + normalizedHours);

  return nextDate.toISOString();
}

export function computeNextRefreshFromLastRun(values: {
  fallbackIso: string;
  lastRunFinishedAt?: string | null;
  lastRunStartedAt?: string | null;
  refreshIntervalHours: number | null | undefined;
}) {
  const baseIso =
    values.lastRunFinishedAt ?? values.lastRunStartedAt ?? values.fallbackIso;

  return computeNextRefreshAt(baseIso, values.refreshIntervalHours);
}

export function getDefaultRefreshIntervalHours() {
  return DEFAULT_REFRESH_INTERVAL_HOURS;
}

export function getRefreshIntervalBounds() {
  return {
    max: MAX_REFRESH_INTERVAL_HOURS,
    min: MIN_REFRESH_INTERVAL_HOURS
  };
}
