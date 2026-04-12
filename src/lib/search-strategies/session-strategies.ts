import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/db/ids";
import { sessionStrategySelections, sessions } from "@/lib/db/schema/session";

import {
  getDefaultSearchStrategySelections,
  getSearchStrategyBundleDefinition,
  getSearchStrategyBundleDefinitions,
  isSearchStrategyBundleKey,
  normalizeStrategyBundleConfig,
  type SearchStrategyBundleKey
} from "./catalog";

type SessionRecord = typeof sessions.$inferSelect;

type StrategySelectionInput = {
  config: unknown;
  enabled: boolean;
  priority?: number;
  strategyKey: SearchStrategyBundleKey;
};

export type StrategyExperimentSettings = {
  mode: SessionRecord["strategyExperimentMode"];
  sampleSize: number;
};

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function getLastFormValue(formData: FormData, name: string) {
  const values = formData.getAll(name);
  const last = values[values.length - 1];
  return typeof last === "string" ? last : "";
}

function parseBooleanFormValue(formData: FormData, name: string) {
  return getLastFormValue(formData, name) === "1";
}

function parseNullableIntegerFormValue(formData: FormData, name: string) {
  const raw = getLastFormValue(formData, name).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableNumberFormValue(formData: FormData, name: string) {
  const raw = getLastFormValue(formData, name).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const baselineStrategyKeys = [
  "price_first_market_scan",
  "adaptive_coverage_market_scan"
] as const satisfies SearchStrategyBundleKey[];

function isBaselineStrategyKey(value: SearchStrategyBundleKey): value is (typeof baselineStrategyKeys)[number] {
  return value === "price_first_market_scan" || value === "adaptive_coverage_market_scan";
}

function resolveSelectedBaselineStrategyKey(value: string | null | undefined): SearchStrategyBundleKey {
  return value === "adaptive_coverage_market_scan"
    ? "adaptive_coverage_market_scan"
    : "price_first_market_scan";
}

export function normalizeStrategyExperimentSettings(
  mode: string | null | undefined,
  sampleSize: number | null | undefined
): StrategyExperimentSettings {
  return {
    mode: mode === "baseline_parallel_random" ? "baseline_parallel_random" : "off",
    sampleSize: Math.max(2, Math.min(4, Number(sampleSize ?? 2) || 2))
  };
}

export function parseStrategyExperimentSettingsFromFormData(
  formData: FormData
): StrategyExperimentSettings {
  return normalizeStrategyExperimentSettings(
    getLastFormValue(formData, "strategyExperimentMode"),
    parseNullableIntegerFormValue(formData, "strategyExperimentSampleSize")
  );
}

export function saveSessionStrategyExperimentSettings(
  sessionId: string,
  settings: StrategyExperimentSettings
) {
  const db = getDb();
  const timestamp = nowIso();

  db.update(sessions)
    .set({
      strategyExperimentMode: settings.mode,
      strategyExperimentSampleSize: settings.sampleSize,
      updatedAt: timestamp
    })
    .where(eq(sessions.id, sessionId))
    .run();
}

export function listSessionStrategySelections(sessionId: string, session?: SessionRecord) {
  const db = getDb();
  const resolvedSession =
    session ?? db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!resolvedSession) {
    return [];
  }

  const persistedSelections = db
    .select()
    .from(sessionStrategySelections)
    .where(eq(sessionStrategySelections.sessionId, sessionId))
    .orderBy(asc(sessionStrategySelections.priority))
    .all();
  const persistedByKey = new Map(
    persistedSelections
      .filter((row) => isSearchStrategyBundleKey(row.strategyKey))
      .map((row) => [row.strategyKey, row] as const)
  );
  const defaultSelections = getDefaultSearchStrategySelections(resolvedSession);
  const selectedBaselineKey =
    (baselineStrategyKeys.find((key) => persistedByKey.get(key)?.enabled) ??
      baselineStrategyKeys.find(
        (key) => defaultSelections.find((selection) => selection.strategyKey === key)?.enabled
      ) ??
      "price_first_market_scan") as SearchStrategyBundleKey;

  return defaultSelections
    .map((defaultSelection) => {
      const persisted = persistedByKey.get(defaultSelection.strategyKey);

      if (defaultSelection.strategyKey === "price_first_market_scan") {
        const definition = getSearchStrategyBundleDefinition("price_first_market_scan");
        const config = normalizeStrategyBundleConfig(
          "price_first_market_scan",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: selectedBaselineKey === "price_first_market_scan",
          priority: definition.defaultPriority
        };
      }

      if (defaultSelection.strategyKey === "adaptive_coverage_market_scan") {
        const definition = getSearchStrategyBundleDefinition("adaptive_coverage_market_scan");
        const config = normalizeStrategyBundleConfig(
          "adaptive_coverage_market_scan",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: selectedBaselineKey === "adaptive_coverage_market_scan",
          priority: persisted?.priority ?? defaultSelection.priority
        };
      }

      if (defaultSelection.strategyKey === "multi_city_verification") {
        const definition = getSearchStrategyBundleDefinition("multi_city_verification");
        const config = normalizeStrategyBundleConfig(
          "multi_city_verification",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: persisted ? persisted.enabled : defaultSelection.enabled,
          priority: persisted?.priority ?? defaultSelection.priority
        };
      }

      if (defaultSelection.strategyKey === "anchored_multi_city_search") {
        const definition = getSearchStrategyBundleDefinition("anchored_multi_city_search");
        const config = normalizeStrategyBundleConfig(
          "anchored_multi_city_search",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: persisted ? persisted.enabled : defaultSelection.enabled,
          priority: persisted?.priority ?? defaultSelection.priority
        };
      }

      if (defaultSelection.strategyKey === "alternate_return_city_exploration") {
        const definition = getSearchStrategyBundleDefinition("alternate_return_city_exploration");
        const config = normalizeStrategyBundleConfig(
          "alternate_return_city_exploration",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: persisted ? persisted.enabled : defaultSelection.enabled,
          priority: persisted?.priority ?? defaultSelection.priority
        };
      }

      if (defaultSelection.strategyKey === "recommendation_date_coverage") {
        const definition = getSearchStrategyBundleDefinition("recommendation_date_coverage");
        const config = normalizeStrategyBundleConfig(
          "recommendation_date_coverage",
          persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
          resolvedSession
        );

        return {
          ...defaultSelection,
          compatibility: definition.getCompatibility(resolvedSession, config),
          config,
          enabled: persisted ? persisted.enabled : defaultSelection.enabled,
          priority: persisted?.priority ?? defaultSelection.priority
        };
      }

      const definition = getSearchStrategyBundleDefinition("stitched_value_probe");
      const config = normalizeStrategyBundleConfig(
        "stitched_value_probe",
        persisted ? safeJsonParse(persisted.configJson) : defaultSelection.config,
        resolvedSession
      );

      return {
        ...defaultSelection,
        compatibility: definition.getCompatibility(resolvedSession, config),
        config,
        enabled: persisted ? persisted.enabled : defaultSelection.enabled,
        priority: persisted?.priority ?? defaultSelection.priority
      };
    })
    .sort((left, right) => left.priority - right.priority);
}

export function buildStrategySelectionFingerprint(sessionId: string, session?: SessionRecord) {
  return JSON.stringify(
    listSessionStrategySelections(sessionId, session).map((selection) => ({
      config: selection.config,
      enabled: selection.enabled,
      priority: selection.priority,
      strategyKey: selection.strategyKey
    }))
  );
}

export function parseStrategySelectionInputsFromFormData(formData: FormData) {
  const selectedBaselineKey = resolveSelectedBaselineStrategyKey(
    getLastFormValue(formData, "baselineStrategyKey")
  );

  return getSearchStrategyBundleDefinitions().map((definition) => {
    if (definition.key === "price_first_market_scan") {
      return {
        config: {
          anchoredReturnSweepLimitOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__anchoredReturnSweepLimitOverride"
          ),
          anchorDepartureDateLimitOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__anchorDepartureDateLimitOverride"
          ),
          directSweepLimitOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__directSweepLimitOverride"
          ),
          enableReturnOptionExpansion: parseBooleanFormValue(
            formData,
            "price_first_market_scan__enableReturnOptionExpansion"
          ),
          enableAnchoredDateFollowup: parseBooleanFormValue(
            formData,
            "price_first_market_scan__enableAnchoredDateFollowup"
          ),
          maxOutboundOptionsPerQueryOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__maxOutboundOptionsPerQueryOverride"
          ),
          maxReturnOptionsPerOutboundOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__maxReturnOptionsPerOutboundOverride"
          ),
          returnOptionExpansionTargetLimitOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__returnOptionExpansionTargetLimitOverride"
          ),
          returnOptionExpansionVariationLimitOverride: parseNullableIntegerFormValue(
            formData,
            "price_first_market_scan__returnOptionExpansionVariationLimitOverride"
          )
        },
        enabled: selectedBaselineKey === "price_first_market_scan",
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    if (definition.key === "adaptive_coverage_market_scan") {
      return {
        config: {
          anchoredReturnSweepLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__anchoredReturnSweepLimitOverride"
          ),
          anchorDepartureDateLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__anchorDepartureDateLimitOverride"
          ),
          directSweepLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__directSweepLimitOverride"
          ),
          enableReturnOptionExpansion: parseBooleanFormValue(
            formData,
            "adaptive_coverage_market_scan__enableReturnOptionExpansion"
          ),
          enableAnchoredDateFollowup: parseBooleanFormValue(
            formData,
            "adaptive_coverage_market_scan__enableAnchoredDateFollowup"
          ),
          initialSeedSweepLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__initialSeedSweepLimitOverride"
          ),
          maxOutboundOptionsPerQueryOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__maxOutboundOptionsPerQueryOverride"
          ),
          maxReturnOptionsPerOutboundOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__maxReturnOptionsPerOutboundOverride"
          ),
          returnOptionExpansionTargetLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__returnOptionExpansionTargetLimitOverride"
          ),
          returnOptionExpansionVariationLimitOverride: parseNullableIntegerFormValue(
            formData,
            "adaptive_coverage_market_scan__returnOptionExpansionVariationLimitOverride"
          )
        },
        enabled: selectedBaselineKey === "adaptive_coverage_market_scan",
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    if (definition.key === "multi_city_verification") {
      return {
        config: {
          candidateReviewLimitOverride: parseNullableIntegerFormValue(
            formData,
            "multi_city_verification__candidateReviewLimitOverride"
          ),
          followupCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "multi_city_verification__followupCityLimitOverride"
          ),
          longStopFollowupCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "multi_city_verification__longStopFollowupCityLimitOverride"
          ),
          longStopValidationMinHoursOverride: parseNullableIntegerFormValue(
            formData,
            "multi_city_verification__longStopValidationMinHoursOverride"
          ),
          seedContextsPerCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "multi_city_verification__seedContextsPerCityLimitOverride"
          )
        },
        enabled: parseBooleanFormValue(formData, "multi_city_verification__enabled"),
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    if (definition.key === "anchored_multi_city_search") {
      return {
        config: {
          candidateReviewLimitOverride: parseNullableIntegerFormValue(
            formData,
            "anchored_multi_city_search__candidateReviewLimitOverride"
          ),
          dateVariationLimitOverride: parseNullableIntegerFormValue(
            formData,
            "anchored_multi_city_search__dateVariationLimitOverride"
          ),
          followupCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "anchored_multi_city_search__followupCityLimitOverride"
          ),
          seedContextsPerCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "anchored_multi_city_search__seedContextsPerCityLimitOverride"
          ),
          segmentOptionLimitOverride: parseNullableIntegerFormValue(
            formData,
            "anchored_multi_city_search__segmentOptionLimitOverride"
          )
        },
        enabled: parseBooleanFormValue(formData, "anchored_multi_city_search__enabled"),
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    if (definition.key === "alternate_return_city_exploration") {
      return {
        config: {
          candidateCityLimitOverride: parseNullableIntegerFormValue(
            formData,
            "alternate_return_city_exploration__candidateCityLimitOverride"
          ),
          datePairLimitOverride: parseNullableIntegerFormValue(
            formData,
            "alternate_return_city_exploration__datePairLimitOverride"
          )
        },
        enabled: parseBooleanFormValue(formData, "alternate_return_city_exploration__enabled"),
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    if (definition.key === "recommendation_date_coverage") {
      return {
        config: {
          candidateReviewLimitOverride: parseNullableIntegerFormValue(
            formData,
            "recommendation_date_coverage__candidateReviewLimitOverride"
          ),
          dateVariationLimitOverride: parseNullableIntegerFormValue(
            formData,
            "recommendation_date_coverage__dateVariationLimitOverride"
          ),
          routeTargetLimitOverride: parseNullableIntegerFormValue(
            formData,
            "recommendation_date_coverage__routeTargetLimitOverride"
          )
        },
        enabled: parseBooleanFormValue(formData, "recommendation_date_coverage__enabled"),
        priority: definition.defaultPriority,
        strategyKey: definition.key
      } satisfies StrategySelectionInput;
    }

    return {
      config: {
        discountRateOverride: parseNullableNumberFormValue(
          formData,
          "stitched_value_probe__discountRateOverride"
        ),
        maxDerivedCandidatesOverride: parseNullableIntegerFormValue(
          formData,
          "stitched_value_probe__maxDerivedCandidatesOverride"
        )
      },
      enabled: parseBooleanFormValue(formData, "stitched_value_probe__enabled"),
      priority: definition.defaultPriority,
      strategyKey: definition.key
    } satisfies StrategySelectionInput;
  });
}

