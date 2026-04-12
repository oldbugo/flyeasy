import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import {
  rerunSessionAction,
  startBaselineRunAction
} from "@/app/sessions/actions";
import { AiInfluencePanel } from "@/components/ai/ai-influence-panel";
import { RecommendationCandidateCard } from "@/components/candidates/recommendation-candidate-card";
import { BaselineExperimentBoard } from "@/components/insights/baseline-experiment-board";
import { Panel, getButtonClassName } from "@/components/shared/ui";
import { OverviewRecommendationPanel } from "@/components/sessions/overview-recommendation-panel";
import { SessionRunTrendChart } from "@/components/sessions/session-run-trend-chart";
import {
  buildCandidateRecommendationGroups,
  filterRecommendationGroupsByTripType,
  isMultiCityCandidate,
  selectSignificantRecommendationGroups,
  type RecommendationFilter
} from "@/lib/candidates/result-groups";
import { listLatestAiInfluenceForSession } from "@/lib/db/queries/ai";
import { listCandidatesForSession } from "@/lib/db/queries/candidates";
import { getSessionHistorySnapshot } from "@/lib/db/queries/history";
import { getSessionById } from "@/lib/db/queries/sessions";
import { formatIsoDateTime, formatMoney } from "@/lib/formatting";

type SessionOverviewPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    recommendationFilter?: string | string[];
  }>;
};

