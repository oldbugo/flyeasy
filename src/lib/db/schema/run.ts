import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { sessions } from "./session";

export const runModes = ["interactive", "monitoring"] as const;
export const runStatuses = [
  "queued",
  "running",
  "blocked",
  "paused",
  "completed",
  "failed",
  "cancelled"
] as const;
export const triggerSources = ["manual", "scheduled", "rerank_only", "debug"] as const;
export const recoveryStates = ["not_required", "pending", "completed", "abandoned"] as const;
export const recoveryTypes = [
  "login_required",
  "challenge_required",
  "verification_blocked",
  "app_interrupted"
] as const;
export const resumeModes = ["same_run", "partial_restart", "new_run"] as const;
export const strategySourceTypes = ["system", "ai"] as const;
export const runStrategyExperimentModes = ["baseline_parallel_random"] as const;
export const runStrategyExperimentStatuses = [
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled"
] as const;
export const strategyStatuses = [
  "queued",
  "running",
  "blocked",
  "completed",
  "failed",
  "skipped",
  "cancelled"
] as const;
export const queryTypes = [
  "direct_round_trip",
  "anchored_multi_city",
  "return_option_expansion",
  "stopover_filtered_round_trip"
] as const;
export const querySources = ["planned", "derived_from_result"] as const;
export const queryStatuses = [
  "queued",
  "running",
  "blocked",
  "completed",
  "failed",
  "skipped",
  "cancelled"
] as const;
export const queryCandidateLinkTypes = ["result"] as const;

export const runModeSchema = z.enum(runModes);
export const runStatusSchema = z.enum(runStatuses);
export const triggerSourceSchema = z.enum(triggerSources);
export const recoveryStateSchema = z.enum(recoveryStates);
export const recoveryTypeSchema = z.enum(recoveryTypes);
export const resumeModeSchema = z.enum(resumeModes);
export const strategySourceTypeSchema = z.enum(strategySourceTypes);
export const runStrategyExperimentModeSchema = z.enum(runStrategyExperimentModes);
export const runStrategyExperimentStatusSchema = z.enum(runStrategyExperimentStatuses);
export const strategyStatusSchema = z.enum(strategyStatuses);
export const queryTypeSchema = z.enum(queryTypes);
export const querySourceSchema = z.enum(querySources);
export const queryStatusSchema = z.enum(queryStatuses);
export const queryCandidateLinkTypeSchema = z.enum(queryCandidateLinkTypes);

const runModeValues = sql.raw(runModes.map((value) => `'${value}'`).join(", "));
const runStatusValues = sql.raw(runStatuses.map((value) => `'${value}'`).join(", "));
const triggerSourceValues = sql.raw(triggerSources.map((value) => `'${value}'`).join(", "));
const recoveryStateValues = sql.raw(recoveryStates.map((value) => `'${value}'`).join(", "));
const recoveryTypeValues = sql.raw(recoveryTypes.map((value) => `'${value}'`).join(", "));
const resumeModeValues = sql.raw(resumeModes.map((value) => `'${value}'`).join(", "));
const strategySourceTypeValues = sql.raw(
  strategySourceTypes.map((value) => `'${value}'`).join(", ")
);
const strategyExperimentModeValues = sql.raw(
  runStrategyExperimentModes.map((value) => `'${value}'`).join(", ")
);
const strategyExperimentStatusValues = sql.raw(
  runStrategyExperimentStatuses.map((value) => `'${value}'`).join(", ")
);
const strategyStatusValues = sql.raw(strategyStatuses.map((value) => `'${value}'`).join(", "));
const queryTypeValues = sql.raw(queryTypes.map((value) => `'${value}'`).join(", "));
const querySourceValues = sql.raw(querySources.map((value) => `'${value}'`).join(", "));
const queryStatusValues = sql.raw(queryStatuses.map((value) => `'${value}'`).join(", "));
const queryCandidateLinkTypeValues = sql.raw(
  queryCandidateLinkTypes.map((value) => `'${value}'`).join(", ")
);

export const strategyExperimentGroups = sqliteTable(
  "strategy_experiment_group",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    experimentMode: text("experiment_mode").notNull(),
    status: text("status").notNull().default("queued"),
    sampleSize: integer("sample_size").notNull(),
    championStrategyKey: text("champion_strategy_key"),
    selectedStrategyKeysJson: text("selected_strategy_keys_json").notNull(),
    randomSeed: text("random_seed").notNull(),
    summaryJson: text("summary_json"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    experimentModeCheck: check(
      "strategy_experiment_group_mode_check",
      sql`${table.experimentMode} in (${strategyExperimentModeValues})`
    ),
    statusCheck: check(
      "strategy_experiment_group_status_check",
      sql`${table.status} in (${strategyExperimentStatusValues})`
    ),
    sampleSizeCheck: check(
      "strategy_experiment_group_sample_size_check",
      sql`${table.sampleSize} between 2 and 4`
    )
  })
);

