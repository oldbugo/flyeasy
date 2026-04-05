import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const sessionLifecycleStates = [
  "draft",
  "live_running",
  "live_idle",
  "needs_attention",
  "not_live",
  "completed",
  "archived"
] as const;

export const monitoringStates = ["enabled", "disabled", "blocked"] as const;
export const returnOriginModes = ["fixed_city", "any_mainland_city"] as const;
export const layoverScopes = ["mainland_china"] as const;
export const bookingModes = ["single_booking", "stitched", "both"] as const;
export const searchIntensities = ["low", "balanced", "high"] as const;
export const cabinPolicies = ["any"] as const;
export const strategyExperimentModes = ["off", "baseline_parallel_random"] as const;
export const sessionCityPreferenceRoles = [
  "preferred_stopover_city",
  "excluded_stopover_city",
  "preferred_return_origin_city"
] as const;

export const sessionLifecycleStateSchema = z.enum(sessionLifecycleStates);
export const monitoringStateSchema = z.enum(monitoringStates);
export const returnOriginModeSchema = z.enum(returnOriginModes);
export const layoverScopeSchema = z.enum(layoverScopes);
export const bookingModeSchema = z.enum(bookingModes);
export const searchIntensitySchema = z.enum(searchIntensities);
export const cabinPolicySchema = z.enum(cabinPolicies);
export const strategyExperimentModeSchema = z.enum(strategyExperimentModes);
export const sessionCityPreferenceRoleSchema = z.enum(sessionCityPreferenceRoles);

const sessionLifecycleStateValues = sql.raw(
  sessionLifecycleStates.map((value) => `'${value}'`).join(", ")
);
const monitoringStateValues = sql.raw(monitoringStates.map((value) => `'${value}'`).join(", "));
const returnOriginModeValues = sql.raw(returnOriginModes.map((value) => `'${value}'`).join(", "));
const layoverScopeValues = sql.raw(layoverScopes.map((value) => `'${value}'`).join(", "));
const bookingModeValues = sql.raw(bookingModes.map((value) => `'${value}'`).join(", "));
const searchIntensityValues = sql.raw(searchIntensities.map((value) => `'${value}'`).join(", "));
const cabinPolicyValues = sql.raw(cabinPolicies.map((value) => `'${value}'`).join(", "));
const strategyExperimentModeValues = sql.raw(
  strategyExperimentModes.map((value) => `'${value}'`).join(", ")
);
const sessionCityPreferenceRoleValues = sql.raw(
  sessionCityPreferenceRoles.map((value) => `'${value}'`).join(", ")
);

export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    lifecycleState: text("lifecycle_state").notNull(),
    monitoringState: text("monitoring_state").notNull(),
    isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
    originAirport: text("origin_airport").notNull(),
    outboundDestinationCity: text("outbound_destination_city").notNull(),
    returnDestinationAirport: text("return_destination_airport").notNull(),
    returnOriginMode: text("return_origin_mode").notNull(),
    returnOriginCity: text("return_origin_city"),
    departureStartDate: text("departure_start_date").notNull(),
    departureEndDate: text("departure_end_date").notNull(),
    durationMinDays: integer("duration_min_days"),
    durationMaxDays: integer("duration_max_days"),
    returnStartDate: text("return_start_date"),
    returnEndDate: text("return_end_date"),
    layoverScope: text("layover_scope").notNull(),
    maxStops: integer("max_stops").notNull(),
    stopDurationMinDays: integer("stop_duration_min_days").notNull(),
    stopDurationMaxDays: integer("stop_duration_max_days").notNull(),
    bookingMode: text("booking_mode").notNull(),
    searchIntensity: text("search_intensity").notNull(),
    cabinPolicy: text("cabin_policy").notNull(),
    requireIncludedCheckedBaggage: integer("require_included_checked_baggage", {
      mode: "boolean"
    })
      .notNull()
      .default(false),
    restrictToChineseAirlines: integer("restrict_to_chinese_airlines", {
      mode: "boolean"
    })
      .notNull()
      .default(false),
    strategyExperimentMode: text("strategy_experiment_mode").notNull().default("off"),
    strategyExperimentSampleSize: integer("strategy_experiment_sample_size").notNull().default(2),
    notes: text("notes"),
    refreshIntervalHours: integer("refresh_interval_hours").notNull().default(12),
    nextRefreshAt: text("next_refresh_at"),
    lastRunStartedAt: text("last_run_started_at"),
    lastRunFinishedAt: text("last_run_finished_at"),
    lastSuccessfulRunId: text("last_successful_run_id"),
    currentBestCandidateId: text("current_best_candidate_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    lifecycleStateCheck: check(
      "session_lifecycle_state_check",
      sql`${table.lifecycleState} in (${sessionLifecycleStateValues})`
    ),
    monitoringStateCheck: check(
      "session_monitoring_state_check",
      sql`${table.monitoringState} in (${monitoringStateValues})`
    ),
    returnOriginModeCheck: check(
      "session_return_origin_mode_check",
      sql`${table.returnOriginMode} in (${returnOriginModeValues})`
    ),
    layoverScopeCheck: check(
      "session_layover_scope_check",
      sql`${table.layoverScope} in (${layoverScopeValues})`
    ),
    bookingModeCheck: check(
      "session_booking_mode_check",
      sql`${table.bookingMode} in (${bookingModeValues})`
    ),
    searchIntensityCheck: check(
      "session_search_intensity_check",
      sql`${table.searchIntensity} in (${searchIntensityValues})`
    ),
    cabinPolicyCheck: check(
      "session_cabin_policy_check",
      sql`${table.cabinPolicy} in (${cabinPolicyValues})`
    ),
    strategyExperimentModeCheck: check(
      "session_strategy_experiment_mode_check",
      sql`${table.strategyExperimentMode} in (${strategyExperimentModeValues})`
    ),
    strategyExperimentSampleSizeCheck: check(
      "session_strategy_experiment_sample_size_check",
      sql`${table.strategyExperimentSampleSize} between 2 and 4`
    ),
    maxStopsCheck: check("session_max_stops_check", sql`${table.maxStops} between 0 and 2`),
    stopDurationMinCheck: check(
      "session_stop_duration_min_days_check",
      sql`${table.stopDurationMinDays} >= 0`
    ),
    stopDurationMaxCheck: check(
      "session_stop_duration_max_days_check",
      sql`${table.stopDurationMaxDays} >= ${table.stopDurationMinDays}`
    ),
    refreshIntervalHoursCheck: check(
      "session_refresh_interval_hours_check",
      sql`${table.refreshIntervalHours} between 1 and 168`
    )
  })
);

export const sessionCityPreferences = sqliteTable(
  "session_city_preference",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    cityCode: text("city_code").notNull(),
    role: text("role").notNull(),
    priority: integer("priority").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    sessionCityPreferenceRoleCheck: check(
      "session_city_preference_role_check",
      sql`${table.role} in (${sessionCityPreferenceRoleValues})`
    ),
    priorityCheck: check("session_city_preference_priority_check", sql`${table.priority} >= 0`),
    sessionCityPreferenceUnique: uniqueIndex("session_city_preference_unique_idx").on(
      table.sessionId,
      table.cityCode,
      table.role
    )
  })
);

export const sessionStrategySelections = sqliteTable(
  "session_strategy_selection",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    strategyKey: text("strategy_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority").notNull().default(0),
    configJson: text("config_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  }
);
