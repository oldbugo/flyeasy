"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  BaselineExecutionInsights,
  type BaselineExecutionEfficiencySummary
} from "@/components/insights/baseline-efficiency-insights";
import {
  BaselineHandoffDetails,
  type BaselineFollowupHandoffSummary,
  type BaselineReturnOptionExpansionSummary
} from "@/components/insights/baseline-followup-handoff";
import {
  BaselineMarketInsights,
  type BaselineMarketSummary
} from "@/components/insights/baseline-market-insights";

type RunProgressPayload = {
  analysisSnapshots: Array<{
    analysisType: string;
    createdAt: string;
    id: string;
    strategyExecutionId: string;
    summaryJson: string;
  }>;
  candidates: Array<{
    displayedDisplayAmount: number;
    displayedDisplayCurrency: string;
    legs: Array<{
      arrivalAt: string;
      departureAt: string;
      destinationAirport: string;
      originAirport: string;
      segmentGroup: string;
    }>;
    id: string;
    intentionalStopCount: number;
    outboundDestinationCity: string;
    riskNotes: string | null;
    stopCount: number;
    stopovers: Array<{
      arrivalAt: string;
      cityCode: string;
      departureAt: string;
      durationMinutes: number;
      isIntentional: boolean;
    }>;
    totalTravelMinutes: number | null;
  }>;
  events: Array<{
    at: string;
    id: string;
    level: string;
    message: string;
  }>;
  run: {
    finishedAt: string | null;
    id: string;
    recoveryState: string;
    startedAt: string;
    status: string;
    summaryText: string | null;
    totalCandidatesFound: number;
    totalStrategiesExecuted: number;
    totalStrategiesPlanned: number;
  };
  queries: Array<{
    failureReason: string | null;
    finishedAt: string | null;
    id: string;
    observedStopoverCitiesJson: string | null;
    priority: number;
    queryInputJson: string;
    querySource: string;
    queryType: string;
    reason: string;
    resultSummaryJson: string | null;
    startedAt: string;
    status: string;
  }>;
  strategies: Array<{
    id: string;
    reason: string;
    sourceType: string;
    status: string;
    strategyType: string;
  }>;
};

type RunProgressPanelProps = {
  initialData: RunProgressPayload;
  runId: string;
};

function fingerprintRunProgress(payload: RunProgressPayload) {
  return [
    payload.run.id,
    payload.run.status,
    payload.run.totalCandidatesFound,
    payload.run.totalStrategiesExecuted,
    payload.events.length,
    payload.queries.length,
    payload.analysisSnapshots.length,
    payload.candidates.length
  ].join("|");
}

