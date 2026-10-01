import type { sessions } from "@/lib/db/schema/session";

import type { StrategyPlan } from "./types";

type SessionRecord = typeof sessions.$inferSelect;

export type SearchStrategyBundleKey =
  | "alternate_return_city_exploration"
  | "adaptive_coverage_market_scan"
  | "anchored_multi_city_search"
  | "price_first_market_scan"
  | "multi_city_verification"
  | "recommendation_date_coverage"
  | "stitched_value_probe";

// Date-sampling variants of the round-trip baseline, tested as experiment
// arms (docs/uplifts/2026-10-date-search-strategy/03b-revised-plan-app-runs.md).
// The planners live in scripts/automation/lib/date-planners.mjs.
export type DateSamplingMode = "rotating_coverage" | "weekday_sampling" | "middle_start";

export const DATE_STRATEGY_TEST_ARMS: ReadonlyArray<{
  armKey: string;
  samplingMode: DateSamplingMode;
  title: string;
}> = [
  { armKey: "date_rotating_coverage", samplingMode: "rotating_coverage", title: "Rotating coverage" },
  { armKey: "date_weekday_sampling", samplingMode: "weekday_sampling", title: "Weekday sampling" },
  { armKey: "date_middle_start", samplingMode: "middle_start", title: "Start in the middle" }
];

export function isDateSamplingMode(value: unknown): value is DateSamplingMode {
  return value === "rotating_coverage" || value === "weekday_sampling" || value === "middle_start";
}

export type MarketScanBundleConfig = {
  anchoredReturnSweepLimitOverride: number | null;
  anchorDepartureDateLimitOverride: number | null;
  directSweepLimitOverride: number | null;
  enableReturnOptionExpansion: boolean;
  enableAnchoredDateFollowup: boolean;
  maxOutboundOptionsPerQueryOverride: number | null;
  maxReturnOptionsPerOutboundOverride: number | null;
  returnOptionExpansionTargetLimitOverride: number | null;
  returnOptionExpansionVariationLimitOverride: number | null;
  // Set only on experiment arms; null keeps today's even coverage.
  samplingModeOverride: DateSamplingMode | null;
};

export type AdaptiveCoverageMarketScanConfig = MarketScanBundleConfig & {
  initialSeedSweepLimitOverride: number | null;
};

export type MultiCityVerificationConfig = {
  candidateReviewLimitOverride: number | null;
  followupCityLimitOverride: number | null;
  longStopFollowupCityLimitOverride: number | null;
  longStopValidationMinHoursOverride: number | null;
  seedContextsPerCityLimitOverride: number | null;
};

export type AlternateReturnCityExplorationConfig = {
  candidateCityLimitOverride: number | null;
  datePairLimitOverride: number | null;
};

export type AnchoredMultiCitySearchConfig = {
  candidateReviewLimitOverride: number | null;
  dateVariationLimitOverride: number | null;
  followupCityLimitOverride: number | null;
  seedContextsPerCityLimitOverride: number | null;
  segmentOptionLimitOverride: number | null;
};

export type RecommendationDateCoverageConfig = {
  candidateReviewLimitOverride: number | null;
  dateVariationLimitOverride: number | null;
  routeTargetLimitOverride: number | null;
};

export type StitchedValueProbeConfig = {
  discountRateOverride: number | null;
  maxDerivedCandidatesOverride: number | null;
};

export type SearchStrategyBundleConfigByKey = {
  alternate_return_city_exploration: AlternateReturnCityExplorationConfig;
  adaptive_coverage_market_scan: AdaptiveCoverageMarketScanConfig;
  anchored_multi_city_search: AnchoredMultiCitySearchConfig;
  multi_city_verification: MultiCityVerificationConfig;
  price_first_market_scan: MarketScanBundleConfig;
  recommendation_date_coverage: RecommendationDateCoverageConfig;
  stitched_value_probe: StitchedValueProbeConfig;
};

export type StrategyBundleCompatibility = {
  isCompatible: boolean;
  reason: string | null;
};

export type SearchIntensityDefaults = {
  alternateReturnCandidateCityLimit: number;
  alternateReturnDatePairLimit: number;
  anchoredMultiCityCandidateReviewLimit: number;
  anchoredMultiCityDateVariationLimit: number;
  anchoredMultiCityFollowupCityLimit: number;
  anchoredMultiCitySeedContextsPerCityLimit: number;
  anchoredMultiCitySegmentOptionLimit: number;
  anchorDepartureDateLimit: number;
  anchoredReturnSweepLimit: number;
  baselineReturnOptionExpansionTargetLimit: number;
  baselineReturnOptionExpansionVariationLimit: number;
  directSweepLimit: number;
  multiCityCandidateReviewLimit: number;
  multiCityFollowupCityLimit: number;
  multiCityLongStopFollowupCityLimit: number;
  multiCityLongStopValidationMinHours: number;
  multiCitySeedContextsPerCityLimit: number;
  maxOutboundOptionsPerQuery: number;
  maxReturnOptionsPerOutbound: number;
  recommendationDateCoverageCandidateReviewLimit: number;
  recommendationDateCoverageDateVariationLimit: number;
  recommendationDateCoverageRouteTargetLimit: number;
};

export type SearchStrategyBundleSelection<
  K extends SearchStrategyBundleKey = SearchStrategyBundleKey
> = {
  compatibility: StrategyBundleCompatibility;
  config: SearchStrategyBundleConfigByKey[K];
  description: string;
  enabled: boolean;
  expectedInputs: string[];
  expectedOutputs: string[];
  isRequired: boolean;
  passLabels: string[];
  priority: number;
  strategyKey: K;
  summary: string;
  title: string;
};

export type AnySearchStrategyBundleSelection =
  | SearchStrategyBundleSelection<"alternate_return_city_exploration">
  | SearchStrategyBundleSelection<"adaptive_coverage_market_scan">
  | SearchStrategyBundleSelection<"anchored_multi_city_search">
  | SearchStrategyBundleSelection<"price_first_market_scan">
  | SearchStrategyBundleSelection<"multi_city_verification">
  | SearchStrategyBundleSelection<"recommendation_date_coverage">
  | SearchStrategyBundleSelection<"stitched_value_probe">;

type StrategyBundleDefinition<K extends SearchStrategyBundleKey> = {
  buildPlans: (session: SessionRecord, config: SearchStrategyBundleConfigByKey[K]) => StrategyPlan[];
  defaultEnabled: (session: SessionRecord) => boolean;
  defaultPriority: number;
  description: string;
  expectedInputs: string[];
  expectedOutputs: string[];
  getCompatibility: (
    session: SessionRecord,
    config: SearchStrategyBundleConfigByKey[K]
  ) => StrategyBundleCompatibility;
  getDefaultConfig: (session: SessionRecord) => SearchStrategyBundleConfigByKey[K];
  isRequired: boolean;
  key: K;
  passLabels: string[];
  summary: string;
  title: string;
};

