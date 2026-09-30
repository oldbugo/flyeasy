// Summarises a run's query executions for the live Results view. Kept free of
// app imports so it can be unit-tested directly with Node.

export type QueryProgressInput = {
  failureReason: string | null;
  queryInputJson: string;
  status: string;
};

export type QueryProgressSummary = {
  completedCount: number;
  currentDates: string | null;
  failedCount: number;
  latestFailure: string | null;
  totalCount: number;
};

function formatQueryDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return null;
  }

  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`)
  );
}

export function describeQueryDates(queryInputJson: string) {
  try {
    const input = JSON.parse(queryInputJson) as Record<string, unknown>;
    const depart = formatQueryDate(input.departDate);
    const back = formatQueryDate(input.returnDate);

    if (depart && back) {
      return `${depart} → ${back}`;
    }

    return depart;
  } catch {
    return null;
  }
}

export function summarizeQueryProgress(queries: QueryProgressInput[]): QueryProgressSummary {
  const running = queries.filter((query) => query.status === "running");
  const failed = queries.filter((query) => query.status === "failed");
  const latestRunning = running[running.length - 1];

  return {
    completedCount: queries.filter((query) => query.status !== "running" && query.status !== "queued")
      .length,
    currentDates: latestRunning ? describeQueryDates(latestRunning.queryInputJson) : null,
    failedCount: failed.length,
    latestFailure: failed[failed.length - 1]?.failureReason ?? null,
    totalCount: queries.length
  };
}