export default async function SessionOverviewPage({
  params,
  searchParams
}: SessionOverviewPageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [record, candidates, aiInfluence, historySnapshot] = await Promise.all([
    getSessionById(sessionId),
    listCandidatesForSession(sessionId),
    listLatestAiInfluenceForSession(sessionId),
    getSessionHistorySnapshot(sessionId)
  ]);

  if (!record) {
    notFound();
  }

  const { baselineExperiment, session } = record;
  const groupedResults = buildCandidateRecommendationGroups(candidates);
  const latestRun = historySnapshot.runs[0] ?? null;
  const resolvedRecommendationFilter = Array.isArray(resolvedSearchParams?.recommendationFilter)
    ? resolvedSearchParams?.recommendationFilter[0]
    : resolvedSearchParams?.recommendationFilter;
  const recommendationFilter: RecommendationFilter =
    resolvedRecommendationFilter === "only_multi_city" ||
    resolvedRecommendationFilter === "exclude_multi_city"
      ? resolvedRecommendationFilter
      : "all";
  const significantRecommendationGroups = selectSignificantRecommendationGroups(
    groupedResults.recommendationGroups
  );
  const filteredRecommendationGroups = filterRecommendationGroupsByTripType(
    significantRecommendationGroups,
    recommendationFilter
  );
  const recommendationCounts = {
    all: significantRecommendationGroups.length,
    exclude_multi_city: significantRecommendationGroups.filter(
      (group) => !isMultiCityCandidate(group.representative)
    ).length,
    only_multi_city: significantRecommendationGroups.filter((group) =>
      isMultiCityCandidate(group.representative)
    ).length
  } satisfies Record<RecommendationFilter, number>;
  const currentRunPriceRange = buildCurrentRunPriceRange(candidates);

  const overviewFacts = [
    {
      label: "Latest scan",
      value: formatIsoDateTime(latestRun?.startedAt ?? null),
      valueClassName: "text-sm font-semibold leading-5 tracking-[-0.01em] md:text-[15px]"
    },
    {
      label: "Candidates found",
      value: latestRun?.totalCandidatesFound ?? 0,
      valueClassName: "text-lg font-semibold leading-none tracking-[-0.02em] md:text-xl"
    },
    {
      label: "Price range",
      value: (
        <OverviewPriceRangeBlock
          candidateCount={currentRunPriceRange.count}
          currency={currentRunPriceRange.currency}
          highestPrice={currentRunPriceRange.highestPrice}
          lowestPrice={currentRunPriceRange.lowestPrice}
          medianPrice={currentRunPriceRange.medianPrice}
          prices={currentRunPriceRange.prices}
        />
      ),
      valueClassName: "",
      wrapperClassName: "lg:col-span-2"
    },
    {
      label: "Charted runs",
      value: historySnapshot.runTrend.length,
      valueClassName: "text-lg font-semibold leading-none tracking-[-0.02em] md:text-xl"
    }
  ];

  return (
    <div className="space-y-8">
      <Panel className="p-6 md:p-8">
        <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
          <div className="min-w-0 space-y-6 xl:pr-6">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sea">
                  Overview
                </p>
                <h2 className="text-[1.7rem] font-semibold tracking-tight text-ink md:text-[1.9rem]">
                  Recent performance
                </h2>
              </div>

              <p className="max-w-[22rem] text-sm leading-6 text-slate-600">
                {latestRun
                  ? latestRun.summaryText ?? "Latest run completed without a summary."
                  : "Start the first baseline run to populate this overview with live results and a fare trend."}
              </p>
            </div>

            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {overviewFacts.map((fact) => (
                <div
                  key={fact.label}
                  className={`min-w-0 w-full rounded-[20px] bg-white/58 px-4 py-3.5 ring-1 ring-inset ring-line/60 ${fact.wrapperClassName ?? ""}`}
                >
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {fact.label}
                    </p>
                    <div
                      className={`min-w-0 break-words text-left text-ink ${fact.valueClassName}`}
                    >
                      {fact.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {latestRun ? (
                <form action={rerunSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className={getButtonClassName({ size: "sm", tone: "secondary" })}
                  >
                    Rerun now
                  </button>
                </form>
              ) : (
                <form action={startBaselineRunAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className={getButtonClassName({ size: "sm", tone: "primary" })}
                  >
                    Start baseline run
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="min-w-0 border-t border-line/70 pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
            <SessionRunTrendChart points={historySnapshot.runTrend} />
          </div>
        </div>
      </Panel>

      <OverviewRecommendationPanel
        activeFilter={recommendationFilter}
        counts={recommendationCounts}
      >
        {filteredRecommendationGroups.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {filteredRecommendationGroups.map((group) => {
              return (
                <RecommendationCandidateCard
                  key={group.groupKey}
                  group={group}
                  stopDurationMinDays={session.stopDurationMinDays}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-line bg-white/70 px-6 py-7 text-sm leading-7 text-slate-600">
            {recommendationFilter === "only_multi_city"
              ? "No significant multi-city trips are recorded yet. Enable a multi-city strategy and rerun the session to populate this view."
              : recommendationFilter === "exclude_multi_city"
                ? "No significant non-multi-city trips are recorded yet. Run or rerun the session to populate this view."
                : "No significant trip recommendations are recorded yet. Run or rerun the session to populate this view."}
          </div>
        )}
      </OverviewRecommendationPanel>

      {baselineExperiment.recentRuns.length > 0 || baselineExperiment.latestSuite ? (
        <OverviewDisclosureSection
          description="Arm-by-arm baseline results and champion-versus-challenger readouts."
          summary={`${baselineExperiment.currentReadout.comparedBaselineCount} baseline${
            baselineExperiment.currentReadout.comparedBaselineCount === 1 ? "" : "s"
          } tracked`}
          title="Baseline comparison"
        >
          <BaselineExperimentBoard compact hideHeader summary={baselineExperiment} />
        </OverviewDisclosureSection>
      ) : null}

      {aiInfluence.length > 0 ? (
        <OverviewDisclosureSection
          description="Accepted AI changes that shaped the latest run configuration."
          summary={`${aiInfluence.length} accepted change${aiInfluence.length === 1 ? "" : "s"}`}
          title="AI changes used in this run"
        >
          <AiInfluencePanel hideHeader items={aiInfluence} />
        </OverviewDisclosureSection>
      ) : null}
    </div>
  );
}

function buildCurrentRunPriceRange(
  candidates: Array<{ displayedDisplayAmount: number; displayedDisplayCurrency: string }>
) {
  const prices = candidates
    .map((candidate) => candidate.displayedDisplayAmount)
    .filter((price) => Number.isFinite(price))
    .sort((left, right) => left - right);
  const count = prices.length;
  const currency = candidates[0]?.displayedDisplayCurrency ?? null;

  if (count === 0) {
    return {
      count: 0,
      currency,
      highestPrice: null,
      lowestPrice: null,
      medianPrice: null,
      prices
    };
  }

  const medianIndex = Math.floor((count - 1) / 2);

  return {
    count,
    currency,
    highestPrice: prices[count - 1] ?? null,
    lowestPrice: prices[0] ?? null,
    medianPrice: prices[medianIndex] ?? null,
    prices
  };
}

function OverviewPriceRangeBlock({
  candidateCount,
  currency,
  highestPrice,
  lowestPrice,
  medianPrice,
  prices
}: {
  candidateCount: number;
  currency: string | null;
  highestPrice: number | null;
  lowestPrice: number | null;
  medianPrice: number | null;
  prices: number[];
}) {
  if (!currency || candidateCount === 0 || lowestPrice === null || highestPrice === null) {
    return (
      <div className="pt-1 text-[13px] leading-5 text-slate-500">
        No price observations in the current run yet.
      </div>
    );
  }

  const spread = Math.max(highestPrice - lowestPrice, 1);
  const medianPosition =
    medianPrice === null ? 50 : ((medianPrice - lowestPrice) / spread) * 100;

  return (
    <div className="space-y-3 pt-1">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Lowest
          </p>
          <p className="break-words text-sm font-semibold tracking-[-0.02em] text-ink md:text-base">
            {formatMoney(currency, lowestPrice)}
          </p>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Median
          </p>
          <p className="break-words text-sm font-semibold tracking-[-0.02em] text-ink md:text-base">
            {formatMoney(currency, medianPrice)}
          </p>
        </div>
        <div className="min-w-0 space-y-1 sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Highest
          </p>
          <p className="break-words text-sm font-semibold tracking-[-0.02em] text-ink md:text-base">
            {formatMoney(currency, highestPrice)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="overflow-hidden rounded-[16px] bg-[#EEF4F7] px-3 py-3">
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line/90" />
            {prices.map((price, index) => {
              const left = spread === 0 ? 50 : ((price - lowestPrice) / spread) * 100;

              return (
                <span
                  key={`${price}-${index}`}
                  className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sea/40"
                  style={{ left: `${left}%` }}
                />
              );
            })}
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sea bg-white shadow-[0_2px_6px_rgba(12,107,88,0.16)]"
              style={{ left: `${spread === 0 ? 50 : medianPosition}%` }}
            />
          </div>
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          {candidateCount} fares in this run
        </div>
      </div>
    </div>
  );
}

function OverviewDisclosureSection({
  children,
  description,
  summary,
  title
}: {
  children: ReactNode;
  description: string;
  summary: string;
  title: string;
}) {
  return (
    <details className="group space-y-4">
      <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <Panel className="p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {summary}
              </span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-base leading-none text-slate-500 transition-transform group-open:rotate-180">
                v
              </span>
            </div>
          </div>
        </Panel>
      </summary>

      <div>{children}</div>
    </details>
  );
}
