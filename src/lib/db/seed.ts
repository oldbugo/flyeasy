import { sql } from "drizzle-orm";

import { getDb } from "./client";
import { createId } from "./ids";
import { sessions } from "./schema/session";

function nowIso() {
  return new Date().toISOString();
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildExampleTripDates(baseDate = new Date()) {
  const currentYear = baseDate.getFullYear();
  const currentYearCutoff = new Date(currentYear, 11, 17);
  const targetYear = baseDate <= currentYearCutoff ? currentYear : currentYear + 1;

  return {
    departureEndDate: toIsoDate(new Date(targetYear, 11, 17)),
    departureStartDate: toIsoDate(new Date(targetYear, 11, 10)),
    returnEndDate: toIsoDate(new Date(targetYear, 11, 31))
  };
}

export async function ensureExampleSession() {
  const db = getDb();
  const existingCount = db.select({ count: sql<number>`count(*)` }).from(sessions).get();

  if ((existingCount?.count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const exampleTripDates = buildExampleTripDates();

  db.insert(sessions)
    .values({
      id: createId("session"),
      name: "Example Guangzhou trip",
      lifecycleState: "not_live",
      monitoringState: "disabled",
      isLive: false,
      originAirport: "SYD",
      outboundDestinationCity: "Guangzhou",
      returnDestinationAirport: "SYD",
      returnOriginMode: "fixed_city",
      returnOriginCity: "CAN",
      departureStartDate: exampleTripDates.departureStartDate,
      departureEndDate: exampleTripDates.departureEndDate,
      durationMinDays: 14,
      durationMaxDays: 14,
      returnStartDate: null,
      returnEndDate: exampleTripDates.returnEndDate,
      layoverScope: "mainland_china",
      maxStops: 1,
      stopDurationMinDays: 0,
      stopDurationMaxDays: 2,
      bookingMode: "both",
      searchIntensity: "balanced",
      cabinPolicy: "any",
      requireIncludedCheckedBaggage: false,
      restrictToChineseAirlines: false,
      strategyExperimentMode: "off",
      strategyExperimentSampleSize: 2,
      notes: "Example session created on first launch.",
      refreshIntervalHours: 12,
      nextRefreshAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastSuccessfulRunId: null,
      currentBestCandidateId: null,
      createdAt,
      updatedAt: createdAt
    })
    .run();
}