function clampInteger(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function clampNumber(value: unknown, minimum: number, maximum: number, precision = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const bounded = Math.min(maximum, Math.max(minimum, value));
  return Number(bounded.toFixed(precision));
}

function parseObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function isSearchStrategyBundleKey(value: string): value is SearchStrategyBundleKey {
  return (
    value === "alternate_return_city_exploration" ||
    value === "adaptive_coverage_market_scan" ||
    value === "anchored_multi_city_search" ||
    value === "price_first_market_scan" ||
    value === "multi_city_verification" ||
    value === "recommendation_date_coverage" ||
    value === "stitched_value_probe"
  );
}

export function getSearchIntensityDefaults(
  searchIntensity: SessionRecord["searchIntensity"]
): SearchIntensityDefaults {
  return searchIntensity === "low"
    ? {
        alternateReturnCandidateCityLimit: 1,
        alternateReturnDatePairLimit: 2,
        anchoredMultiCityCandidateReviewLimit: 6,
        anchoredMultiCityDateVariationLimit: 2,
        anchoredMultiCityFollowupCityLimit: 1,
        anchoredMultiCitySeedContextsPerCityLimit: 1,
        anchoredMultiCitySegmentOptionLimit: 1,
        anchorDepartureDateLimit: 1,
        anchoredReturnSweepLimit: 2,
        baselineReturnOptionExpansionTargetLimit: 3,
        baselineReturnOptionExpansionVariationLimit: 2,
        directSweepLimit: 3,
        multiCityCandidateReviewLimit: 6,
        multiCityFollowupCityLimit: 1,
        multiCityLongStopFollowupCityLimit: 1,
        multiCityLongStopValidationMinHours: 12,
        multiCitySeedContextsPerCityLimit: 1,
        maxOutboundOptionsPerQuery: 2,
        maxReturnOptionsPerOutbound: 2,
        recommendationDateCoverageCandidateReviewLimit: 8,
        recommendationDateCoverageDateVariationLimit: 2,
        recommendationDateCoverageRouteTargetLimit: 2
      }
    : searchIntensity === "balanced"
      ? {
          alternateReturnCandidateCityLimit: 2,
          alternateReturnDatePairLimit: 3,
          anchoredMultiCityCandidateReviewLimit: 10,
          anchoredMultiCityDateVariationLimit: 3,
          anchoredMultiCityFollowupCityLimit: 2,
          anchoredMultiCitySeedContextsPerCityLimit: 1,
          anchoredMultiCitySegmentOptionLimit: 2,
          anchorDepartureDateLimit: 2,
          anchoredReturnSweepLimit: 3,
          baselineReturnOptionExpansionTargetLimit: 5,
          baselineReturnOptionExpansionVariationLimit: 3,
          directSweepLimit: 5,
          multiCityCandidateReviewLimit: 10,
          multiCityFollowupCityLimit: 2,
          multiCityLongStopFollowupCityLimit: 1,
          multiCityLongStopValidationMinHours: 18,
          multiCitySeedContextsPerCityLimit: 2,
          maxOutboundOptionsPerQuery: 3,
          maxReturnOptionsPerOutbound: 3,
          recommendationDateCoverageCandidateReviewLimit: 12,
          recommendationDateCoverageDateVariationLimit: 3,
          recommendationDateCoverageRouteTargetLimit: 3
        }
      : {
          alternateReturnCandidateCityLimit: 3,
          alternateReturnDatePairLimit: 4,
          anchoredMultiCityCandidateReviewLimit: 12,
          anchoredMultiCityDateVariationLimit: 5,
          anchoredMultiCityFollowupCityLimit: 3,
          anchoredMultiCitySeedContextsPerCityLimit: 2,
          anchoredMultiCitySegmentOptionLimit: 2,
          anchorDepartureDateLimit: 3,
          anchoredReturnSweepLimit: 4,
          baselineReturnOptionExpansionTargetLimit: 7,
          baselineReturnOptionExpansionVariationLimit: 4,
          directSweepLimit: 7,
          multiCityCandidateReviewLimit: 12,
          multiCityFollowupCityLimit: 3,
          multiCityLongStopFollowupCityLimit: 2,
          multiCityLongStopValidationMinHours: 24,
          multiCitySeedContextsPerCityLimit: 2,
          maxOutboundOptionsPerQuery: 4,
          maxReturnOptionsPerOutbound: 4,
          recommendationDateCoverageCandidateReviewLimit: 16,
          recommendationDateCoverageDateVariationLimit: 4,
          recommendationDateCoverageRouteTargetLimit: 4
        };
}

export function normalizeStrategyBundleConfig<K extends SearchStrategyBundleKey>(
  strategyKey: K,
  rawConfig: unknown,
  session: SessionRecord
): SearchStrategyBundleConfigByKey[K] {
  const source = parseObject(rawConfig);

  if (strategyKey === "price_first_market_scan") {
    return {
      anchoredReturnSweepLimitOverride: clampInteger(
        source.anchoredReturnSweepLimitOverride,
        1,
        8
      ),
      anchorDepartureDateLimitOverride: clampInteger(source.anchorDepartureDateLimitOverride, 1, 6),
      directSweepLimitOverride: clampInteger(source.directSweepLimitOverride, 1, 12),
      enableReturnOptionExpansion:
        typeof source.enableReturnOptionExpansion === "boolean"
          ? source.enableReturnOptionExpansion
          : false,
      enableAnchoredDateFollowup:
        typeof source.enableAnchoredDateFollowup === "boolean"
          ? source.enableAnchoredDateFollowup
          : true,
      maxOutboundOptionsPerQueryOverride: clampInteger(
        source.maxOutboundOptionsPerQueryOverride,
        1,
        6
      ),
      maxReturnOptionsPerOutboundOverride: clampInteger(
        source.maxReturnOptionsPerOutboundOverride,
        1,
        6
      ),
      returnOptionExpansionTargetLimitOverride: clampInteger(
        source.returnOptionExpansionTargetLimitOverride,
        1,
        12
      ),
      returnOptionExpansionVariationLimitOverride: clampInteger(
        source.returnOptionExpansionVariationLimitOverride,
        1,
        6
      ),
      samplingModeOverride: isDateSamplingMode(source.samplingModeOverride)
        ? source.samplingModeOverride
        : null
    } as SearchStrategyBundleConfigByKey[K];
  }

  if (strategyKey === "adaptive_coverage_market_scan") {
    return {
      anchoredReturnSweepLimitOverride: clampInteger(
        source.anchoredReturnSweepLimitOverride,
        1,
        8
      ),
      anchorDepartureDateLimitOverride: clampInteger(source.anchorDepartureDateLimitOverride, 1, 6),
      directSweepLimitOverride: clampInteger(source.directSweepLimitOverride, 1, 12),
      enableReturnOptionExpansion:
        typeof source.enableReturnOptionExpansion === "boolean"
          ? source.enableReturnOptionExpansion
          : false,
      enableAnchoredDateFollowup:
        typeof source.enableAnchoredDateFollowup === "boolean"
          ? source.enableAnchoredDateFollowup
          : true,
      initialSeedSweepLimitOverride: clampInteger(source.initialSeedSweepLimitOverride, 1, 8),
      maxOutboundOptionsPerQueryOverride: clampInteger(
        source.maxOutboundOptionsPerQueryOverride,
        1,
        6
      ),
      maxReturnOptionsPerOutboundOverride: clampInteger(
        source.maxReturnOptionsPerOutboundOverride,
        1,
        6
      ),
      returnOptionExpansionTargetLimitOverride: clampInteger(
        source.returnOptionExpansionTargetLimitOverride,
        1,
        12
      ),
      returnOptionExpansionVariationLimitOverride: clampInteger(
        source.returnOptionExpansionVariationLimitOverride,
        1,
        6
      ),
      samplingModeOverride: null
    } as SearchStrategyBundleConfigByKey[K];
  }

  if (strategyKey === "multi_city_verification") {
    return {
      candidateReviewLimitOverride: clampInteger(source.candidateReviewLimitOverride, 3, 20),
      followupCityLimitOverride:
        session.maxStops > 0 ? clampInteger(source.followupCityLimitOverride, 1, 6) : null,
      longStopFollowupCityLimitOverride:
        session.maxStops > 0 ? clampInteger(source.longStopFollowupCityLimitOverride, 1, 4) : null,
      longStopValidationMinHoursOverride: clampInteger(
        source.longStopValidationMinHoursOverride,
        6,
        72
      ),
      seedContextsPerCityLimitOverride:
        session.maxStops > 0 ? clampInteger(source.seedContextsPerCityLimitOverride, 1, 3) : null
    } as SearchStrategyBundleConfigByKey[K];
  }

  if (strategyKey === "alternate_return_city_exploration") {
    return {
      candidateCityLimitOverride: clampInteger(source.candidateCityLimitOverride, 1, 6),
      datePairLimitOverride: clampInteger(source.datePairLimitOverride, 1, 6)
    } as SearchStrategyBundleConfigByKey[K];
  }

  if (strategyKey === "anchored_multi_city_search") {
    return {
      candidateReviewLimitOverride: clampInteger(source.candidateReviewLimitOverride, 3, 20),
      dateVariationLimitOverride:
        session.maxStops > 0 ? clampInteger(source.dateVariationLimitOverride, 1, 8) : null,
      followupCityLimitOverride:
        session.maxStops > 0 ? clampInteger(source.followupCityLimitOverride, 1, 6) : null,
      seedContextsPerCityLimitOverride:
        session.maxStops > 0 ? clampInteger(source.seedContextsPerCityLimitOverride, 1, 3) : null,
      segmentOptionLimitOverride:
        session.maxStops > 0 ? clampInteger(source.segmentOptionLimitOverride, 1, 4) : null
    } as SearchStrategyBundleConfigByKey[K];
  }

  if (strategyKey === "recommendation_date_coverage") {
    return {
      candidateReviewLimitOverride: clampInteger(source.candidateReviewLimitOverride, 4, 30),
      dateVariationLimitOverride: clampInteger(source.dateVariationLimitOverride, 1, 6),
      routeTargetLimitOverride: clampInteger(source.routeTargetLimitOverride, 1, 8)
    } as SearchStrategyBundleConfigByKey[K];
  }

  return {
    discountRateOverride: clampNumber(source.discountRateOverride, 0.75, 1, 2),
    maxDerivedCandidatesOverride: clampInteger(source.maxDerivedCandidatesOverride, 1, 4)
  } as SearchStrategyBundleConfigByKey[K];
}

export function resolveAlternateReturnCityExecutionConfig(
  session: Pick<SessionRecord, "returnOriginMode" | "searchIntensity">,
  config: AlternateReturnCityExplorationConfig
) {
  const defaults = getSearchIntensityDefaults(session.searchIntensity);

  return {
    candidateCityLimit:
      session.returnOriginMode === "any_mainland_city"
        ? config.candidateCityLimitOverride ?? defaults.alternateReturnCandidateCityLimit
        : 0,
    datePairLimit: config.datePairLimitOverride ?? defaults.alternateReturnDatePairLimit,
    maxOutboundOptionsPerQuery: defaults.maxOutboundOptionsPerQuery,
    maxReturnOptionsPerOutbound: defaults.maxReturnOptionsPerOutbound
  };
}

export function resolveAnchoredMultiCitySearchExecutionConfig(
  session: Pick<SessionRecord, "maxStops" | "searchIntensity">,
  config: AnchoredMultiCitySearchConfig
) {
  const defaults = getSearchIntensityDefaults(session.searchIntensity);

  return {
    candidateReviewLimit:
      config.candidateReviewLimitOverride ?? defaults.anchoredMultiCityCandidateReviewLimit,
    dateVariationLimit:
      session.maxStops > 0
        ? config.dateVariationLimitOverride ?? defaults.anchoredMultiCityDateVariationLimit
        : 0,
    followupCityLimit:
      session.maxStops > 0
        ? config.followupCityLimitOverride ?? defaults.anchoredMultiCityFollowupCityLimit
        : 0,
    seedContextsPerCityLimit:
      session.maxStops > 0
        ? config.seedContextsPerCityLimitOverride ??
          defaults.anchoredMultiCitySeedContextsPerCityLimit
        : 0,
    segmentOptionLimit:
      session.maxStops > 0
        ? config.segmentOptionLimitOverride ?? defaults.anchoredMultiCitySegmentOptionLimit
        : 0
  };
}

export function resolveMarketScanExecutionConfig(
  session: Pick<SessionRecord, "searchIntensity">,
  config: MarketScanBundleConfig
) {
  const defaults = getSearchIntensityDefaults(session.searchIntensity);
  const anchoredReturnSweepLimit =
    config.anchoredReturnSweepLimitOverride ?? defaults.anchoredReturnSweepLimit;
  const anchorDepartureDateLimit =
    config.anchorDepartureDateLimitOverride ?? defaults.anchorDepartureDateLimit;
  const directSweepLimit = config.directSweepLimitOverride ?? defaults.directSweepLimit;
  // A date-sampling arm gets as many searches as the baseline's sweep plus its
  // anchored follow-up, and spends them all on its own date plan.
  const samplingModeOverride = config.samplingModeOverride ?? null;
  const followupSearches = config.enableAnchoredDateFollowup
    ? anchorDepartureDateLimit * anchoredReturnSweepLimit
    : 0;

  return {
    anchoredReturnSweepLimit,
    anchorDepartureDateLimit,
    baselineReturnOptionExpansionTargetLimit:
      config.returnOptionExpansionTargetLimitOverride ??
      defaults.baselineReturnOptionExpansionTargetLimit,
    baselineReturnOptionExpansionVariationLimit:
      config.returnOptionExpansionVariationLimitOverride ??
      defaults.baselineReturnOptionExpansionVariationLimit,
    directSweepLimit: samplingModeOverride ? directSweepLimit + followupSearches : directSweepLimit,
    enableReturnOptionExpansion: config.enableReturnOptionExpansion,
    enableAnchoredDateFollowup: samplingModeOverride ? false : config.enableAnchoredDateFollowup,
    maxOutboundOptionsPerQuery:
      config.maxOutboundOptionsPerQueryOverride ?? defaults.maxOutboundOptionsPerQuery,
    maxReturnOptionsPerOutbound:
      config.maxReturnOptionsPerOutboundOverride ?? defaults.maxReturnOptionsPerOutbound,
    samplingMode: samplingModeOverride ?? ("even_coverage" as const)
  };
}

export function resolveAdaptiveCoverageExecutionConfig(
  session: Pick<SessionRecord, "searchIntensity">,
  config: AdaptiveCoverageMarketScanConfig
) {
  const resolved = resolveMarketScanExecutionConfig(session, config);

  return {
    ...resolved,
    initialSeedSweepLimit:
      config.initialSeedSweepLimitOverride ??
      Math.max(2, Math.min(resolved.directSweepLimit, Math.ceil(resolved.directSweepLimit / 2)))
  };
}

export function resolveMultiCityVerificationExecutionConfig(
  session: Pick<SessionRecord, "maxStops" | "searchIntensity">,
  config: MultiCityVerificationConfig
) {
  const defaults = getSearchIntensityDefaults(session.searchIntensity);

  return {
    candidateReviewLimit:
      config.candidateReviewLimitOverride ?? defaults.multiCityCandidateReviewLimit,
    followupCityLimit:
      session.maxStops > 0
        ? config.followupCityLimitOverride ?? defaults.multiCityFollowupCityLimit
        : 0,
    longStopFollowupCityLimit:
      session.maxStops > 0
        ? config.longStopFollowupCityLimitOverride ?? defaults.multiCityLongStopFollowupCityLimit
        : 0,
    longStopValidationMinHours:
      config.longStopValidationMinHoursOverride ?? defaults.multiCityLongStopValidationMinHours,
    seedContextsPerCityLimit:
      session.maxStops > 0
        ? config.seedContextsPerCityLimitOverride ?? defaults.multiCitySeedContextsPerCityLimit
        : 0,
    maxOutboundOptionsPerQuery: defaults.maxOutboundOptionsPerQuery,
    maxReturnOptionsPerOutbound: defaults.maxReturnOptionsPerOutbound
  };
}

export function resolveRecommendationDateCoverageExecutionConfig(
  session: Pick<SessionRecord, "searchIntensity">,
  config: RecommendationDateCoverageConfig
) {
  const defaults = getSearchIntensityDefaults(session.searchIntensity);

  return {
    candidateReviewLimit:
      config.candidateReviewLimitOverride ??
      defaults.recommendationDateCoverageCandidateReviewLimit,
    dateVariationLimit:
      config.dateVariationLimitOverride ?? defaults.recommendationDateCoverageDateVariationLimit,
    routeTargetLimit:
      config.routeTargetLimitOverride ?? defaults.recommendationDateCoverageRouteTargetLimit
  };
}

export function resolveStitchedValueProbeExecutionConfig(config: StitchedValueProbeConfig) {
  return {
    discountRate: config.discountRateOverride ?? 0.9,
    maxDerivedCandidates: config.maxDerivedCandidatesOverride ?? 2
  };
}

const priceFirstMarketScanDefinition: StrategyBundleDefinition<"price_first_market_scan"> = {
  buildPlans: (session, config) => {
    const resolved = resolveMarketScanExecutionConfig(session, config);
    const plans: StrategyPlan[] = [
      {
        estimatedSearchCost: resolved.directSweepLimit,
        reason:
          resolved.samplingMode === "even_coverage"
            ? "Sweep round-trip date pairs across the allowed window before any later strategy cluster builds on those results."
            : `Experiment arm: choose round-trip date pairs with the "${DATE_STRATEGY_TEST_ARMS.find((arm) => arm.samplingMode === resolved.samplingMode)?.title}" date plan, spending the baseline's sweep and anchored follow-up budget on it.`,
        strategyPayload: {
          directSweepLimit: resolved.directSweepLimit,
          engine: "tripcom_live",
          maxCandidatesPerQuery: 3,
          maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
          maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
          samplingMode: resolved.samplingMode,
          sessionId: session.id,
          type: "packaged_direct_sweep"
        },
        strategyType: "packaged_direct_sweep"
      },
      {
        estimatedSearchCost: 0,
        reason:
          "Analyse the completed baseline queries so later strategy clusters can inherit departure-date, airline, and stopover clues from the baseline.",
        strategyPayload: {
          anchorDepartureDateLimit: resolved.anchorDepartureDateLimit,
          analysisType: "pass1_market_scan",
          anchoredReturnSweepLimit: resolved.anchoredReturnSweepLimit,
          engine: "local_analysis",
          type: "pass1_analysis"
        },
        strategyType: "pass1_analysis"
      }
    ];

    if (resolved.enableReturnOptionExpansion) {
      plans.splice(1, 0, {
        estimatedSearchCost: resolved.baselineReturnOptionExpansionTargetLimit,
        reason:
          "Open a bounded set of cheap round-trip winners to inspect deeper return options, prioritising family coverage so repeated cheap variants do not crowd out other candidate families.",
        strategyPayload: {
          candidateTargetLimit: resolved.baselineReturnOptionExpansionTargetLimit,
          engine: "tripcom_live",
          expansionVariationLimit: resolved.baselineReturnOptionExpansionVariationLimit,
          type: "packaged_return_option_expansion"
        },
        strategyType: "packaged_return_option_expansion"
      });
    }

    if (resolved.enableAnchoredDateFollowup) {
      plans.push({
        estimatedSearchCost: resolved.anchorDepartureDateLimit * resolved.anchoredReturnSweepLimit,
        reason:
          "Use the strongest baseline departure-date patterns to anchor additional return-date probes before handing results to later strategy clusters.",
        strategyPayload: {
          anchorDepartureDateLimit: resolved.anchorDepartureDateLimit,
          anchoredReturnSweepLimit: resolved.anchoredReturnSweepLimit,
          engine: "tripcom_live",
          maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
          maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
          type: "packaged_departure_anchor_followup"
        },
        strategyType: "packaged_departure_anchor_followup"
      });
    }

    return plans;
  },
  defaultEnabled: () => true,
  defaultPriority: 0,
  description:
    "The required round-trip packaged-fare baseline. It establishes the first market picture, can open a bounded set of cheap winners to inspect deeper return options and stopover clues, then optionally deepens the search around the strongest departure-date signals before any later strategy cluster runs.",
  expectedInputs: ["None. This strategy starts the run."],
  expectedOutputs: [
    "Round-trip packaged fare candidates",
    "Cheapest departure-date trends",
    "Airline price trends",
    "Recurring stopover-city clues from expanded return options",
    "A shortlist of strong departure anchors"
  ],
  getCompatibility: () => ({
    isCompatible: true,
    reason: null
  }),
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("price_first_market_scan", {}, session),
  isRequired: false,
  key: "price_first_market_scan",
  passLabels: [
    "Direct sweep",
    "Return option expansion",
    "Pass 1 analysis",
    "Anchored departure follow-up"
  ],
  summary: "Required baseline strategy that establishes the round-trip market before other strategies branch out.",
  title: "Round trip baseline"
};

const adaptiveCoverageMarketScanDefinition: StrategyBundleDefinition<"adaptive_coverage_market_scan"> = {
  buildPlans: (session, config) => {
    const resolved = resolveAdaptiveCoverageExecutionConfig(session, config);
    const plans: StrategyPlan[] = [
      {
        estimatedSearchCost: resolved.directSweepLimit,
        reason:
          "Run an adaptive coverage baseline: start with a seed sweep across the full date window, then spend the remaining direct-sweep budget on date pairs chosen from current-run rewards, coverage gaps, and weak historical session priors.",
        strategyPayload: {
          directSweepLimit: resolved.directSweepLimit,
          engine: "tripcom_live",
          initialSeedSweepLimit: resolved.initialSeedSweepLimit,
          maxCandidatesPerQuery: 3,
          maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
          maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
          samplingMode: "adaptive_coverage",
          sessionId: session.id,
          type: "packaged_direct_sweep"
        },
        strategyType: "packaged_direct_sweep"
      },
      {
        estimatedSearchCost: 0,
        reason:
          "Analyse the adaptive baseline queries so later strategy clusters can inherit departure-date, airline, and stopover clues from the baseline.",
        strategyPayload: {
          anchorDepartureDateLimit: resolved.anchorDepartureDateLimit,
          analysisType: "pass1_market_scan",
          anchoredReturnSweepLimit: resolved.anchoredReturnSweepLimit,
          engine: "local_analysis",
          type: "pass1_analysis"
        },
        strategyType: "pass1_analysis"
      }
    ];

    if (resolved.enableReturnOptionExpansion) {
      plans.splice(1, 0, {
        estimatedSearchCost: resolved.baselineReturnOptionExpansionTargetLimit,
        reason:
          "Open a bounded set of cheap adaptive-baseline winners to inspect deeper return options, still prioritising family coverage so repeated cheap variants do not crowd out other candidate families.",
        strategyPayload: {
          candidateTargetLimit: resolved.baselineReturnOptionExpansionTargetLimit,
          engine: "tripcom_live",
          expansionVariationLimit: resolved.baselineReturnOptionExpansionVariationLimit,
          type: "packaged_return_option_expansion"
        },
        strategyType: "packaged_return_option_expansion"
      });
    }

    if (resolved.enableAnchoredDateFollowup) {
      plans.push({
        estimatedSearchCost: resolved.anchorDepartureDateLimit * resolved.anchoredReturnSweepLimit,
        reason:
          "Use the strongest adaptive-baseline departure-date patterns to anchor additional return-date probes before handing results to later strategy clusters.",
        strategyPayload: {
          anchorDepartureDateLimit: resolved.anchorDepartureDateLimit,
          anchoredReturnSweepLimit: resolved.anchoredReturnSweepLimit,
          engine: "tripcom_live",
          maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
          maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
          type: "packaged_departure_anchor_followup"
        },
        strategyType: "packaged_departure_anchor_followup"
      });
    }

    return plans;
  },
  defaultEnabled: () => false,
  defaultPriority: 0,
  description:
    "An experimental alternative baseline that keeps broad date coverage, but after an initial seed sweep it stops following a fixed pair list and reallocates the remaining direct-sweep budget using current-run rewards, undercovered date buckets, and weak historical priors from prior runs in the same session.",
  expectedInputs: ["Previous completed runs from the same session are used as weak priors when available."],
  expectedOutputs: [
    "Round-trip packaged fare candidates",
    "Earlier coverage of diverse candidate families",
    "A non-linear direct-sweep path shaped by current-run rewards",
    "The same downstream pass-1, stopover, and anchor artifacts as the default baseline"
  ],
  getCompatibility: () => ({
    isCompatible: true,
    reason: null
  }),
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("adaptive_coverage_market_scan", {}, session),
  isRequired: false,
  key: "adaptive_coverage_market_scan",
  passLabels: [
    "Adaptive direct sweep",
    "Return option expansion",
    "Pass 1 analysis",
    "Anchored departure follow-up"
  ],
  summary:
    "Experimental baseline that keeps date coverage broad, then reallocates the remaining direct-sweep budget adaptively instead of following a fixed pair order.",
  title: "Adaptive coverage baseline"
};

const multiCityVerificationDefinition: StrategyBundleDefinition<"multi_city_verification"> = {
  buildPlans: (session, config) => {
    const resolved = resolveMultiCityVerificationExecutionConfig(session, config);

    if (resolved.followupCityLimit <= 0) {
      return [];
    }

      return [
        {
          estimatedSearchCost: resolved.followupCityLimit * resolved.seedContextsPerCityLimit,
          reason:
            "Use the baseline handoff to test the strongest city-specific seed contexts, then verify whether those stopover cities still produce cheap multi-city-style results.",
          strategyPayload: {
            candidateReviewLimit: resolved.candidateReviewLimit,
            engine: "tripcom_live",
            followupCityLimit: resolved.followupCityLimit,
            maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
            maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
            seedContextsPerCityLimit: resolved.seedContextsPerCityLimit,
            type: "packaged_stopover_followup"
          },
          strategyType: "packaged_stopover_followup"
      },
      {
        estimatedSearchCost: 0,
        reason:
          "Validate whether the verified multi-city candidates show stop durations that justify a deeper long-stop follow-up.",
        strategyPayload: {
          engine: "local_analysis",
          minimumLongStopHours: resolved.longStopValidationMinHours,
          type: "multi_city_long_stop_validation"
        },
        strategyType: "multi_city_long_stop_validation"
      },
      {
        estimatedSearchCost: resolved.longStopFollowupCityLimit,
        reason:
          "Take the strongest validated stopover cities and rerun the stopover filter with a minimum stop duration so the cluster can surface genuine longer-stop candidates.",
        strategyPayload: {
          engine: "tripcom_live",
          followupCityLimit: resolved.longStopFollowupCityLimit,
          maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
          maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
          minimumLongStopHours: resolved.longStopValidationMinHours,
          type: "multi_city_long_stop_followup"
        },
        strategyType: "multi_city_long_stop_followup"
      }
    ];
  },
  defaultEnabled: () => false,
  defaultPriority: 1,
  description:
    "Optional cluster focused on multi-city-style verification. It runs after the round-trip baseline, reuses the baseline handoff families and city-entry clues, and checks whether the strongest contexts still produce cheap trips that preserve the same departure and arrival cities while exposing the layover city.",
  expectedInputs: [
    "Baseline follow-up candidate families",
    "Cheapest city-entry clues from the baseline",
    "Baseline departure-date, return-date, and airline trends"
  ],
  expectedOutputs: [
    "A ranked stopover-city evidence board",
    "Verified multi-city probes from the strongest baseline seed contexts",
    "The cheapest multi-city trip found so far",
    "The cheapest multi-city trip per stopover city",
    "A clearer signal on whether a dedicated longer-stop strategy is justified",
    "Longer-stop round-trip candidates for the most promising cities"
  ],
  getCompatibility: (session) =>
    session.maxStops > 0
      ? { isCompatible: true, reason: null }
      : {
          isCompatible: false,
          reason: "This strategy requires the session to allow at least one stop."
        },
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("multi_city_verification", {}, session),
  isRequired: false,
  key: "multi_city_verification",
  passLabels: ["Stopover city verification", "Long-stop validation", "Long-stop follow-up"],
  summary: "Optional follow-on strategy that verifies stopover cities after the round-trip baseline.",
  title: "Multi-city verification"
};

const anchoredMultiCitySearchDefinition: StrategyBundleDefinition<"anchored_multi_city_search"> = {
  buildPlans: (session, config) => {
    const resolved = resolveAnchoredMultiCitySearchExecutionConfig(session, config);

    if (resolved.followupCityLimit <= 0 || resolved.dateVariationLimit <= 0) {
      return [];
    }

    return [
      {
        estimatedSearchCost:
          resolved.followupCityLimit *
          resolved.seedContextsPerCityLimit *
          resolved.dateVariationLimit,
        reason:
          "Take the strongest baseline family-city contexts, anchor the round-trip departure and return dates, then run Trip.com's true multi-city flow against bounded stop-duration date variations to find the cheapest real intentional-stop itinerary.",
        strategyPayload: {
          candidateReviewLimit: resolved.candidateReviewLimit,
          dateVariationLimit: resolved.dateVariationLimit,
          engine: "tripcom_live",
          followupCityLimit: resolved.followupCityLimit,
          seedContextsPerCityLimit: resolved.seedContextsPerCityLimit,
          segmentOptionLimit: resolved.segmentOptionLimit,
          type: "anchored_multi_city_probe"
        },
        strategyType: "anchored_multi_city_probe"
      }
    ];
  },
  defaultEnabled: () => false,
  defaultPriority: 2,
  description:
    "Optional true multi-city cluster that converts the strongest baseline stopover clues into bounded Trip.com multi-city searches. It keeps the same origin, destination, and baseline date anchors, then varies the stopover dates inside the session stop window to surface the cheapest real intentional-stop itinerary.",
  expectedInputs: [
    "Baseline follow-up candidate families",
    "Baseline stopover-city clues",
    "Baseline departure-date and return-date anchors"
  ],
  expectedOutputs: [
    "The cheapest true multi-city trip found so far",
    "The cheapest true multi-city trip per stopover city",
    "Bounded date-combination evidence for each converted baseline context"
  ],
  getCompatibility: (session) =>
    session.maxStops > 0
      ? { isCompatible: true, reason: null }
      : {
          isCompatible: false,
          reason: "This strategy requires the session to allow at least one stop."
        },
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("anchored_multi_city_search", {}, session),
  isRequired: false,
  key: "anchored_multi_city_search",
  passLabels: ["Anchored multi-city search"],
  summary:
    "Optional true multi-city strategy that converts the strongest baseline clues into real three-leg Trip.com searches.",
  title: "Anchored multi-city search"
};

const alternateReturnCityExplorationDefinition: StrategyBundleDefinition<"alternate_return_city_exploration"> =
  {
    buildPlans: (session, config) => {
      const resolved = resolveAlternateReturnCityExecutionConfig(session, config);

      if (resolved.candidateCityLimit <= 0) {
        return [];
      }

      return [
        {
          estimatedSearchCost: resolved.candidateCityLimit * resolved.datePairLimit,
          reason:
            "Use baseline and multi-city evidence to compare a small set of alternate mainland cities with bounded round-trip probes before a true return-origin adapter exists.",
          strategyPayload: {
            candidateCityLimit: resolved.candidateCityLimit,
            datePairLimit: resolved.datePairLimit,
            engine: "tripcom_live",
            maxOutboundOptionsPerQuery: resolved.maxOutboundOptionsPerQuery,
            maxReturnOptionsPerOutbound: resolved.maxReturnOptionsPerOutbound,
            type: "alternate_return_city_probe"
          },
          strategyType: "alternate_return_city_probe"
        },
        {
          estimatedSearchCost: 0,
          reason:
            "Summarise which alternate mainland cities compared best so later strategy work can decide whether a true return-origin or open-jaw adapter is justified.",
          strategyPayload: {
            analysisType: "alternate_return_city_summary",
            candidateCityLimit: resolved.candidateCityLimit,
            datePairLimit: resolved.datePairLimit,
            engine: "local_analysis",
            type: "alternate_return_city_summary"
          },
          strategyType: "alternate_return_city_summary"
        }
      ];
    },
    defaultEnabled: (session) => session.returnOriginMode === "any_mainland_city",
    defaultPriority: 2,
    description:
      "Optional comparison cluster for sessions that allow any mainland return-origin city. It does not run a true open-jaw search yet. Instead, it probes alternate mainland cities as bounded round-trip comparisons so FlyEasy can learn which cities deserve deeper return-origin work next.",
    expectedInputs: [
      "Baseline stopover-city findings",
      "Baseline departure-date anchors",
      "Any multi-city evidence already collected"
    ],
    expectedOutputs: [
      "A shortlist of alternate mainland cities worth comparing",
      "Bounded round-trip comparison results for those cities",
      "A comparison board showing which alternate cities look strongest"
    ],
    getCompatibility: (session) =>
      session.returnOriginMode === "any_mainland_city"
        ? { isCompatible: true, reason: null }
        : {
            isCompatible: false,
            reason: "This strategy requires the session to allow any mainland city as a return origin."
          },
    getDefaultConfig: (session) =>
      normalizeStrategyBundleConfig("alternate_return_city_exploration", {}, session),
    isRequired: false,
    key: "alternate_return_city_exploration",
    passLabels: ["Alternate city comparison", "Comparison summary"],
    summary:
      "Optional comparison strategy that probes alternate mainland cities when the session allows flexible return-origin planning.",
    title: "Alternate return-city exploration"
  };

const recommendationDateCoverageDefinition: StrategyBundleDefinition<"recommendation_date_coverage"> = {
  buildPlans: (session, config) => {
    const resolved = resolveRecommendationDateCoverageExecutionConfig(session, config);

    if (
      resolved.candidateReviewLimit <= 0 ||
      resolved.routeTargetLimit <= 0 ||
      resolved.dateVariationLimit <= 0
    ) {
      return [];
    }

    return [
      {
        estimatedSearchCost: resolved.routeTargetLimit * resolved.dateVariationLimit,
        reason:
          "After the earlier route-finding clusters finish, spend a small bounded budget filling nearby date flexibility for the strongest recommendation routes so Overview cards and endpoint pickers have more usable variants.",
        strategyPayload: {
          candidateReviewLimit: resolved.candidateReviewLimit,
          dateVariationLimit: resolved.dateVariationLimit,
          engine: "tripcom_live",
          routeTargetLimit: resolved.routeTargetLimit,
          type: "recommendation_date_coverage_probe"
        },
        strategyType: "recommendation_date_coverage_probe"
      }
    ];
  },
  defaultEnabled: () => false,
  defaultPriority: 3,
  description:
    "Optional densification cluster that runs after earlier discovery and comparison strategies. Instead of finding new route ideas, it spends a small bounded budget filling nearby date variants for the strongest recommendation families so the interactive date pickers have better local coverage.",
  expectedInputs: [
    "Promising route families from earlier packaged and multi-city strategies",
    "Current depart, return, and stopover date anchors from those families",
    "The cheapest route ideas that Overview is likely to surface"
  ],
  expectedOutputs: [
    "Additional nearby round-trip date variants for strong recommendation routes",
    "Additional anchored multi-city stopover-date variants when those routes already exist",
    "Better local date flexibility for the recommendation-card endpoint popups"
  ],
  getCompatibility: () => ({
    isCompatible: true,
    reason: null
  }),
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("recommendation_date_coverage", {}, session),
  isRequired: false,
  key: "recommendation_date_coverage",
  passLabels: ["Recommendation date coverage"],
  summary:
    "Optional late-stage densification that improves local date flexibility for the strongest recommendation routes.",
  title: "Recommendation date coverage"
};

const stitchedValueProbeDefinition: StrategyBundleDefinition<"stitched_value_probe"> = {
  buildPlans: (_session, config) => {
    const resolved = resolveStitchedValueProbeExecutionConfig(config);
    return [
      {
        estimatedSearchCost: 0,
        reason:
          "Derive stitched-booking comparison candidates after the baseline and any enabled follow-on strategy clusters have established the packaged picture.",
        strategyPayload: {
          discountRate: resolved.discountRate,
          engine: "derived_expansion",
          maxDerivedCandidates: resolved.maxDerivedCandidates,
          type: "stitched_followup"
        },
        strategyType: "stitched_followup"
      }
    ];
  },
  defaultEnabled: (session) => session.bookingMode === "stitched" || session.bookingMode === "both",
  defaultPriority: 4,
  description:
    "Optional stitched-style comparison that runs after the packaged baseline and any earlier verification strategies. Today it is still a bounded synthetic estimate, not a live stitched search.",
  expectedInputs: ["Packaged winners from earlier strategies"],
  expectedOutputs: ["Synthetic stitched comparisons for ranking and comparison"],
  getCompatibility: (session) =>
    session.bookingMode === "stitched" || session.bookingMode === "both"
      ? { isCompatible: true, reason: null }
      : {
          isCompatible: false,
          reason: "This strategy requires the session booking mode to allow stitched results."
        },
  getDefaultConfig: (session) =>
    normalizeStrategyBundleConfig("stitched_value_probe", {}, session),
  isRequired: false,
  key: "stitched_value_probe",
  passLabels: ["Stitched comparison follow-up"],
  summary: "Optional stitched comparison strategy that runs after earlier packaged strategies.",
  title: "Stitched value probe"
};

const strategyBundleCatalog = [
  priceFirstMarketScanDefinition,
  adaptiveCoverageMarketScanDefinition,
  multiCityVerificationDefinition,
  anchoredMultiCitySearchDefinition,
  alternateReturnCityExplorationDefinition,
  recommendationDateCoverageDefinition,
  stitchedValueProbeDefinition
] as const;

export function isAlternateReturnCityExplorationSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"alternate_return_city_exploration"> {
  return selection.strategyKey === "alternate_return_city_exploration";
}

export function isMarketScanStrategySelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"price_first_market_scan"> {
  return selection.strategyKey === "price_first_market_scan";
}

export function isAdaptiveCoverageMarketScanSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"adaptive_coverage_market_scan"> {
  return selection.strategyKey === "adaptive_coverage_market_scan";
}

export function isAnchoredMultiCitySearchSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"anchored_multi_city_search"> {
  return selection.strategyKey === "anchored_multi_city_search";
}

export function isMultiCityVerificationSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"multi_city_verification"> {
  return selection.strategyKey === "multi_city_verification";
}

export function isRecommendationDateCoverageSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"recommendation_date_coverage"> {
  return selection.strategyKey === "recommendation_date_coverage";
}

export function isStitchedValueProbeSelection(
  selection: SearchStrategyBundleSelection
): selection is SearchStrategyBundleSelection<"stitched_value_probe"> {
  return selection.strategyKey === "stitched_value_probe";
}

export function getSearchStrategyBundleDefinitions() {
  return strategyBundleCatalog;
}

export function getSearchStrategyBundleDefinition(
  strategyKey: "alternate_return_city_exploration"
): StrategyBundleDefinition<"alternate_return_city_exploration">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "adaptive_coverage_market_scan"
): StrategyBundleDefinition<"adaptive_coverage_market_scan">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "anchored_multi_city_search"
): StrategyBundleDefinition<"anchored_multi_city_search">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "price_first_market_scan"
): StrategyBundleDefinition<"price_first_market_scan">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "multi_city_verification"
): StrategyBundleDefinition<"multi_city_verification">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "recommendation_date_coverage"
): StrategyBundleDefinition<"recommendation_date_coverage">;
export function getSearchStrategyBundleDefinition(
  strategyKey: "stitched_value_probe"
): StrategyBundleDefinition<"stitched_value_probe">;
export function getSearchStrategyBundleDefinition(strategyKey: SearchStrategyBundleKey) {
  if (strategyKey === "alternate_return_city_exploration") {
    return alternateReturnCityExplorationDefinition;
  }

  if (strategyKey === "adaptive_coverage_market_scan") {
    return adaptiveCoverageMarketScanDefinition;
  }

  if (strategyKey === "anchored_multi_city_search") {
    return anchoredMultiCitySearchDefinition;
  }

  if (strategyKey === "price_first_market_scan") {
    return priceFirstMarketScanDefinition;
  }

  if (strategyKey === "multi_city_verification") {
    return multiCityVerificationDefinition;
  }

  if (strategyKey === "recommendation_date_coverage") {
    return recommendationDateCoverageDefinition;
  }

  return stitchedValueProbeDefinition;
}

