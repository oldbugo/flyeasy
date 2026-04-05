export type BaselineExecutionEfficiencySummary = {
  adaptiveQueryCount?: number;
  baselineLabel?: string;
  bestFareDiscoveryPhase?: string | null;
  bestFareFirstSeenQueryNumber?: number | null;
  candidateCount?: number;
  cheapestPrice?: number | null;
  directSweepLimit?: number;
  distinctFamilyCount?: number;
  duplicationRate?: number | null;
  executedQueryCount?: number;
  familyCoverageAfterHalfBudget?: number | null;
  familyCoverageAtBestFareDiscovery?: number | null;
  initialSeedSweepLimit?: number | null;
  pairUniverseCount?: number;
  queryOutcomes?: Array<{
    candidateCount?: number;
    cheapestPrice?: number | null;
    departDate?: string | null;
    distinctFamilyCount?: number;
    observedStopoverCityCount?: number | null;
    priority: number;
    returnDate?: string | null;
    rewardScore?: number | null;
    selectionPhase?: string | null;
  }>;
  samplingMode?: string | null;
  seedSweepQueryCount?: number;
  uniqueObservedStopoverCityCount?: number;
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `AUD ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `${Math.round(value * 100)}%`;
}

function formatSamplingModeLabel(value: string | null | undefined) {
  if (value === "adaptive_coverage") {
    return "Adaptive coverage";
  }

  return "Even coverage";
}

function formatSelectionPhaseLabel(value: string | null | undefined) {
  if (value === "adaptive") {
    return "adaptive";
  }

  if (value === "seed") {
    return "seed";
  }

  return "coverage";
}

function SummaryCell(props: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {props.label}
      </p>
      <p className="mt-2 text-base font-semibold text-ink">{props.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.detail}</p>
    </div>
  );
}

export function BaselineExecutionInsights(props: {
  showQueryOutcomes?: boolean;
  summary: BaselineExecutionEfficiencySummary;
}) {
  const { summary } = props;
  const bestFareQuery = summary.bestFareFirstSeenQueryNumber;
  const bestFareDiscoveryLabel =
    typeof bestFareQuery === "number"
      ? `Query ${bestFareQuery} of ${summary.executedQueryCount ?? 0}`
      : "Not recorded";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCell
          label="Baseline mode"
          value={summary.baselineLabel ?? formatSamplingModeLabel(summary.samplingMode)}
          detail={`Executed ${summary.executedQueryCount ?? 0} of ${summary.directSweepLimit ?? 0} planned direct-sweep queries across ${summary.pairUniverseCount ?? 0} possible date pairs.`}
        />
        <SummaryCell
          label="Best fare found"
          value={bestFareQuery ? bestFareDiscoveryLabel : "Not recorded"}
          detail={`Cheapest baseline fare ${formatCurrency(summary.cheapestPrice)}. Discovery phase: ${formatSelectionPhaseLabel(summary.bestFareDiscoveryPhase)}.`}
        />
        <SummaryCell
          label="Family coverage"
          value={`${summary.distinctFamilyCount ?? 0} families`}
          detail={`Half-budget coverage ${formatPercent(summary.familyCoverageAfterHalfBudget)}. Coverage by best-fare discovery ${formatPercent(summary.familyCoverageAtBestFareDiscovery)}.`}
        />
        <SummaryCell
          label="Duplicate pressure"
          value={formatPercent(summary.duplicationRate)}
          detail={`Observed ${summary.candidateCount ?? 0} baseline candidates and ${summary.uniqueObservedStopoverCityCount ?? 0} stopover-city clues. Seed queries ${summary.seedSweepQueryCount ?? 0}, adaptive queries ${summary.adaptiveQueryCount ?? 0}.`}
        />
      </div>

      {props.showQueryOutcomes !== false && (summary.queryOutcomes ?? []).length > 0 ? (
        <div className="rounded-[20px] bg-mist px-4 py-4">
          <p className="text-sm font-semibold text-ink">Direct-sweep query sequence</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            This is the actual order in which the baseline spent its direct-sweep budget.
          </p>
          <div className="mt-4 space-y-3">
            {(summary.queryOutcomes ?? []).map((outcome) => (
              <div
                key={`${outcome.priority}-${outcome.departDate}-${outcome.returnDate}`}
                className="rounded-[16px] bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    Query {outcome.priority + 1}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    {formatSelectionPhaseLabel(outcome.selectionPhase)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {outcome.departDate ?? "Unknown"} {"->"} {outcome.returnDate ?? "Unknown"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Cheapest {formatCurrency(outcome.cheapestPrice)} | families{" "}
                  {outcome.distinctFamilyCount ?? 0} | candidates {outcome.candidateCount ?? 0} |
                  stopover clues {outcome.observedStopoverCityCount ?? 0}
                  {typeof outcome.rewardScore === "number"
                    ? ` | reward ${outcome.rewardScore.toFixed(2)}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
