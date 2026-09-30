import assert from "node:assert/strict";
import { test } from "node:test";

import { describeQueryDates, summarizeQueryProgress } from "../../src/lib/runs/query-progress.ts";

const query = (status, input = {}, failureReason = null) => ({
  failureReason,
  queryInputJson: JSON.stringify(input),
  status
});

test("counts finished searches, including failed and blocked ones", () => {
  const summary = summarizeQueryProgress([
    query("completed"),
    query("skipped"),
    query("failed", {}, "Timed out"),
    query("blocked"),
    query("running", { departDate: "2026-12-27", returnDate: "2027-01-10" })
  ]);

  assert.equal(summary.totalCount, 5);
  assert.equal(summary.completedCount, 4);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.latestFailure, "Timed out");
  assert.equal(summary.currentDates, "27 Dec → 10 Jan");
});

test("reports the most recent failure and the latest running search", () => {
  const summary = summarizeQueryProgress([
    query("failed", {}, "first"),
    query("running", { departDate: "2026-12-15", returnDate: "2026-12-29" }),
    query("failed", {}, "second"),
    query("running", { departDate: "2026-12-17", returnDate: "2027-01-03" })
  ]);

  assert.equal(summary.latestFailure, "second");
  assert.equal(summary.currentDates, "17 Dec → 3 Jan");
});

test("has no current dates when nothing is running", () => {
  assert.equal(summarizeQueryProgress([query("completed")]).currentDates, null);
  assert.equal(summarizeQueryProgress([]).totalCount, 0);
});

test("describes one-way and malformed query inputs safely", () => {
  assert.equal(describeQueryDates(JSON.stringify({ departDate: "2026-12-15" })), "15 Dec");
  assert.equal(describeQueryDates(JSON.stringify({ departDate: "soon" })), null);
  assert.equal(describeQueryDates("{not json"), null);
});
