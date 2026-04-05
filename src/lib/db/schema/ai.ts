import { sql } from "drizzle-orm";
import { check, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { searchRuns } from "./run";
import { sessions } from "./session";

export const aiProposalStatuses = ["proposed", "accepted", "dismissed"] as const;
export const aiProposalValidationStatuses = ["valid", "invalid"] as const;

export const aiProposalStatusSchema = z.enum(aiProposalStatuses);
export const aiProposalValidationStatusSchema = z.enum(aiProposalValidationStatuses);

const aiProposalStatusValues = sql.raw(aiProposalStatuses.map((value) => `'${value}'`).join(", "));
const aiProposalValidationStatusValues = sql.raw(
  aiProposalValidationStatuses.map((value) => `'${value}'`).join(", ")
);

export const aiStrategyProposals = sqliteTable(
  "ai_strategy_proposal",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    strategyType: text("strategy_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    rationale: text("rationale").notNull(),
    strategyPayloadJson: text("strategy_payload_json").notNull(),
    status: text("status").notNull().default("proposed"),
    validationStatus: text("validation_status").notNull().default("valid"),
    validationNotes: text("validation_notes"),
    generatedFromSessionUpdatedAt: text("generated_from_session_updated_at").notNull(),
    lastAppliedRunId: text("last_applied_run_id").references(() => searchRuns.id, {
      onDelete: "set null"
    }),
    acceptedAt: text("accepted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    statusCheck: check(
      "ai_strategy_proposal_status_check",
      sql`${table.status} in (${aiProposalStatusValues})`
    ),
    validationStatusCheck: check(
      "ai_strategy_proposal_validation_status_check",
      sql`${table.validationStatus} in (${aiProposalValidationStatusValues})`
    )
  })
);