export function getDefaultSearchStrategySelections(session: SessionRecord) {
  const marketScanConfig = priceFirstMarketScanDefinition.getDefaultConfig(session);
  const adaptiveCoverageConfig = adaptiveCoverageMarketScanDefinition.getDefaultConfig(session);
  const multiCityConfig = multiCityVerificationDefinition.getDefaultConfig(session);
  const anchoredMultiCityConfig = anchoredMultiCitySearchDefinition.getDefaultConfig(session);
  const alternateReturnCityConfig = alternateReturnCityExplorationDefinition.getDefaultConfig(session);
  const recommendationDateCoverageConfig = recommendationDateCoverageDefinition.getDefaultConfig(session);
  const stitchedConfig = stitchedValueProbeDefinition.getDefaultConfig(session);

  return [
    {
      compatibility: priceFirstMarketScanDefinition.getCompatibility(session, marketScanConfig),
      config: marketScanConfig,
      description: priceFirstMarketScanDefinition.description,
      enabled: true,
      expectedInputs: priceFirstMarketScanDefinition.expectedInputs,
      expectedOutputs: priceFirstMarketScanDefinition.expectedOutputs,
      isRequired: false,
      passLabels: priceFirstMarketScanDefinition.passLabels,
      priority: priceFirstMarketScanDefinition.defaultPriority,
      strategyKey: priceFirstMarketScanDefinition.key,
      summary: priceFirstMarketScanDefinition.summary,
      title: priceFirstMarketScanDefinition.title
    },
    {
      compatibility: adaptiveCoverageMarketScanDefinition.getCompatibility(
        session,
        adaptiveCoverageConfig
      ),
      config: adaptiveCoverageConfig,
      description: adaptiveCoverageMarketScanDefinition.description,
      enabled: adaptiveCoverageMarketScanDefinition.defaultEnabled(session),
      expectedInputs: adaptiveCoverageMarketScanDefinition.expectedInputs,
      expectedOutputs: adaptiveCoverageMarketScanDefinition.expectedOutputs,
      isRequired: false,
      passLabels: adaptiveCoverageMarketScanDefinition.passLabels,
      priority: adaptiveCoverageMarketScanDefinition.defaultPriority,
      strategyKey: adaptiveCoverageMarketScanDefinition.key,
      summary: adaptiveCoverageMarketScanDefinition.summary,
      title: adaptiveCoverageMarketScanDefinition.title
    },
    {
      compatibility: multiCityVerificationDefinition.getCompatibility(session, multiCityConfig),
      config: multiCityConfig,
      description: multiCityVerificationDefinition.description,
      enabled: multiCityVerificationDefinition.defaultEnabled(session),
      expectedInputs: multiCityVerificationDefinition.expectedInputs,
      expectedOutputs: multiCityVerificationDefinition.expectedOutputs,
      isRequired: false,
      passLabels: multiCityVerificationDefinition.passLabels,
      priority: multiCityVerificationDefinition.defaultPriority,
      strategyKey: multiCityVerificationDefinition.key,
      summary: multiCityVerificationDefinition.summary,
      title: multiCityVerificationDefinition.title
    },
    {
      compatibility: anchoredMultiCitySearchDefinition.getCompatibility(
        session,
        anchoredMultiCityConfig
      ),
      config: anchoredMultiCityConfig,
      description: anchoredMultiCitySearchDefinition.description,
      enabled: anchoredMultiCitySearchDefinition.defaultEnabled(session),
      expectedInputs: anchoredMultiCitySearchDefinition.expectedInputs,
      expectedOutputs: anchoredMultiCitySearchDefinition.expectedOutputs,
      isRequired: false,
      passLabels: anchoredMultiCitySearchDefinition.passLabels,
      priority: anchoredMultiCitySearchDefinition.defaultPriority,
      strategyKey: anchoredMultiCitySearchDefinition.key,
      summary: anchoredMultiCitySearchDefinition.summary,
      title: anchoredMultiCitySearchDefinition.title
    },
    {
      compatibility: alternateReturnCityExplorationDefinition.getCompatibility(
        session,
        alternateReturnCityConfig
      ),
      config: alternateReturnCityConfig,
      description: alternateReturnCityExplorationDefinition.description,
      enabled: alternateReturnCityExplorationDefinition.defaultEnabled(session),
      expectedInputs: alternateReturnCityExplorationDefinition.expectedInputs,
      expectedOutputs: alternateReturnCityExplorationDefinition.expectedOutputs,
      isRequired: false,
      passLabels: alternateReturnCityExplorationDefinition.passLabels,
      priority: alternateReturnCityExplorationDefinition.defaultPriority,
      strategyKey: alternateReturnCityExplorationDefinition.key,
      summary: alternateReturnCityExplorationDefinition.summary,
      title: alternateReturnCityExplorationDefinition.title
    },
    {
      compatibility: recommendationDateCoverageDefinition.getCompatibility(
        session,
        recommendationDateCoverageConfig
      ),
      config: recommendationDateCoverageConfig,
      description: recommendationDateCoverageDefinition.description,
      enabled: recommendationDateCoverageDefinition.defaultEnabled(session),
      expectedInputs: recommendationDateCoverageDefinition.expectedInputs,
      expectedOutputs: recommendationDateCoverageDefinition.expectedOutputs,
      isRequired: false,
      passLabels: recommendationDateCoverageDefinition.passLabels,
      priority: recommendationDateCoverageDefinition.defaultPriority,
      strategyKey: recommendationDateCoverageDefinition.key,
      summary: recommendationDateCoverageDefinition.summary,
      title: recommendationDateCoverageDefinition.title
    },
    {
      compatibility: stitchedValueProbeDefinition.getCompatibility(session, stitchedConfig),
      config: stitchedConfig,
      description: stitchedValueProbeDefinition.description,
      enabled: stitchedValueProbeDefinition.defaultEnabled(session),
      expectedInputs: stitchedValueProbeDefinition.expectedInputs,
      expectedOutputs: stitchedValueProbeDefinition.expectedOutputs,
      isRequired: false,
      passLabels: stitchedValueProbeDefinition.passLabels,
      priority: stitchedValueProbeDefinition.defaultPriority,
      strategyKey: stitchedValueProbeDefinition.key,
      summary: stitchedValueProbeDefinition.summary,
      title: stitchedValueProbeDefinition.title
    }
  ] satisfies AnySearchStrategyBundleSelection[];
}

