import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { searchRuns, strategyExecutions } from "./run";
import { verificationAttempts } from "./verification";

export const artifactTypes = [
  "screenshot",
  "html_snapshot",
  "playwright_trace",
  "json_export"
] as const;

export const artifactTypeSchema = z.enum(artifactTypes);

const artifactTypeValues = sql.raw(artifactTypes.map((value) => `'${value}'`).join(", "));

export const runArtifacts = sqliteTable(
  "run_artifact",
  {
    id: text("id").primaryKey(),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    strategyExecutionId: text("strategy_execution_id").references(() => strategyExecutions.id, {
      onDelete: "set null"
    }),
    verificationAttemptId: text("verification_attempt_id").references(
      () => verificationAttempts.id,
      {
        onDelete: "set null"
      }
    ),
    artifactType: text("artifact_type").notNull(),
    filePath: text("file_path").notNull(),
    mimeType: text("mime_type"),
    createdAt: text("created_at").notNull(),
    notes: text("notes")
  },
  (table) => ({
    artifactTypeCheck: check(
      "run_artifact_type_check",
      sql`${table.artifactType} in (${artifactTypeValues})`
    )
  })
);
