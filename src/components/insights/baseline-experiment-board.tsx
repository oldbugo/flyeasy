export type BaselineExperimentSummary = {
  aggregateByBaseline: Array<{
    averageBestFareFirstSeenQueryNumber: number | null;
    averageCheapestPrice: number | null;
    averageCityEntryFindingCount: number | null;
    averageDistinctFamilyCount: number | null;
    averageDuplicationRate: number | null;
    averageFamilyCoverageAfterHalfBudget: number | null;
    averageUniqueObservedStopoverCityCount: number | null;
    baselineLabel: string;
    bestObservedCheapestPrice: number | null;
    intentionalMultiCityHitCount: number;
    latestRunAt: string | null;
    runCount: number;
  }>;
  currentReadout: {
    comparedBaselineCount: number;
    leadingBaselineLabel: string | null;
    note: string;
    rationale: string[];
  };
  latestSuite: {
    armCount: number;
    arms: Array<{
      baselineLabel: string;
      bestFareFirstSeenQueryNumber: number | null;
      cheapestIntentionalMultiCityPrice: number | null;
      cheapestPrice: number | null;
      cityEntryFindingCount: number | null;
      distinctFamilyCount: number | null;
      duplicationRate: number | null;
      familyCoverageAfterHalfBudget: number | null;
      finishedAt: string | null;
      runId: string;
      startedAt: string;
      status?: string;
      totalCandidatesFound: number;
      uniqueObservedStopoverCityCount: number | null;
    }>;
    championArmLabel: string | null;
    conclusionNote: string;
    createdAt: string;
    experimentMode: string;
    groupId: string;
    leaderArmLabel: string | null;
    sampleSize: number;
    status: string;
  } | null;
  recentRuns: Array<{
    baselineLabel: string;
    bestFareFirstSeenQueryNumber: number | null;
    cheapestIntentionalMultiCityPrice: number | null;
    cheapestPrice: number | null;
    cityEntryFindingCount: number | null;
    distinctFamilyCount: number | null;
    duplicationRate: number | null;
    familyCoverageAfterHalfBudget: number | null;
    runId: string;
    samplingMode: string | null;
    startedAt: string;
    totalCandidatesFound: number;
    uniqueObservedStopoverCityCount: number | null;
  }>;
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `AUD ${Math.round(value).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSamplingMode(value: string | null | undefined) {
  if (value === "adaptive_coverage") {
    return "Adaptive coverage";
  }

  return "Even coverage";
}

function SummaryCard(props: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">{props.label}</p>
      <p className="mt-3 text-lg font-semibold text-ink">{props.value}</p>
      <p className="mt-3 text-sm leading-7 text-slate-600">{props.detail}</p>
    </div>
  );
}

export function BaselineExperimentBoard(props: {
  compact?: boolean;
  summary: BaselineExperimentSummary;
}) {
  const { summary } = props;
  const latestSuite = summary.latestSuite;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
          Baseline strategy lab
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Compare baseline experiments on this session
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Use the same session settings and switch only the baseline strategy. This keeps the
          comparison meaningful and lets the baseline evolve through a champion-versus-challenger
          loop instead of ad hoc tweaks.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryCard
          label="Current readout"
          value={summary.currentReadout.leadingBaselineLabel ?? "No clear leader yet"}
          detail={summary.currentReadout.note}
        />
        <SummaryCard
          label="Compared baselines"
          value={String(summary.currentReadout.comparedBaselineCount)}
          detail={
            summary.currentReadout.rationale.length > 0
              ? summary.currentReadout.rationale.join(" | ")
              : "Need more alternating runs on the same session before treating one baseline as better."
          }
        />
      </div>

      {latestSuite ? (
        <div className="rounded-[24px] border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Latest baseline experiment</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Created {formatDateTime(latestSuite.createdAt)}. Mode{" "}
                <span className="font-semibold text-ink">
                  {latestSuite.experimentMode === "baseline_parallel_random"
                    ? "Queued baseline comparison"
                    : latestSuite.experimentMode}
                </span>
                . {latestSuite.conclusionNote}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                {latestSuite.status}
              </span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                {latestSuite.armCount} arm{latestSuite.armCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Champion arm"
              value={latestSuite.championArmLabel ?? "Not recorded"}
              detail="This is the baseline arm that was already selected on the strategy page before the experiment suite was launched."
            />
            <SummaryCard
              label="Current leader"
              value={latestSuite.leaderArmLabel ?? "No clear leader yet"}
              detail="The latest completed arm leader is ranked by cheapest fare first, then earlier best-fare discovery, then stronger half-budget family coverage."
            />
            <SummaryCard
              label="Experiment group"
              value={latestSuite.groupId.slice(0, 16)}
              detail={`Sample size ${latestSuite.sampleSize}. Stored so future runs can be reviewed as one bounded experiment suite.`}
            />
          </div>

          <div className="mt-4 space-y-3">
            {latestSuite.arms.map((arm) => (
              <div key={arm.runId} className="rounded-[18px] bg-mist px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{arm.baselineLabel}</p>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    {arm.status ?? "unknown"}
                  </span>
                  {latestSuite.leaderArmLabel === arm.baselineLabel ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                      leading arm
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  Started {formatDateTime(arm.startedAt)}
                  {arm.finishedAt ? ` | finished ${formatDateTime(arm.finishedAt)}` : ""}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Cheapest fare {formatCurrency(arm.cheapestPrice)} | best fare first seen by{" "}
                  {arm.bestFareFirstSeenQueryNumber ? `query ${arm.bestFareFirstSeenQueryNumber}` : "not recorded"} |
                  family coverage halfway {formatPercent(arm.familyCoverageAfterHalfBudget)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Distinct families {arm.distinctFamilyCount ?? "not recorded"} | stopover clues{" "}
                  {arm.uniqueObservedStopoverCityCount ?? "not recorded"} | city entries{" "}
                  {arm.cityEntryFindingCount ?? "not recorded"} | persisted candidates{" "}
                  {arm.totalCandidatesFound}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Intentional multi-city outcome{" "}
                  {typeof arm.cheapestIntentionalMultiCityPrice === "number"
                    ? formatCurrency(arm.cheapestIntentionalMultiCityPrice)
                    : "not recorded yet"}
                  {" | "}duplication {formatPercent(arm.duplicationRate)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {summary.aggregateByBaseline.map((entry) => (
          <div key={entry.baselineLabel} className="rounded-[24px] border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{entry.baselineLabel}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {entry.runCount} run{entry.runCount === 1 ? "" : "s"} | latest {formatDateTime(entry.latestRunAt)}
                </p>
              </div>
              {summary.currentReadout.leadingBaselineLabel === entry.baselineLabel ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                  current leader
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SummaryCard
                label="Best fare"
                value={formatCurrency(entry.bestObservedCheapestPrice)}
                detail={`Average cheapest fare ${formatCurrency(entry.averageCheapestPrice)}.`}
              />
              <SummaryCard
                label="Best fare found by"
                value={
                  entry.averageBestFareFirstSeenQueryNumber === null
                    ? "Not recorded"
                    : `Query ${Math.round(entry.averageBestFareFirstSeenQueryNumber)}`
                }
                detail={`Half-budget family coverage ${formatPercent(entry.averageFamilyCoverageAfterHalfBudget)}.`}
              />
              <SummaryCard
                label="Distinct families"
                value={
                  entry.averageDistinctFamilyCount === null
                    ? "Not recorded"
                    : entry.averageDistinctFamilyCount.toFixed(1)
                }
                detail={`Average stopover clues ${entry.averageUniqueObservedStopoverCityCount?.toFixed(1) ?? "Not recorded"} | city entries ${entry.averageCityEntryFindingCount?.toFixed(1) ?? "Not recorded"}.`}
              />
              <SummaryCard
                label="Duplicate pressure"
                value={formatPercent(entry.averageDuplicationRate)}
                detail={`Intentional multi-city hits on ${entry.intentionalMultiCityHitCount} run${entry.intentionalMultiCityHitCount === 1 ? "" : "s"}.`}
              />
            </div>
          </div>
        ))}
      </div>

      {!props.compact && summary.recentRuns.length > 0 ? (
        <div className="rounded-[24px] border border-line bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-ink">Recent baseline runs</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            This is the recent run trail for the current session. Use it to compare how each
            baseline spent the same search budget over time.
          </p>

          <div className="mt-4 space-y-3">
            {summary.recentRuns.slice(0, 8).map((run) => (
              <div key={run.runId} className="rounded-[18px] bg-mist px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{run.baselineLabel}</p>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                    {formatSamplingMode(run.samplingMode)}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {formatDateTime(run.startedAt)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Cheapest fare {formatCurrency(run.cheapestPrice)} | best fare first seen by{" "}
                  {run.bestFareFirstSeenQueryNumber ? `query ${run.bestFareFirstSeenQueryNumber}` : "not recorded"} |
                  family coverage halfway {formatPercent(run.familyCoverageAfterHalfBudget)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Distinct families {run.distinctFamilyCount ?? "not recorded"} | stopover clues{" "}
                  {run.uniqueObservedStopoverCityCount ?? "not recorded"} | city entries{" "}
                  {run.cityEntryFindingCount ?? "not recorded"} | persisted candidates{" "}
                  {run.totalCandidatesFound}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Intentional multi-city outcome{" "}
                  {typeof run.cheapestIntentionalMultiCityPrice === "number"
                    ? formatCurrency(run.cheapestIntentionalMultiCityPrice)
                    : "not recorded yet"}
                  {" | "}duplication {formatPercent(run.duplicationRate)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