export const searchRuns = sqliteTable(
  "search_run",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    runMode: text("run_mode").notNull(),
    status: text("status").notNull(),
    triggerSource: text("trigger_source").notNull(),
    strategyExperimentGroupId: text("strategy_experiment_group_id"),
    strategyExperimentArmKey: text("strategy_experiment_arm_key"),
    strategyExperimentArmLabel: text("strategy_experiment_arm_label"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    searchSnapshotJson: text("search_snapshot_json").notNull(),
    totalStrategiesPlanned: integer("total_strategies_planned").notNull().default(0),
    totalStrategiesExecuted: integer("total_strategies_executed").notNull().default(0),
    totalCandidatesFound: integer("total_candidates_found").notNull().default(0),
    totalCandidatesVerified: integer("total_candidates_verified").notNull().default(0),
    bestCandidateId: text("best_candidate_id"),
    summaryText: text("summary_text"),
    failureReason: text("failure_reason"),
    recoveryState: text("recovery_state").notNull().default("not_required"),
    recoveryType: text("recovery_type"),
    recoveryReason: text("recovery_reason"),
    blockedAt: text("blocked_at"),
    resumeAvailable: integer("resume_available", { mode: "boolean" }).notNull().default(false),
    resumeMode: text("resume_mode"),
    resumeCheckpointJson: text("resume_checkpoint_json"),
    recoveryCompletedAt: text("recovery_completed_at"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    runModeCheck: check("search_run_run_mode_check", sql`${table.runMode} in (${runModeValues})`),
    runStatusCheck: check("search_run_status_check", sql`${table.status} in (${runStatusValues})`),
    triggerSourceCheck: check(
      "search_run_trigger_source_check",
      sql`${table.triggerSource} in (${triggerSourceValues})`
    ),
    recoveryStateCheck: check(
      "search_run_recovery_state_check",
      sql`${table.recoveryState} in (${recoveryStateValues})`
    ),
    recoveryTypeCheck: check(
      "search_run_recovery_type_check",
      sql`${table.recoveryType} is null or ${table.recoveryType} in (${recoveryTypeValues})`
    ),
    resumeModeCheck: check(
      "search_run_resume_mode_check",
      sql`${table.resumeMode} is null or ${table.resumeMode} in (${resumeModeValues})`
    )
  })
);

export const strategyExecutions = sqliteTable(
  "strategy_execution",
  {
    id: text("id").primaryKey(),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    parentStrategyExecutionId: text("parent_strategy_execution_id"),
    strategyType: text("strategy_type").notNull(),
    sourceType: text("source_type").notNull(),
    priority: integer("priority").notNull(),
    reason: text("reason").notNull(),
    strategyPayloadJson: text("strategy_payload_json").notNull(),
    status: text("status").notNull(),
    estimatedSearchCost: integer("estimated_search_cost").notNull().default(0),
    actualSearchCost: integer("actual_search_cost"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    candidateCount: integer("candidate_count").notNull().default(0),
    verifiedCandidateCount: integer("verified_candidate_count").notNull().default(0),
    bestCandidateId: text("best_candidate_id"),
    failureReason: text("failure_reason")
  },
  (table) => ({
    sourceTypeCheck: check(
      "strategy_execution_source_type_check",
      sql`${table.sourceType} in (${strategySourceTypeValues})`
    ),
    strategyStatusCheck: check(
      "strategy_execution_status_check",
      sql`${table.status} in (${strategyStatusValues})`
    )
  })
);

export const queryExecutions = sqliteTable(
  "query_execution",
  {
    id: text("id").primaryKey(),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    strategyExecutionId: text("strategy_execution_id")
      .notNull()
      .references(() => strategyExecutions.id, { onDelete: "cascade" }),
    parentQueryExecutionId: text("parent_query_execution_id"),
    queryType: text("query_type").notNull(),
    source: text("source").notNull(),
    priority: integer("priority").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    queryInputJson: text("query_input_json").notNull(),
    resultSummaryJson: text("result_summary_json"),
    observedStopoverCitiesJson: text("observed_stopover_cities_json"),
    tripcomResultUrl: text("tripcom_result_url"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    queryTypeCheck: check(
      "query_execution_query_type_check",
      sql`${table.queryType} in (${queryTypeValues})`
    ),
    querySourceCheck: check(
      "query_execution_source_check",
      sql`${table.source} in (${querySourceValues})`
    ),
    queryStatusCheck: check(
      "query_execution_status_check",
      sql`${table.status} in (${queryStatusValues})`
    )
  })
);

export const queryCandidateLinks = sqliteTable(
  "query_candidate_link",
  {
    id: text("id").primaryKey(),
    queryExecutionId: text("query_execution_id")
      .notNull()
      .references(() => queryExecutions.id, { onDelete: "cascade" }),
    itineraryCandidateId: text("itinerary_candidate_id").notNull(),
    linkType: text("link_type").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    linkTypeCheck: check(
      "query_candidate_link_type_check",
      sql`${table.linkType} in (${queryCandidateLinkTypeValues})`
    )
  })
);

export const runAnalysisSnapshots = sqliteTable(
  "run_analysis_snapshot",
  {
    id: text("id").primaryKey(),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    strategyExecutionId: text("strategy_execution_id")
      .notNull()
      .references(() => strategyExecutions.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(),
    summaryJson: text("summary_json").notNull(),
    createdAt: text("created_at").notNull()
  }
);
