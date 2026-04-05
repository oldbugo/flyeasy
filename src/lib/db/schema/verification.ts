import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { itineraryCandidates } from "./candidate";
import { searchRuns } from "./run";

export const verificationAttemptStatuses = [
  "running",
  "blocked",
  "verified",
  "repriced",
  "unavailable",
  "partial",
  "failed",
  "cancelled"
] as const;

export const checkoutStages = ["results", "details", "traveler_form", "final_review"] as const;

export const verificationAttemptStatusSchema = z.enum(verificationAttemptStatuses);
export const checkoutStageSchema = z.enum(checkoutStages);

const verificationAttemptStatusValues = sql.raw(
  verificationAttemptStatuses.map((value) => `'${value}'`).join(", ")
);
const checkoutStageValues = sql.raw(checkoutStages.map((value) => `'${value}'`).join(", "));

export const verificationAttempts = sqliteTable(
  "verification_attempt",
  {
    id: text("id").primaryKey(),
    itineraryCandidateId: text("itinerary_candidate_id")
      .notNull()
      .references(() => itineraryCandidates.id, { onDelete: "cascade" }),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    attemptIndex: integer("attempt_index").notNull(),
    status: text("status").notNull(),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    checkoutStageReached: text("checkout_stage_reached"),
    sourceCurrency: text("source_currency"),
    sourceAmount: real("source_amount"),
    displayCurrency: text("display_currency"),
    displayAmount: real("display_amount"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at")
  },
  (table) => ({
    verificationAttemptStatusCheck: check(
      "verification_attempt_status_check",
      sql`${table.status} in (${verificationAttemptStatusValues})`
    ),
    checkoutStageCheck: check(
      "verification_attempt_checkout_stage_check",
      sql`${table.checkoutStageReached} is null or ${table.checkoutStageReached} in (${checkoutStageValues})`
    ),
    verificationAttemptUnique: uniqueIndex("verification_attempt_candidate_attempt_idx").on(
      table.itineraryCandidateId,
      table.attemptIndex
    )
  })
);
