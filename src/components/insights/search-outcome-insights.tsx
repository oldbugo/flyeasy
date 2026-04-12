import type { ReactNode } from "react";

import {
  BaselineExecutionInsights,
  type BaselineExecutionEfficiencySummary
} from "@/components/insights/baseline-efficiency-insights";
import {
  BaselineHandoffDetails,
  BaselineHandoffSummary,
  type BaselineFollowupHandoffSummary,
  type BaselineReturnOptionExpansionSummary
} from "@/components/insights/baseline-followup-handoff";
import { BaselineMarketInsights, type BaselineMarketSummary } from "@/components/insights/baseline-market-insights";

export type SearchOutcomeEvidence = {
  baselineExecutionEfficiency: {
    createdAt: string;
    summary: BaselineExecutionEfficiencySummary | null;
  } | null;
  baselineFollowupHandoff: {
    createdAt: string;
    summary: BaselineFollowupHandoffSummary | null;
  } | null;
  baselineReturnOptionExpansion: {
    createdAt: string;
    summary: BaselineReturnOptionExpansionSummary | null;
  } | null;
  alternateReturnCitySummary: {
    createdAt: string;
    summary: {
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
    } | null;
  } | null;
  anchoredMultiCityResults: {
    createdAt: string;
    summary: {
      candidateCount?: number;
      cheapestVerifiedMultiCityCandidate?: {
        baselinePriceDelta?: number | null;
        cityCode: string;
        cityName: string;
        displayedAmount?: number | null;
        sourceDepartDate?: string | null;
        sourceOutboundAirline?: string | null;
        sourceReturnAirline?: string | null;
        sourceReturnDate?: string | null;
      } | null;
      cheapestMultiCityCandidate?: {
        baselinePriceDelta?: number | null;
        cityCode: string;
        cityName: string;
        displayedAmount?: number | null;
        sourceDepartDate?: string | null;
        sourceOutboundAirline?: string | null;
        sourceReturnAirline?: string | null;
        sourceReturnDate?: string | null;
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
      dateVariationLimit?: number;
      queriedCityCount?: number;
      queriedSeedCount?: number;
      sessionStopDurationMaxDays?: number | null;
      sessionStopDurationMinDays?: number | null;
      testedDateVariationCount?: number;
    } | null;
  } | null;
  multiCityLongStopFollowup: {
    createdAt: string;
    summary: {
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
    } | null;
  } | null;
  multiCityLongStopValidation: {
    createdAt: string;
    summary: {
      cityValidations?: Array<{
        cheapestVerifiedPrice?: number | null;
        cityCode: string;
        cityName: string;
        longestObservedStopHours?: number;
        recommendation?: string;
        verifiedCandidateCount?: number;
      }>;
      minimumLongStopHours?: number;
    } | null;
  } | null;
  multiCityVerificationRank: {
    createdAt: string;
    summary: {
      baselineCheapestPrice?: number | null;
      cityEntryFindings?: Array<{
        baselinePriceDelta?: number | null;
        cheapestPrice?: number | null;
        cityCode: string;
        cityName: string;
      }>;
      rankedCities?: Array<{
        baselinePriceDelta?: number | null;
        cheapestCandidatePrice?: number | null;
        cityCode: string;
        cityName: string;
        familyCount?: number;
        longestStopDurationMinutes?: number;
        reviewedCandidateCount?: number;
        reviewedSeedContexts?: Array<{
          baselinePriceDelta?: number | null;
          candidateFamilyId?: string | null;
          departDate?: string | null;
          familyKey?: string | null;
          outboundAirline?: string | null;
          returnAirline?: string | null;
          returnDate?: string | null;
          seedScore?: number;
        }>;
        score?: number;
      }>;
      reviewedCandidateCount?: number;
    } | null;
  } | null;
  multiCityVerificationResults: {
    createdAt: string;
    summary: {
      baselineCheapestPrice?: number | null;
      candidateCount?: number;
      cheapestVerifiedMultiCityCandidate?: {
        baselinePriceDelta?: number | null;
        candidateId: string;
        cityCode: string;
        cityName: string;
        displayedAmount?: number | null;
        intentionalStopCount?: number;
        sourceCandidateFamilyId?: string | null;
        sourceDepartDate?: string | null;
        sourceFamilyKey?: string | null;
        sourceOutboundAirline?: string | null;
        sourceReturnAirline?: string | null;
        sourceReturnDate?: string | null;
      } | null;
      cheapestMultiCityCandidate?: {
        baselinePriceDelta?: number | null;
        candidateId: string;
        cityCode: string;
        cityName: string;
        displayedAmount?: number | null;
        intentionalStopCount?: number;
        sourceCandidateFamilyId?: string | null;
        sourceDepartDate?: string | null;
        sourceFamilyKey?: string | null;
        sourceOutboundAirline?: string | null;
        sourceReturnAirline?: string | null;
        sourceReturnDate?: string | null;
      } | null;
      cityResults?: Array<{
        baselineCheapestPrice?: number | null;
        bestCandidate?: {
          baselinePriceDelta?: number | null;
          candidateId: string;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
          intentionalStopCount?: number;
          sourceCandidateFamilyId?: string | null;
          sourceDepartDate?: string | null;
          sourceFamilyKey?: string | null;
          sourceOutboundAirline?: string | null;
          sourceReturnAirline?: string | null;
          sourceReturnDate?: string | null;
        } | null;
        bestVerifiedCandidate?: {
          baselinePriceDelta?: number | null;
          candidateId: string;
          cityCode: string;
          cityName: string;
          displayedAmount?: number | null;
          intentionalStopCount?: number;
          sourceCandidateFamilyId?: string | null;
          sourceDepartDate?: string | null;
          sourceFamilyKey?: string | null;
          sourceOutboundAirline?: string | null;
          sourceReturnAirline?: string | null;
          sourceReturnDate?: string | null;
        } | null;
        bestSeedContext?: {
          baselinePriceDelta?: number | null;
          candidateFamilyId?: string | null;
          departDate?: string | null;
          familyKey?: string | null;
          outboundAirline?: string | null;
          returnAirline?: string | null;
          returnDate?: string | null;
        } | null;
        candidateCount?: number;
        cheapestCandidatePrice?: number | null;
        cheapestVerifiedCandidatePrice?: number | null;
        cityCode: string;
        cityName: string;
        intentionalCandidateCount?: number;
        seedContextCount?: number;
        testedAirlines?: string[];
        testedDatePairs?: string[];
        testedFamilies?: string[];
      }>;
      intentionalCandidateCount?: number;
      queriedCityCount?: number;
      queriedSeedCount?: number;
      sessionStopDurationMaxDays?: number | null;
      sessionStopDurationMinDays?: number | null;
    } | null;
  } | null;
  pass1MarketScan: {
    createdAt: string;
    summary: BaselineMarketSummary | null;
  } | null;
};

type SearchOutcomeSummaryProps = {
  evidence: SearchOutcomeEvidence;
};

type SearchOutcomeDetailsProps = {
  evidence: SearchOutcomeEvidence;
  latestRunStatus?: string | null;
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `AUD ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatStopWindowLabel(minDays: number | null | undefined, maxDays: number | null | undefined) {
  if (typeof minDays !== "number" || !Number.isFinite(minDays)) {
    return "the session stop window";
  }

  if (typeof maxDays !== "number" || !Number.isFinite(maxDays) || maxDays <= minDays) {
    return `${minDays} day${minDays === 1 ? "" : "s"} or longer`;
  }

  return `${minDays}-${maxDays} days`;
}

function resolveAnchoredMultiCityOutcomeState(evidence: SearchOutcomeEvidence) {
  const summary = evidence.anchoredMultiCityResults?.summary ?? null;

  if (!summary) {
    return null;
  }

  const stopWindowLabel = formatStopWindowLabel(
    summary.sessionStopDurationMinDays,
    summary.sessionStopDurationMaxDays
  );

  if (summary.cheapestMultiCityCandidate) {
    return {
      detail: `Cheapest true multi-city trip within ${stopWindowLabel} so far is ${formatCurrency(summary.cheapestMultiCityCandidate.displayedAmount)} with delta ${formatCurrency(summary.cheapestMultiCityCandidate.baselinePriceDelta ?? null)} against the baseline cheapest fare.`,
      label: `${summary.cheapestMultiCityCandidate.cityName} (${summary.cheapestMultiCityCandidate.cityCode})`,
      meta: "Cheapest true multi-city trip",
      state: "matched" as const,
      stopWindowLabel
    };
  }

  if (summary.cheapestVerifiedMultiCityCandidate) {
    return {
      detail: `No true multi-city trip has matched ${stopWindowLabel} yet. The cheapest verified anchored multi-city trip so far is ${formatCurrency(summary.cheapestVerifiedMultiCityCandidate.displayedAmount)} with delta ${formatCurrency(summary.cheapestVerifiedMultiCityCandidate.baselinePriceDelta ?? null)} against the baseline cheapest fare.`,
      label: `${summary.cheapestVerifiedMultiCityCandidate.cityName} (${summary.cheapestVerifiedMultiCityCandidate.cityCode})`,
      meta: "Cheapest verified true multi-city trip",
      state: "verified_only" as const,
      stopWindowLabel
    };
  }

  return {
    detail: `No true multi-city result has satisfied ${stopWindowLabel} yet.`,
    label: "No qualifying true multi-city trip yet",
    meta: "Anchored multi-city outcome",
    state: "empty" as const,
    stopWindowLabel
  };
}

function resolveMultiCityOutcomeState(evidence: SearchOutcomeEvidence) {
  const verification = evidence.multiCityVerificationResults?.summary ?? null;
  const validation = evidence.multiCityLongStopValidation?.summary ?? null;
  const stopWindowLabel = formatStopWindowLabel(
    verification?.sessionStopDurationMinDays,
    verification?.sessionStopDurationMaxDays
  );
  const minimumStopHours =
    typeof verification?.sessionStopDurationMinDays === "number" &&
    Number.isFinite(verification.sessionStopDurationMinDays)
      ? verification.sessionStopDurationMinDays * 24
      : null;
  const closestNearMiss =
    [...(validation?.cityValidations ?? [])]
      .filter((entry) => typeof entry.longestObservedStopHours === "number")
      .sort((left, right) => {
        const longestDifference =
          Number(right.longestObservedStopHours ?? 0) - Number(left.longestObservedStopHours ?? 0);
        if (longestDifference !== 0) {
          return longestDifference;
        }

        return (
          Number(left.cheapestVerifiedPrice ?? Number.POSITIVE_INFINITY) -
          Number(right.cheapestVerifiedPrice ?? Number.POSITIVE_INFINITY)
        );
      })[0] ?? null;

  if (verification?.cheapestMultiCityCandidate) {
    return {
      detail: `Cheapest intentional multi-city trip within ${stopWindowLabel} so far is ${formatCurrency(verification.cheapestMultiCityCandidate.displayedAmount)} with delta ${formatCurrency(verification.cheapestMultiCityCandidate.baselinePriceDelta ?? null)} against the baseline cheapest fare.`,
      label: `${verification.cheapestMultiCityCandidate.cityName} (${verification.cheapestMultiCityCandidate.cityCode})`,
      meta: "Cheapest multi-city trip",
      state: "matched" as const,
      stopWindowLabel
    };
  }

  if (verification?.cheapestVerifiedMultiCityCandidate) {
    const nearMissText =
      closestNearMiss && minimumStopHours !== null
        ? `Closest miss is ${closestNearMiss.cityName} (${closestNearMiss.cityCode}) at ${Number(
            closestNearMiss.longestObservedStopHours ?? 0
          ).toFixed(1)}h, still ${Math.max(
            0,
            minimumStopHours - Number(closestNearMiss.longestObservedStopHours ?? 0)
          ).toFixed(1)}h short of the minimum.`
        : null;

    return {
      detail: `No intentional multi-city trip has matched ${stopWindowLabel} yet. The cheapest verified stopover trip so far is ${formatCurrency(verification.cheapestVerifiedMultiCityCandidate.displayedAmount)} with delta ${formatCurrency(verification.cheapestVerifiedMultiCityCandidate.baselinePriceDelta ?? null)} against the baseline cheapest fare.${nearMissText ? ` ${nearMissText}` : ""}`,
      label: `${verification.cheapestVerifiedMultiCityCandidate.cityName} (${verification.cheapestVerifiedMultiCityCandidate.cityCode})`,
      meta: "Cheapest verified stopover",
      nearestMiss: closestNearMiss
        ? {
            cityCode: closestNearMiss.cityCode,
            cityName: closestNearMiss.cityName,
            cheapestVerifiedPrice: closestNearMiss.cheapestVerifiedPrice ?? null,
            longestObservedStopHours: closestNearMiss.longestObservedStopHours ?? null,
            missingHours:
              minimumStopHours !== null
                ? Math.max(0, minimumStopHours - Number(closestNearMiss.longestObservedStopHours ?? 0))
                : null,
            recommendation: closestNearMiss.recommendation ?? null
          }
        : null,
      state: "verified_only" as const,
      stopWindowLabel
    };
  }

  return {
    detail: `No multi-city verification result has satisfied ${stopWindowLabel} yet.`,
    label: "No qualifying multi-city trip yet",
    meta: "Multi-city outcome",
    nearestMiss: closestNearMiss
      ? {
          cityCode: closestNearMiss.cityCode,
          cityName: closestNearMiss.cityName,
          cheapestVerifiedPrice: closestNearMiss.cheapestVerifiedPrice ?? null,
          longestObservedStopHours: closestNearMiss.longestObservedStopHours ?? null,
          missingHours:
            minimumStopHours !== null
              ? Math.max(0, minimumStopHours - Number(closestNearMiss.longestObservedStopHours ?? 0))
              : null,
          recommendation: closestNearMiss.recommendation ?? null
        }
      : null,
    state: "empty" as const,
    stopWindowLabel
  };
}

function SummaryCard(props: {
  detail: string;
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">{props.label}</p>
      <p className="mt-3 text-lg font-semibold text-ink">{props.value}</p>
      <p className="mt-2 text-sm text-slate-600">{props.meta}</p>
      <p className="mt-3 text-sm leading-7 text-slate-500">{props.detail}</p>
    </div>
  );
}

function DetailPanel(props: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-ink">{props.title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{props.description}</p>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function resolveFollowOnSignal(evidence: SearchOutcomeEvidence) {
  const anchoredOutcome = resolveAnchoredMultiCityOutcomeState(evidence);
  if (anchoredOutcome && anchoredOutcome.state !== "empty") {
    return {
      detail: anchoredOutcome.detail,
      label: anchoredOutcome.label,
      meta: anchoredOutcome.meta
    };
  }

  const multiCityOutcome = resolveMultiCityOutcomeState(evidence);
  if (multiCityOutcome.state !== "empty") {
    return {
      detail: multiCityOutcome.detail,
      label: multiCityOutcome.label,
      meta: multiCityOutcome.meta
    };
  }

  const promisingLongStop =
    evidence.multiCityLongStopValidation?.summary?.cityValidations?.find(
      (entry) => entry.recommendation === "promising"
    ) ?? null;

  if (promisingLongStop) {
    return {
      detail: `Promising for longer-stop follow-up. Cheapest verified fare ${formatCurrency(promisingLongStop.cheapestVerifiedPrice)}.`,
      label: `${promisingLongStop.cityName} (${promisingLongStop.cityCode})`,
      meta: "Strongest multi-city clue"
    };
  }

  const rankedCity = evidence.multiCityVerificationRank?.summary?.rankedCities?.[0] ?? null;

  if (rankedCity) {
    return {
      detail: `Top ranked stopover signal from the latest multi-city review. Cheapest candidate ${formatCurrency(rankedCity.cheapestCandidatePrice)}.`,
      label: `${rankedCity.cityName} (${rankedCity.cityCode})`,
      meta: "Leading stopover signal"
    };
  }

  const alternateCity = evidence.alternateReturnCitySummary?.summary?.comparedCities?.[0] ?? null;

  if (alternateCity) {
    return {
      detail: `Best alternate-city comparison from the latest flexible return-origin probe. Cheapest comparison fare ${formatCurrency(alternateCity.cheapestCandidatePrice)}.`,
      label: `${alternateCity.cityName} (${alternateCity.cityCode})`,
      meta: "Alternate return-city signal"
    };
  }

  return {
    detail: "No follow-on strategy evidence has been recorded yet.",
    label: "Waiting for follow-up runs",
    meta: "Follow-on signal"
  };
}

export function SearchOutcomeSummary({ evidence }: SearchOutcomeSummaryProps) {
  const bestDate = evidence.pass1MarketScan?.summary?.departureDateFindings?.[0] ?? null;
  const bestAirline = evidence.pass1MarketScan?.summary?.airlineFindings?.[0] ?? null;
  const bestCombo = evidence.pass1MarketScan?.summary?.departureAirlineFindings?.[0] ?? null;
  const followOnSignal = resolveFollowOnSignal(evidence);
  const followOnUpdatedAt =
    evidence.anchoredMultiCityResults?.createdAt ??
    evidence.multiCityVerificationResults?.createdAt ??
    evidence.multiCityLongStopValidation?.createdAt ??
    evidence.multiCityVerificationRank?.createdAt ??
    evidence.alternateReturnCitySummary?.createdAt ??
    null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
          Key signals
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          The clearest cues from the latest search evidence
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Keep this section for the fastest read. The results page still carries the full evidence
          breakdown when you need to inspect the reasoning in detail.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SummaryCard
          label="Cheapest departure date"
          value={bestDate ? bestDate.departDate : "Not recorded"}
          meta={bestDate ? formatCurrency(bestDate.cheapestPrice) : "Waiting for baseline evidence"}
          detail="Strongest date signal from the latest baseline market scan."
        />
        <SummaryCard
          label="Best date and airline pair"
          value={bestCombo ? `${bestCombo.airline} on ${bestCombo.departDate}` : "Not recorded"}
          meta={
            bestCombo
              ? formatCurrency(bestCombo.cheapestPrice)
              : bestAirline
                ? `${bestAirline.airline} is the cheapest carrier in the latest scan`
                : "Waiting for baseline evidence"
          }
          detail="Usually the first combination worth checking because fare often depends on both date and carrier."
        />
        <SummaryCard
          label="Strongest follow-up clue"
          value={followOnSignal.label}
          meta={
            followOnUpdatedAt
              ? `${followOnSignal.meta} | updated ${formatTimestamp(followOnUpdatedAt)}`
              : `${followOnSignal.meta} | no follow-on evidence yet`
          }
          detail={followOnSignal.detail}
        />
      </div>
    </section>
  );
}

export function SearchOutcomeDetails({
  evidence,
  latestRunStatus
}: SearchOutcomeDetailsProps) {
  const pass1Summary = evidence.pass1MarketScan?.summary;
  const baselineExecutionEfficiencySummary = evidence.baselineExecutionEfficiency?.summary;
  const baselineExpansionSummary = evidence.baselineReturnOptionExpansion?.summary;
  const baselineHandoffSummary = evidence.baselineFollowupHandoff?.summary;
  const anchoredMultiCitySummary = evidence.anchoredMultiCityResults?.summary;
  const multiCityRankSummary = evidence.multiCityVerificationRank?.summary;
  const multiCityVerificationResultsSummary = evidence.multiCityVerificationResults?.summary;
  const longStopValidationSummary = evidence.multiCityLongStopValidation?.summary;
  const longStopFollowupSummary = evidence.multiCityLongStopFollowup?.summary;
  const alternateReturnSummary = evidence.alternateReturnCitySummary?.summary;
  const anchoredMultiCityOutcome = resolveAnchoredMultiCityOutcomeState(evidence);
  const multiCityOutcome = resolveMultiCityOutcomeState(evidence);
  const hasAnyEvidence =
    Boolean(baselineExecutionEfficiencySummary) ||
    Boolean(baselineExpansionSummary) ||
    Boolean(baselineHandoffSummary) ||
    Boolean(anchoredMultiCitySummary) ||
    Boolean(pass1Summary) ||
    Boolean(multiCityRankSummary) ||
    Boolean(multiCityVerificationResultsSummary) ||
    Boolean(longStopValidationSummary) ||
    Boolean(longStopFollowupSummary) ||
    Boolean(alternateReturnSummary);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
          Search insights
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Detailed outcome boards for the latest search run
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Results is where the analysis detail lives. These boards show what the latest strategy
          work actually learned{latestRunStatus ? ` from the latest ${latestRunStatus} run` : ""}.
        </p>
      </div>

      {!hasAnyEvidence ? (
        <div className="rounded-[24px] border border-line bg-white px-6 py-5 text-sm leading-7 text-slate-600 shadow-sm">
          No analysis snapshots are available yet. Start a run to populate baseline and follow-on
          search insights.
        </div>
      ) : null}

      {pass1Summary ? (
        <DetailPanel
          title="Round-trip baseline"
          description={`Latest baseline evidence recorded ${formatTimestamp(
            evidence.pass1MarketScan?.createdAt ?? ""
          )}. This shows which dates, airlines, and exact pairings produced the cheapest round-trip value.`}
        >
          <div className="space-y-4">
            {baselineExecutionEfficiencySummary ? (
              <BaselineExecutionInsights summary={baselineExecutionEfficiencySummary} />
            ) : null}
            <BaselineMarketInsights summary={pass1Summary} />
            <BaselineHandoffDetails
              expansionSummary={baselineExpansionSummary}
              handoffSummary={baselineHandoffSummary}
            />
          </div>
        </DetailPanel>
      ) : null}

      {multiCityRankSummary || multiCityVerificationResultsSummary || longStopValidationSummary || longStopFollowupSummary ? (
        <DetailPanel
          title="Multi-city verification"
          description="These panels show the latest stopover-city ranking, the verified multi-city outcomes, longer-stop readiness, and the dedicated long-stop follow-up results from the multi-city cluster."
        >
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Multi-city outcome</p>
              <p className="mt-1 text-xs text-slate-500">
                {multiCityVerificationResultsSummary?.queriedSeedCount ?? 0} seed context
                {multiCityVerificationResultsSummary?.queriedSeedCount === 1 ? "" : "s"} tested
                {typeof multiCityVerificationResultsSummary?.intentionalCandidateCount === "number"
                  ? ` | ${multiCityVerificationResultsSummary.intentionalCandidateCount} intentional candidate${multiCityVerificationResultsSummary.intentionalCandidateCount === 1 ? "" : "s"}`
                  : ""}
                {evidence.multiCityVerificationResults
                  ? ` | updated ${formatTimestamp(evidence.multiCityVerificationResults.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-[16px] bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{multiCityOutcome.label}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        multiCityOutcome.state === "matched"
                          ? "bg-emerald-100 text-emerald-800"
                          : multiCityOutcome.state === "verified_only"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {multiCityOutcome.state === "matched"
                        ? "qualifies"
                        : multiCityOutcome.state === "verified_only"
                          ? "near miss"
                          : "not found"}
                    </span>
                  </div>
                  <p className="mt-1">Required stop window {multiCityOutcome.stopWindowLabel}</p>
                  <p className="mt-1">{multiCityOutcome.detail}</p>
                  {multiCityVerificationResultsSummary?.cheapestMultiCityCandidate ? (
                    <p className="mt-1">
                      {multiCityVerificationResultsSummary.cheapestMultiCityCandidate.sourceDepartDate ??
                        "Undated"}{" "}
                      {"->"}{" "}
                      {multiCityVerificationResultsSummary.cheapestMultiCityCandidate.sourceReturnDate ??
                        "Undated"}{" "}
                      |{" "}
                      {[
                        multiCityVerificationResultsSummary.cheapestMultiCityCandidate
                          .sourceOutboundAirline,
                        multiCityVerificationResultsSummary.cheapestMultiCityCandidate
                          .sourceReturnAirline
                      ]
                        .filter(Boolean)
                        .join(" / ") || "Unknown carrier"}
                    </p>
                  ) : null}
                  {multiCityOutcome.nearestMiss ? (
                    <p className="mt-1">
                      Closest miss: {multiCityOutcome.nearestMiss.cityName} (
                      {multiCityOutcome.nearestMiss.cityCode}) | longest observed stop{" "}
                      {typeof multiCityOutcome.nearestMiss.longestObservedStopHours === "number"
                        ? `${multiCityOutcome.nearestMiss.longestObservedStopHours.toFixed(1)}h`
                        : "not recorded"}
                      {typeof multiCityOutcome.nearestMiss.missingHours === "number"
                        ? ` | short by ${multiCityOutcome.nearestMiss.missingHours.toFixed(1)}h`
                        : ""}
                      {" | "}cheapest verified{" "}
                      {formatCurrency(multiCityOutcome.nearestMiss.cheapestVerifiedPrice)}
                    </p>
                  ) : null}
                </div>
                {(multiCityVerificationResultsSummary?.cityResults ?? []).slice(0, 3).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <p className="font-semibold text-ink">
                      {entry.cityName} ({entry.cityCode})
                    </p>
                    {typeof entry.cheapestCandidatePrice === "number" ? (
                      <>
                        <p className="mt-1">
                          Cheapest intentional trip {formatCurrency(entry.cheapestCandidatePrice)} | intentional candidates{" "}
                          {entry.intentionalCandidateCount ?? 0}
                        </p>
                        <p className="mt-1">
                          Delta {formatCurrency(entry.bestCandidate?.baselinePriceDelta ?? null)} | verified{" "}
                          {entry.candidateCount ?? 0}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1">
                          No intentional trip in window yet | cheapest verified stopover{" "}
                          {formatCurrency(entry.cheapestVerifiedCandidatePrice)}
                        </p>
                        <p className="mt-1">
                          Verified candidates {entry.candidateCount ?? 0} | tested {entry.seedContextCount ?? 0} seed context
                          {entry.seedContextCount === 1 ? "" : "s"}
                        </p>
                      </>
                    )}
                  </div>
                ))}
                {!multiCityVerificationResultsSummary?.cheapestMultiCityCandidate &&
                !multiCityVerificationResultsSummary?.cheapestVerifiedMultiCityCandidate &&
                !multiCityVerificationResultsSummary?.cityResults?.length ? (
                  <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                    No multi-city verification result board has been recorded yet.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Ranked stopover cities</p>
              <p className="mt-1 text-xs text-slate-500">
                {multiCityRankSummary?.reviewedCandidateCount ?? 0} baseline contexts reviewed
                {evidence.multiCityVerificationRank
                  ? ` | updated ${formatTimestamp(evidence.multiCityVerificationRank.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                {(multiCityRankSummary?.rankedCities ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <p className="font-semibold text-ink">
                      {entry.cityName} ({entry.cityCode})
                    </p>
                    <p className="mt-1">
                      Score {entry.score ?? 0} | reviewed contexts {entry.reviewedCandidateCount ?? 0}
                    </p>
                    <p className="mt-1">
                      Cheapest candidate {formatCurrency(entry.cheapestCandidatePrice)}
                      {typeof entry.baselinePriceDelta === "number"
                        ? ` | delta ${formatCurrency(entry.baselinePriceDelta)}`
                        : ""}
                      {typeof entry.longestStopDurationMinutes === "number"
                        ? ` | longest stop ${Number(entry.longestStopDurationMinutes / 60).toFixed(1)}h`
                        : ""}
                    </p>
                    <p className="mt-1">
                      Families {entry.familyCount ?? 0}
                      {entry.reviewedSeedContexts?.[0]
                        ? ` | best seed ${entry.reviewedSeedContexts[0].departDate ?? "?"} -> ${entry.reviewedSeedContexts[0].returnDate ?? "?"}`
                        : ""}
                    </p>
                  </div>
                ))}
                {!multiCityRankSummary?.rankedCities?.length ? (
                  <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                    No ranked stopover cities have been recorded yet.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Long-stop readiness</p>
              <p className="mt-1 text-xs text-slate-500">
                Minimum promising stop length {longStopValidationSummary?.minimumLongStopHours ?? "not set"}h
                {evidence.multiCityLongStopValidation
                  ? ` | updated ${formatTimestamp(evidence.multiCityLongStopValidation.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                {(longStopValidationSummary?.cityValidations ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">
                        {entry.cityName} ({entry.cityCode})
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          entry.recommendation === "promising"
                            ? "bg-emerald-100 text-emerald-800"
                            : entry.recommendation === "watch"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {entry.recommendation ?? "not_ready"}
                      </span>
                    </div>
                    <p className="mt-1">
                      Verified candidates {entry.verifiedCandidateCount ?? 0}
                      {typeof entry.longestObservedStopHours === "number"
                        ? ` | longest stop ${entry.longestObservedStopHours.toFixed(1)}h`
                        : ""}
                    </p>
                    <p className="mt-1">
                      Cheapest verified fare {formatCurrency(entry.cheapestVerifiedPrice)}
                    </p>
                  </div>
                ))}
                {!longStopValidationSummary?.cityValidations?.length ? (
                  <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                    No long-stop validation snapshot has been recorded yet.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Long-stop follow-up</p>
              <p className="mt-1 text-xs text-slate-500">
                Target stop length {longStopFollowupSummary?.minimumLongStopHours ?? "not set"}h
                {evidence.multiCityLongStopFollowup
                  ? ` | updated ${formatTimestamp(evidence.multiCityLongStopFollowup.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                {(longStopFollowupSummary?.cityResults ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">
                        {entry.cityName} ({entry.cityCode})
                      </p>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                        {entry.recommendation ?? "watch"}
                      </span>
                    </div>
                    <p className="mt-1">
                      Long-stop candidates {entry.candidateCount ?? 0}
                      {typeof entry.longestObservedStopHours === "number"
                        ? ` | longest stop ${entry.longestObservedStopHours.toFixed(1)}h`
                        : ""}
                    </p>
                    <p className="mt-1">
                      Cheapest long-stop fare {formatCurrency(entry.cheapestCandidatePrice)}
                    </p>
                  </div>
                ))}
                {!longStopFollowupSummary?.cityResults?.length ? (
                  <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                    No dedicated long-stop queries have been recorded yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </DetailPanel>
      ) : null}

      {anchoredMultiCitySummary ? (
        <DetailPanel
          title="Anchored multi-city search"
          description="These panels show the latest true Trip.com multi-city outcomes. The strategy keeps the baseline departure and final return dates anchored, then varies the stopover departure date inside the session stop window."
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">True multi-city outcome</p>
              <p className="mt-1 text-xs text-slate-500">
                {anchoredMultiCitySummary.queriedSeedCount ?? 0} seed context
                {anchoredMultiCitySummary.queriedSeedCount === 1 ? "" : "s"} tested across{" "}
                {anchoredMultiCitySummary.queriedCityCount ?? 0} cit
                {anchoredMultiCitySummary.queriedCityCount === 1 ? "y" : "ies"} and{" "}
                {anchoredMultiCitySummary.testedDateVariationCount ?? 0} date variation
                {anchoredMultiCitySummary.testedDateVariationCount === 1 ? "" : "s"}
                {evidence.anchoredMultiCityResults
                  ? ` | updated ${formatTimestamp(evidence.anchoredMultiCityResults.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-[16px] bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">
                      {anchoredMultiCityOutcome?.label ?? "No qualifying true multi-city trip yet"}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        anchoredMultiCityOutcome?.state === "matched"
                          ? "bg-emerald-100 text-emerald-800"
                          : anchoredMultiCityOutcome?.state === "verified_only"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {anchoredMultiCityOutcome?.state === "matched"
                        ? "qualifies"
                        : anchoredMultiCityOutcome?.state === "verified_only"
                          ? "verified only"
                          : "not found"}
                    </span>
                  </div>
                  <p className="mt-1">
                    Required stop window {anchoredMultiCityOutcome?.stopWindowLabel ?? "the session stop window"}
                  </p>
                  <p className="mt-1">
                    {anchoredMultiCityOutcome?.detail ??
                      "No true multi-city result board has been recorded yet."}
                  </p>
                  {anchoredMultiCitySummary.cheapestMultiCityCandidate ? (
                    <p className="mt-1">
                      {anchoredMultiCitySummary.cheapestMultiCityCandidate.sourceDepartDate ?? "Undated"}{" "}
                      {"->"}{" "}
                      {anchoredMultiCitySummary.cheapestMultiCityCandidate.sourceReturnDate ?? "Undated"}{" "}
                      |{" "}
                      {[
                        anchoredMultiCitySummary.cheapestMultiCityCandidate.sourceOutboundAirline,
                        anchoredMultiCitySummary.cheapestMultiCityCandidate.sourceReturnAirline
                      ]
                        .filter(Boolean)
                        .join(" / ") || "Unknown carrier"}
                    </p>
                  ) : null}
                </div>

                {(anchoredMultiCitySummary.cityResults ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <p className="font-semibold text-ink">
                      {entry.cityName} ({entry.cityCode})
                    </p>
                    {typeof entry.cheapestCandidatePrice === "number" ? (
                      <>
                        <p className="mt-1">
                          Cheapest true multi-city trip {formatCurrency(entry.cheapestCandidatePrice)} | intentional candidates{" "}
                          {entry.intentionalCandidateCount ?? 0}
                        </p>
                        <p className="mt-1">
                          Delta {formatCurrency(entry.bestCandidate?.baselinePriceDelta ?? null)} | tested contexts{" "}
                          {entry.seedContextCount ?? 0}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1">
                          No qualifying true multi-city trip yet | cheapest verified trip{" "}
                          {formatCurrency(entry.cheapestVerifiedCandidatePrice)}
                        </p>
                        <p className="mt-1">
                          Verified candidates {entry.candidateCount ?? 0} | tested contexts{" "}
                          {entry.seedContextCount ?? 0}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Adapter budget</p>
              <p className="mt-1 text-xs text-slate-500">
                Bounded controls from the latest anchored multi-city search snapshot.
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-[16px] bg-white px-3 py-3">
                  <p>
                    Queried cities {anchoredMultiCitySummary.queriedCityCount ?? 0} | seed contexts{" "}
                    {anchoredMultiCitySummary.queriedSeedCount ?? 0}
                  </p>
                  <p className="mt-1">
                    Tested stopover date variations {anchoredMultiCitySummary.testedDateVariationCount ?? 0}
                  </p>
                  <p className="mt-1">
                    Configured date-variation limit {anchoredMultiCitySummary.dateVariationLimit ?? "not recorded"}
                  </p>
                  <p className="mt-1">
                    Cheapest verified true multi-city trip{" "}
                    {formatCurrency(
                      anchoredMultiCitySummary.cheapestMultiCityCandidate?.displayedAmount ??
                        anchoredMultiCitySummary.cheapestVerifiedMultiCityCandidate?.displayedAmount ??
                        null
                    )}
                  </p>
                </div>
                {!anchoredMultiCitySummary.cityResults?.length ? (
                  <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                    No anchored multi-city result board has been recorded yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </DetailPanel>
      ) : null}

      {alternateReturnSummary ? (
        <DetailPanel
          title="Alternate return-city exploration"
          description="This board shows the most recent bounded alternate-city comparison, including which cities were tested and why they were selected."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Compared cities</p>
              <p className="mt-1 text-xs text-slate-500">
                Targeted {alternateReturnSummary.cityTargetCount ?? 0} cit
                {alternateReturnSummary.cityTargetCount === 1 ? "y" : "ies"}
                {evidence.alternateReturnCitySummary
                  ? ` | updated ${formatTimestamp(evidence.alternateReturnCitySummary.createdAt)}`
                  : ""}
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                {(alternateReturnSummary.comparedCities ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                    <p className="font-semibold text-ink">
                      {entry.cityName} ({entry.cityCode})
                    </p>
                    <p className="mt-1">
                      Score {entry.targetScore ?? 0} | queries {entry.queryCount ?? 0} | candidates{" "}
                      {entry.candidateCount ?? 0}
                    </p>
                    <p className="mt-1">
                      Cheapest comparison fare {formatCurrency(entry.cheapestCandidatePrice)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[18px] bg-mist px-4 py-4">
              <p className="text-sm font-semibold text-ink">Why these cities</p>
              <p className="mt-1 text-xs text-slate-500">
                Each city is selected from baseline and multi-city evidence before the bounded
                comparison runs.
              </p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                {(alternateReturnSummary.comparedCities ?? []).slice(0, 3).map((entry) => (
                  <div key={`${entry.cityCode}-reason`} className="rounded-[16px] bg-white px-3 py-3">
                    <p className="font-semibold text-ink">
                      {entry.cityName} ({entry.cityCode})
                    </p>
                    <div className="mt-2 space-y-1">
                      {(entry.reasons ?? []).slice(0, 3).map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DetailPanel>
      ) : null}
    </section>
  );
}