export function RunProgressPanel({ initialData, runId }: RunProgressPanelProps) {
  const [data, setData] = useState(initialData);
  const [_, startTransition] = useTransition();
  const inflightRef = useRef(false);
  const lastFingerprintRef = useRef(fingerprintRunProgress(initialData));
  const baselineExecutionSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "baseline_execution_efficiency"
  );
  const baselineExpansionSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "baseline_return_option_expansion"
  );
  const baselineHandoffSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "baseline_followup_handoff"
  );
  const pass1Snapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "pass1_market_scan"
  );
  const multiCityRankSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "multi_city_verification_rank"
  );
  const multiCityVerificationResultsSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "multi_city_verification_results"
  );
  const anchoredMultiCityResultsSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "anchored_multi_city_results"
  );
  const longStopSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "multi_city_long_stop_validation"
  );
  const longStopFollowupSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "multi_city_long_stop_followup"
  );
  const alternateReturnSnapshot = data.analysisSnapshots.find(
    (snapshot) => snapshot.analysisType === "alternate_return_city_summary"
  );
  const baselineExpansionAnalysis = useMemo(
    () =>
      baselineExpansionSnapshot
        ? (JSON.parse(baselineExpansionSnapshot.summaryJson) as BaselineReturnOptionExpansionSummary)
        : null,
    [baselineExpansionSnapshot?.summaryJson]
  );
  const baselineExecutionAnalysis = useMemo(
    () =>
      baselineExecutionSnapshot
        ? (JSON.parse(baselineExecutionSnapshot.summaryJson) as BaselineExecutionEfficiencySummary)
        : null,
    [baselineExecutionSnapshot?.summaryJson]
  );
  const baselineHandoffAnalysis = useMemo(
    () =>
      baselineHandoffSnapshot
        ? (JSON.parse(baselineHandoffSnapshot.summaryJson) as BaselineFollowupHandoffSummary)
        : null,
    [baselineHandoffSnapshot?.summaryJson]
  );
  const latestAnalysis = useMemo(
    () =>
      pass1Snapshot ? (JSON.parse(pass1Snapshot.summaryJson) as BaselineMarketSummary) : null,
    [pass1Snapshot?.summaryJson]
  );
  const multiCityRankAnalysis = useMemo(
    () =>
      multiCityRankSnapshot
        ? (JSON.parse(multiCityRankSnapshot.summaryJson) as {
        baselineCheapestPrice?: number | null;
        rankedCities?: Array<{
          baselinePriceDelta?: number | null;
          cityCode: string;
          cityName: string;
          familyCount?: number;
          reviewedCandidateCount?: number;
          score?: number;
        }>;
        reviewedCandidateCount?: number;
      })
        : null,
    [multiCityRankSnapshot?.summaryJson]
  );
  const multiCityVerificationResultsAnalysis = useMemo(
    () =>
      multiCityVerificationResultsSnapshot
        ? (JSON.parse(multiCityVerificationResultsSnapshot.summaryJson) as {
        candidateCount?: number;
        cheapestVerifiedMultiCityCandidate?: {
          baselinePriceDelta?: number | null;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
        } | null;
        cheapestMultiCityCandidate?: {
          baselinePriceDelta?: number | null;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
        } | null;
        cityResults?: Array<{
          bestCandidate?: {
            baselinePriceDelta?: number | null;
          } | null;
          candidateCount?: number;
          cheapestCandidatePrice?: number | null;
          cheapestVerifiedCandidatePrice?: number | null;
          cityCode: string;
          cityName: string;
          intentionalCandidateCount?: number;
          seedContextCount?: number;
        }>;
        intentionalCandidateCount?: number;
        queriedCityCount?: number;
        queriedSeedCount?: number;
        sessionStopDurationMaxDays?: number | null;
        sessionStopDurationMinDays?: number | null;
      })
        : null,
    [multiCityVerificationResultsSnapshot?.summaryJson]
  );
  const anchoredMultiCityResultsAnalysis = useMemo(
    () =>
      anchoredMultiCityResultsSnapshot
        ? (JSON.parse(anchoredMultiCityResultsSnapshot.summaryJson) as {
        candidateCount?: number;
        cheapestVerifiedMultiCityCandidate?: {
          baselinePriceDelta?: number | null;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
        } | null;
        cheapestMultiCityCandidate?: {
          baselinePriceDelta?: number | null;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
        } | null;
        cityResults?: Array<{
          bestCandidate?: {
            baselinePriceDelta?: number | null;
          } | null;
          candidateCount?: number;
          cheapestCandidatePrice?: number | null;
          cheapestVerifiedCandidatePrice?: number | null;
          cityCode: string;
          cityName: string;
          intentionalCandidateCount?: number;
          seedContextCount?: number;
        }>;
        queriedCityCount?: number;
        queriedSeedCount?: number;
        sessionStopDurationMaxDays?: number | null;
        sessionStopDurationMinDays?: number | null;
        testedDateVariationCount?: number;
      })
        : null,
    [anchoredMultiCityResultsSnapshot?.summaryJson]
  );
  const longStopAnalysis = useMemo(
    () =>
      longStopSnapshot
        ? (JSON.parse(longStopSnapshot.summaryJson) as {
        cityValidations?: Array<{
          cityCode: string;
          cityName: string;
          longestObservedStopHours?: number;
          recommendation?: string;
          verifiedCandidateCount?: number;
        }>;
        minimumLongStopHours?: number;
      })
        : null,
    [longStopSnapshot?.summaryJson]
  );
  const longStopFollowupAnalysis = useMemo(
    () =>
      longStopFollowupSnapshot
        ? (JSON.parse(longStopFollowupSnapshot.summaryJson) as {
        candidateCount?: number;
        cheapestCandidatePrice?: number | null;
        cityResults?: Array<{
          candidateCount?: number;
          cheapestCandidatePrice?: number | null;
          cityCode: string;
          cityName: string;
          longestObservedStopHours?: number | null;
          recommendation?: string;
        }>;
        minimumLongStopHours?: number;
        queriedCityCount?: number;
      })
        : null,
    [longStopFollowupSnapshot?.summaryJson]
  );
  const alternateReturnAnalysis = useMemo(
    () =>
      alternateReturnSnapshot
        ? (JSON.parse(alternateReturnSnapshot.summaryJson) as {
        cityTargetCount?: number;
        comparedCities?: Array<{
          candidateCount?: number;
          cheapestCandidatePrice?: number | null;
          cityCode: string;
          cityName: string;
          queryCount?: number;
          reasons?: string[];
          targetScore?: number;
        }>;
        datePairLimit?: number;
      })
        : null,
    [alternateReturnSnapshot?.summaryJson]
  );

  const formatQueryTypeLabel = (queryType: string) => {
    if (queryType === "direct_round_trip") {
      return "Direct sweep";
    }

    if (queryType === "return_option_expansion") {
      return "Return option expansion";
    }

    if (queryType === "anchored_multi_city") {
      return "Anchored multi-city search";
    }

    if (queryType === "long_stop_stopover_round_trip") {
      return "Long-stop follow-up";
    }

    if (queryType === "stopover_filtered_round_trip") {
      return "Multi-city verification";
    }

    return "Stopover follow-up";
  };

  const formatStopWindowLabel = (minDays: number | null | undefined, maxDays: number | null | undefined) => {
    if (typeof minDays !== "number" || !Number.isFinite(minDays)) {
      return "the session stop window";
    }

    if (typeof maxDays !== "number" || !Number.isFinite(maxDays) || maxDays <= minDays) {
      return `${minDays} day${minDays === 1 ? "" : "s"} or longer`;
    }

    return `${minDays}-${maxDays} days`;
  };

  useEffect(() => {
    if (
      data.run.status === "completed" ||
      data.run.status === "cancelled" ||
      data.run.status === "failed"
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      if (document.hidden || inflightRef.current) {
        return;
      }

      inflightRef.current = true;
      try {
        const response = await fetch(`/api/runs/${runId}/progress`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RunProgressPayload;
        const nextFingerprint = fingerprintRunProgress(payload);
        if (nextFingerprint === lastFingerprintRef.current) {
          return;
        }

        lastFingerprintRef.current = nextFingerprint;
        startTransition(() => {
          setData(payload);
        });
      } finally {
        inflightRef.current = false;
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [data.run.status, runId]);

  return (
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="space-y-6">
        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Run metrics
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] bg-mist px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold text-ink">{data.run.status}</p>
            </div>
            <div className="rounded-[24px] bg-mist px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Candidates found
              </p>
              <p className="mt-2 text-lg font-semibold text-ink">{data.run.totalCandidatesFound}</p>
            </div>
            <div className="rounded-[24px] bg-mist px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Strategies executed
              </p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {data.run.totalStrategiesExecuted} / {data.run.totalStrategiesPlanned}
              </p>
            </div>
            <div className="rounded-[24px] bg-mist px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recovery state
              </p>
              <p className="mt-2 text-lg font-semibold text-ink">{data.run.recoveryState}</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-slate-600">
            {data.run.summaryText ?? "No run summary has been recorded yet."}
          </p>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Recent events
          </p>
          <div className="mt-4 space-y-3">
            {data.events.map((event) => (
              <div key={event.id} className="rounded-[20px] bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{event.at}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{event.message}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <aside className="space-y-6">
        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Strategy queue
          </p>
          <div className="mt-4 space-y-3">
            {data.strategies.map((strategy) => (
              <div key={strategy.id} className="rounded-[20px] bg-mist px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{strategy.strategyType}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      strategy.sourceType === "ai"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {strategy.sourceType === "ai" ? "accepted suggestion" : strategy.sourceType}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{strategy.status}</p>
                <p className="mt-2 text-sm text-slate-600">{strategy.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Query log
          </p>
          <div className="mt-4 space-y-3">
            {data.queries.length > 0 ? (
              data.queries.map((query) => {
                const input = JSON.parse(query.queryInputJson) as {
                  departDate?: string;
                  returnDate?: string;
                  stopoverCityCode?: string;
                };
                const summary = query.resultSummaryJson
                  ? (JSON.parse(query.resultSummaryJson) as {
                      candidateCount?: number;
                      cheapestPrice?: number;
                      scannedOutboundCardCount?: number;
                      scannedReturnCardCount?: number;
                      selectedOutboundPrice?: number | null;
                      stopoverCityCount?: number;
                    })
                  : null;
                const observedStopovers = query.observedStopoverCitiesJson
                  ? (JSON.parse(query.observedStopoverCitiesJson) as Array<{ cityCode?: string }>)
                  : [];

                return (
                  <div key={query.id} className="rounded-[20px] bg-mist px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {formatQueryTypeLabel(query.queryType)}
                      </p>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                        {query.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      Query {query.priority + 1} | {query.querySource}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{query.reason}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {input.departDate && input.returnDate
                        ? `${input.departDate} to ${input.returnDate}`
                        : input.stopoverCityCode
                          ? `Stopover city ${input.stopoverCityCode}`
                          : "See recorded query input for details."}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {summary?.cheapestPrice
                        ? `Cheapest price: AUD ${Number(summary.cheapestPrice).toLocaleString("en-AU", {
                            maximumFractionDigits: 0
                          })} across ${summary.candidateCount ?? 0} candidates`
                        : query.failureReason
                          ? `Failure: ${query.failureReason}`
                          : "Result summary not recorded yet."}
                    </p>
                    {summary?.scannedOutboundCardCount ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Scanned {summary.scannedOutboundCardCount} outbound cards and{" "}
                        {summary.scannedReturnCardCount ?? 0} return cards. Selected outbound price:{" "}
                        {summary.selectedOutboundPrice
                          ? `AUD ${Number(summary.selectedOutboundPrice).toLocaleString("en-AU", {
                              maximumFractionDigits: 0
                            })}`
                          : "not recorded"}.
                      </p>
                    ) : null}
                    {observedStopovers.length > 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Observed stopover evidence: {observedStopovers.slice(0, 6).map((entry) => entry.cityCode).join(", ")}
                        {observedStopovers.length > 6 ? ` +${observedStopovers.length - 6} more` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm leading-7 text-slate-600">
                Individual query executions will appear here once the run starts.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Pass 1 analysis
          </p>
          {latestAnalysis ? (
            <div className="mt-4">
              <p className="text-sm leading-7 text-slate-600">
                The baseline board shows which dates, airlines, and specific pairings are
                producing the best round-trip value so you can see what the later strategies are
                building on.
              </p>
              <div className="mt-4">
                <div className="space-y-4">
                  {baselineExecutionAnalysis ? (
                    <BaselineExecutionInsights summary={baselineExecutionAnalysis} />
                  ) : null}
                  <BaselineMarketInsights summary={latestAnalysis} />
                  <BaselineHandoffDetails
                    expansionSummary={baselineExpansionAnalysis}
                    handoffSummary={baselineHandoffAnalysis}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The first-pass analysis snapshot will appear here once the direct sweep completes.
            </p>
          )}
        </div>

        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Multi-city evidence
          </p>
          {anchoredMultiCityResultsAnalysis ||
          multiCityRankAnalysis ||
          multiCityVerificationResultsAnalysis ||
          longStopAnalysis ||
          longStopFollowupAnalysis ||
          alternateReturnAnalysis ? (
            <div className="mt-4 space-y-4">
              {anchoredMultiCityResultsAnalysis?.cheapestMultiCityCandidate ||
              anchoredMultiCityResultsAnalysis?.cheapestVerifiedMultiCityCandidate ||
              anchoredMultiCityResultsAnalysis?.cityResults?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Anchored true multi-city results</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Queried {anchoredMultiCityResultsAnalysis.queriedSeedCount ?? 0} seed context
                    {anchoredMultiCityResultsAnalysis.queriedSeedCount === 1 ? "" : "s"} across{" "}
                    {anchoredMultiCityResultsAnalysis.queriedCityCount ?? 0} cit
                    {anchoredMultiCityResultsAnalysis.queriedCityCount === 1 ? "y" : "ies"} and{" "}
                    {anchoredMultiCityResultsAnalysis.testedDateVariationCount ?? 0} date variation
                    {anchoredMultiCityResultsAnalysis.testedDateVariationCount === 1 ? "" : "s"}.
                    {" "}
                    Window{" "}
                    {formatStopWindowLabel(
                      anchoredMultiCityResultsAnalysis.sessionStopDurationMinDays,
                      anchoredMultiCityResultsAnalysis.sessionStopDurationMaxDays
                    )}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate ? (
                      <p>
                        Cheapest true multi-city trip:{" "}
                        {anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate.cityName} (
                        {anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate.cityCode}) | fare{" "}
                        {typeof anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate
                          .displayedAmount === "number"
                          ? `AUD ${anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate.displayedAmount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : "Not recorded"}
                        {typeof anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate
                          .baselinePriceDelta === "number"
                          ? ` | delta AUD ${anchoredMultiCityResultsAnalysis.cheapestMultiCityCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ) : anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate ? (
                      <p>
                        No qualifying true multi-city trip yet | cheapest verified anchored trip:{" "}
                        {anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate.cityName} (
                        {anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate.cityCode}) | fare{" "}
                        {typeof anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate
                          .displayedAmount === "number"
                          ? `AUD ${anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate.displayedAmount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : "Not recorded"}
                        {typeof anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate
                          .baselinePriceDelta === "number"
                          ? ` | delta AUD ${anchoredMultiCityResultsAnalysis.cheapestVerifiedMultiCityCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ) : null}
                    {(anchoredMultiCityResultsAnalysis.cityResults ?? []).slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) |{" "}
                        {typeof entry.cheapestCandidatePrice === "number"
                          ? `cheapest true multi-city fare AUD ${entry.cheapestCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : `no qualifying trip yet, cheapest verified ${
                              typeof entry.cheapestVerifiedCandidatePrice === "number"
                                ? `AUD ${entry.cheapestVerifiedCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                                : "not recorded"
                            }`}{" "}
                        | intentional {entry.intentionalCandidateCount ?? 0} | verified {entry.candidateCount ?? 0} | tested contexts{" "}
                        {entry.seedContextCount ?? 0}
                        {typeof entry.bestCandidate?.baselinePriceDelta === "number"
                          ? ` | delta AUD ${entry.bestCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {multiCityVerificationResultsAnalysis?.cheapestMultiCityCandidate ||
              multiCityVerificationResultsAnalysis?.cheapestVerifiedMultiCityCandidate ||
              multiCityVerificationResultsAnalysis?.cityResults?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Intentional multi-city results</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Queried {multiCityVerificationResultsAnalysis.queriedSeedCount ?? 0} seed context
                    {multiCityVerificationResultsAnalysis.queriedSeedCount === 1 ? "" : "s"} across{" "}
                    {multiCityVerificationResultsAnalysis.queriedCityCount ?? 0} cit
                    {multiCityVerificationResultsAnalysis.queriedCityCount === 1 ? "y" : "ies"}.
                    {" "}
                    Window{" "}
                    {formatStopWindowLabel(
                      multiCityVerificationResultsAnalysis.sessionStopDurationMinDays,
                      multiCityVerificationResultsAnalysis.sessionStopDurationMaxDays
                    )}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate ? (
                      <p>
                        Cheapest intentional trip:{" "}
                        {multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate.cityName} (
                        {multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate.cityCode}) | fare{" "}
                        {typeof multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate
                          .displayedAmount === "number"
                          ? `AUD ${multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate.displayedAmount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : "Not recorded"}
                        {typeof multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate
                          .baselinePriceDelta === "number"
                          ? ` | delta AUD ${multiCityVerificationResultsAnalysis.cheapestMultiCityCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ) : multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate ? (
                      <p>
                        No intentional trip matched the stop window yet | cheapest verified stopover trip:{" "}
                        {multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate.cityName} (
                        {multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate.cityCode}) | fare{" "}
                        {typeof multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate
                          .displayedAmount === "number"
                          ? `AUD ${multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate.displayedAmount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : "Not recorded"}
                        {typeof multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate
                          .baselinePriceDelta === "number"
                          ? ` | delta AUD ${multiCityVerificationResultsAnalysis.cheapestVerifiedMultiCityCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ) : null}
                    {(multiCityVerificationResultsAnalysis.cityResults ?? []).slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) |{" "}
                        {typeof entry.cheapestCandidatePrice === "number"
                          ? `cheapest intentional fare AUD ${entry.cheapestCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : `no intentional fare yet, cheapest verified stopover ${
                              typeof entry.cheapestVerifiedCandidatePrice === "number"
                                ? `AUD ${entry.cheapestVerifiedCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                                : "not recorded"
                            }`}{" "}
                        | intentional {entry.intentionalCandidateCount ?? 0} | verified {entry.candidateCount ?? 0} | tested seed contexts{" "}
                        {entry.seedContextCount ?? 0}
                        {typeof entry.bestCandidate?.baselinePriceDelta === "number"
                          ? ` | delta AUD ${entry.bestCandidate.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {multiCityRankAnalysis?.rankedCities?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Ranked stopover cities</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Reviewed {multiCityRankAnalysis.reviewedCandidateCount ?? 0} baseline contexts
                    before ranking cities.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {multiCityRankAnalysis.rankedCities.slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) | score {entry.score ?? 0} | reviewed contexts{" "}
                        {entry.reviewedCandidateCount ?? 0}
                        {typeof entry.baselinePriceDelta === "number"
                          ? ` | delta AUD ${entry.baselinePriceDelta.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}{" "}
                        | families {entry.familyCount ?? 0}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {longStopAnalysis?.cityValidations?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Long-stop readiness</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Minimum promising stop length: {longStopAnalysis.minimumLongStopHours ?? 0}h
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {longStopAnalysis.cityValidations.slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) | {entry.recommendation ?? "not_ready"} | verified candidates{" "}
                        {entry.verifiedCandidateCount ?? 0}
                        {typeof entry.longestObservedStopHours === "number"
                          ? ` | longest stop ${entry.longestObservedStopHours.toFixed(1)}h`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {longStopFollowupAnalysis?.cityResults?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Long-stop follow-up</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Queried {longStopFollowupAnalysis.queriedCityCount ?? 0} cit
                    {longStopFollowupAnalysis.queriedCityCount === 1 ? "y" : "ies"} with a target stop
                    length of at least {longStopFollowupAnalysis.minimumLongStopHours ?? 0}h.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {longStopFollowupAnalysis.cityResults.slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) | long-stop candidates{" "}
                        {entry.candidateCount ?? 0}
                        {typeof entry.longestObservedStopHours === "number"
                          ? ` | longest stop ${entry.longestObservedStopHours.toFixed(1)}h`
                          : ""}
                        {typeof entry.cheapestCandidatePrice === "number"
                          ? ` | cheapest fare AUD ${entry.cheapestCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {alternateReturnAnalysis?.comparedCities?.length ? (
                <div className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Alternate-city comparison</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Compared {alternateReturnAnalysis.cityTargetCount ?? 0} cit
                    {alternateReturnAnalysis.cityTargetCount === 1 ? "y" : "ies"} using up to{" "}
                    {alternateReturnAnalysis.datePairLimit ?? 0} date pair
                    {alternateReturnAnalysis.datePairLimit === 1 ? "" : "s"} per city.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {alternateReturnAnalysis.comparedCities.slice(0, 4).map((entry) => (
                      <p key={entry.cityCode}>
                        {entry.cityName} ({entry.cityCode}) | score {entry.targetScore ?? 0} | queries{" "}
                        {entry.queryCount ?? 0} | candidates {entry.candidateCount ?? 0}
                        {typeof entry.cheapestCandidatePrice === "number"
                          ? ` | cheapest fare AUD ${entry.cheapestCandidatePrice.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Multi-city evidence and any alternate-city comparison evidence will appear here once those strategy clusters run.
            </p>
          )}
        </div>

        <div className="rounded-[28px] border border-line bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Preview candidates
          </p>
          {data.candidates.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.candidates.map((candidate) => (
                <div key={candidate.id} className="rounded-[20px] bg-mist px-4 py-4">
                  <p className="text-sm font-semibold text-ink">
                    {candidate.displayedDisplayCurrency}{" "}
                    {candidate.displayedDisplayAmount.toLocaleString("en-AU", {
                      maximumFractionDigits: 0
                    })}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {candidate.outboundDestinationCity} | {candidate.stopCount} stop
                    {candidate.stopCount === 1 ? "" : "s"} | {candidate.intentionalStopCount} intentional
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {candidate.riskNotes ?? "No candidate notes yet."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Candidates will appear here once deterministic placeholder execution completes.
            </p>
          )}
        </div>
      </aside>
      </section>
  );
}