export function buildStrategyPlansFromSelections(
  session: SessionRecord,
  selections: SearchStrategyBundleSelection[] = []
) {
  const effectiveSelections =
    selections.length > 0 ? selections : getDefaultSearchStrategySelections(session);

  return effectiveSelections
    .filter((selection) => selection.isRequired || selection.enabled)
    .filter((selection) => selection.compatibility.isCompatible)
    .sort((left, right) => left.priority - right.priority)
    .flatMap((selection) => {
      if (isAlternateReturnCityExplorationSelection(selection)) {
        return alternateReturnCityExplorationDefinition.buildPlans(session, selection.config);
      }

      if (isAdaptiveCoverageMarketScanSelection(selection)) {
        return adaptiveCoverageMarketScanDefinition.buildPlans(session, selection.config);
      }

      if (isAnchoredMultiCitySearchSelection(selection)) {
        return anchoredMultiCitySearchDefinition.buildPlans(session, selection.config);
      }

      if (isMarketScanStrategySelection(selection)) {
        return priceFirstMarketScanDefinition.buildPlans(session, selection.config);
      }

      if (isMultiCityVerificationSelection(selection)) {
        return multiCityVerificationDefinition.buildPlans(session, selection.config);
      }

      if (isRecommendationDateCoverageSelection(selection)) {
        return recommendationDateCoverageDefinition.buildPlans(session, selection.config);
      }

      if (isStitchedValueProbeSelection(selection)) {
        return stitchedValueProbeDefinition.buildPlans(session, selection.config);
      }

      return [];
    });
}