export function saveSessionStrategySelections(sessionId: string, inputs: StrategySelectionInput[]) {
  const db = getDb();
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session) {
    return null;
  }

  const timestamp = nowIso();
  const defaultsByKey = new Map(
    getDefaultSearchStrategySelections(session).map((selection) => [selection.strategyKey, selection])
  );
  const selectedBaselineKey = resolveSelectedBaselineStrategyKey(
    inputs.find((entry) => isBaselineStrategyKey(entry.strategyKey) && entry.enabled)?.strategyKey
  );
  const rows = getSearchStrategyBundleDefinitions().map((definition) => {
    const input = inputs.find((entry) => entry.strategyKey === definition.key);
    const defaultSelection = defaultsByKey.get(definition.key);

    if (definition.key === "price_first_market_scan") {
      const config = normalizeStrategyBundleConfig(
        "price_first_market_scan",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: selectedBaselineKey === "price_first_market_scan",
        id: createId("session_strategy"),
        priority: definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    if (definition.key === "adaptive_coverage_market_scan") {
      const config = normalizeStrategyBundleConfig(
        "adaptive_coverage_market_scan",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: selectedBaselineKey === "adaptive_coverage_market_scan",
        id: createId("session_strategy"),
        priority: definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    if (definition.key === "multi_city_verification") {
      const config = normalizeStrategyBundleConfig(
        "multi_city_verification",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );
      const compatibility = definition.getCompatibility(session, config);

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: compatibility.isCompatible && (input?.enabled ?? defaultSelection?.enabled ?? false),
        id: createId("session_strategy"),
        priority: input?.priority ?? defaultSelection?.priority ?? definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    if (definition.key === "anchored_multi_city_search") {
      const config = normalizeStrategyBundleConfig(
        "anchored_multi_city_search",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );
      const compatibility = definition.getCompatibility(session, config);

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: compatibility.isCompatible && (input?.enabled ?? defaultSelection?.enabled ?? false),
        id: createId("session_strategy"),
        priority: input?.priority ?? defaultSelection?.priority ?? definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    if (definition.key === "alternate_return_city_exploration") {
      const config = normalizeStrategyBundleConfig(
        "alternate_return_city_exploration",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );
      const compatibility = definition.getCompatibility(session, config);

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: compatibility.isCompatible && (input?.enabled ?? defaultSelection?.enabled ?? false),
        id: createId("session_strategy"),
        priority: input?.priority ?? defaultSelection?.priority ?? definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    if (definition.key === "recommendation_date_coverage") {
      const config = normalizeStrategyBundleConfig(
        "recommendation_date_coverage",
        input?.config ?? defaultSelection?.config ?? {},
        session
      );
      const compatibility = definition.getCompatibility(session, config);

      return {
        configJson: JSON.stringify(config),
        createdAt: timestamp,
        enabled: compatibility.isCompatible && (input?.enabled ?? defaultSelection?.enabled ?? false),
        id: createId("session_strategy"),
        priority: input?.priority ?? defaultSelection?.priority ?? definition.defaultPriority,
        sessionId,
        strategyKey: definition.key,
        updatedAt: timestamp
      };
    }

    const config = normalizeStrategyBundleConfig(
      "stitched_value_probe",
      input?.config ?? defaultSelection?.config ?? {},
      session
    );
    const compatibility = definition.getCompatibility(session, config);

    return {
      configJson: JSON.stringify(config),
      createdAt: timestamp,
      enabled: compatibility.isCompatible && (input?.enabled ?? defaultSelection?.enabled ?? false),
      id: createId("session_strategy"),
      priority: input?.priority ?? defaultSelection?.priority ?? definition.defaultPriority,
      sessionId,
      strategyKey: definition.key,
      updatedAt: timestamp
    };
  });

  db.delete(sessionStrategySelections).where(eq(sessionStrategySelections.sessionId, sessionId)).run();
  db.insert(sessionStrategySelections).values(rows).run();

  return listSessionStrategySelections(sessionId, session);
}
