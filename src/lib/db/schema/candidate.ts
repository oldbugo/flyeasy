import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { searchRuns, strategyExecutions } from "./run";
import { sessions } from "./session";

export const candidateBookingTypes = ["single_booking", "stitched"] as const;
export const tripShapes = ["round_trip", "open_jaw"] as const;
export const verificationStatuses = [
  "not_checked",
  "verified",
  "repriced",
  "unavailable",
  "partial",
  "failed"
] as const;
export const stitchedRiskLevels = ["low", "medium", "high"] as const;
export const priceKinds = ["displayed_search_price", "verified_checkout_price"] as const;
export const shortlistStatuses = ["shortlisted", "top_pick", "dismissed"] as const;

export const candidateBookingTypeSchema = z.enum(candidateBookingTypes);
export const tripShapeSchema = z.enum(tripShapes);
export const verificationStatusSchema = z.enum(verificationStatuses);
export const stitchedRiskLevelSchema = z.enum(stitchedRiskLevels);
export const priceKindSchema = z.enum(priceKinds);
export const shortlistStatusSchema = z.enum(shortlistStatuses);

const candidateBookingTypeValues = sql.raw(
  candidateBookingTypes.map((value) => `'${value}'`).join(", ")
);
const tripShapeValues = sql.raw(tripShapes.map((value) => `'${value}'`).join(", "));
const verificationStatusValues = sql.raw(
  verificationStatuses.map((value) => `'${value}'`).join(", ")
);
const stitchedRiskLevelValues = sql.raw(
  stitchedRiskLevels.map((value) => `'${value}'`).join(", ")
);
const priceKindValues = sql.raw(priceKinds.map((value) => `'${value}'`).join(", "));
const shortlistStatusValues = sql.raw(shortlistStatuses.map((value) => `'${value}'`).join(", "));

export const candidateFamilies = sqliteTable(
  "candidate_family",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    familyKey: text("family_key").notNull(),
    bookingType: text("booking_type").notNull(),
    tripShape: text("trip_shape").notNull(),
    routeSummaryJson: text("route_summary_json").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull()
  },
  (table) => ({
    bookingTypeCheck: check(
      "candidate_family_booking_type_check",
      sql`${table.bookingType} in (${candidateBookingTypeValues})`
    ),
    tripShapeCheck: check(
      "candidate_family_trip_shape_check",
      sql`${table.tripShape} in (${tripShapeValues})`
    ),
    familyKeyUnique: uniqueIndex("candidate_family_session_family_key_idx").on(
      table.sessionId,
      table.familyKey
    )
  })
);

export const itineraryCandidates = sqliteTable(
  "itinerary_candidate",
  {
    id: text("id").primaryKey(),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    strategyExecutionId: text("strategy_execution_id")
      .notNull()
      .references(() => strategyExecutions.id, { onDelete: "cascade" }),
    candidateFamilyId: text("candidate_family_id")
      .notNull()
      .references(() => candidateFamilies.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    bookingType: text("booking_type").notNull(),
    tripShape: text("trip_shape").notNull(),
    outboundDestinationCity: text("outbound_destination_city").notNull(),
    returnOriginCity: text("return_origin_city"),
    stopCount: integer("stop_count").notNull(),
    intentionalStopCount: integer("intentional_stop_count").notNull().default(0),
    displayedSourceCurrency: text("displayed_source_currency").notNull(),
    displayedSourceAmount: real("displayed_source_amount").notNull(),
    displayedDisplayCurrency: text("displayed_display_currency").notNull(),
    displayedDisplayAmount: real("displayed_display_amount").notNull(),
    latestVerifiedSourceCurrency: text("latest_verified_source_currency"),
    latestVerifiedSourceAmount: real("latest_verified_source_amount"),
    latestVerifiedDisplayCurrency: text("latest_verified_display_currency"),
    latestVerifiedDisplayAmount: real("latest_verified_display_amount"),
    latestVerificationStatus: text("latest_verification_status").notNull().default("not_checked"),
    fareClassSummary: text("fare_class_summary"),
    totalTravelMinutes: integer("total_travel_minutes"),
    stitchedRiskLevel: text("stitched_risk_level"),
    riskNotes: text("risk_notes"),
    tripcomResumeUrl: text("tripcom_resume_url"),
    tripcomResumeToken: text("tripcom_resume_token"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    lastRankedAt: text("last_ranked_at"),
    isCurrentBest: integer("is_current_best", { mode: "boolean" }).notNull().default(false)
  },
  (table) => ({
    dedupeUnique: uniqueIndex("itinerary_candidate_run_dedupe_idx").on(
      table.searchRunId,
      table.dedupeKey
    ),
    bookingTypeCheck: check(
      "itinerary_candidate_booking_type_check",
      sql`${table.bookingType} in (${candidateBookingTypeValues})`
    ),
    tripShapeCheck: check(
      "itinerary_candidate_trip_shape_check",
      sql`${table.tripShape} in (${tripShapeValues})`
    ),
    verificationStatusCheck: check(
      "itinerary_candidate_latest_verification_status_check",
      sql`${table.latestVerificationStatus} in (${verificationStatusValues})`
    ),
    stitchedRiskLevelCheck: check(
      "itinerary_candidate_stitched_risk_level_check",
      sql`${table.stitchedRiskLevel} is null or ${table.stitchedRiskLevel} in (${stitchedRiskLevelValues})`
    ),
    stopCountCheck: check("itinerary_candidate_stop_count_check", sql`${table.stopCount} >= 0`),
    intentionalStopCountCheck: check(
      "itinerary_candidate_intentional_stop_count_check",
      sql`${table.intentionalStopCount} >= 0`
    )
  })
);

export const candidateLegs = sqliteTable(
  "candidate_leg",
  {
    id: text("id").primaryKey(),
    itineraryCandidateId: text("itinerary_candidate_id")
      .notNull()
      .references(() => itineraryCandidates.id, { onDelete: "cascade" }),
    legIndex: integer("leg_index").notNull(),
    segmentGroup: text("segment_group").notNull(),
    bookingReferenceGroup: text("booking_reference_group").notNull(),
    carrierCode: text("carrier_code"),
    flightNumber: text("flight_number"),
    originAirport: text("origin_airport").notNull(),
    destinationAirport: text("destination_airport").notNull(),
    departureAt: text("departure_at").notNull(),
    arrivalAt: text("arrival_at").notNull(),
    cabinClass: text("cabin_class"),
    fareBrand: text("fare_brand"),
    baggageSummary: text("baggage_summary"),
    rawLegPayloadJson: text("raw_leg_payload_json"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    legUnique: uniqueIndex("candidate_leg_candidate_leg_index_idx").on(
      table.itineraryCandidateId,
      table.legIndex
    )
  })
);

export const candidateStopovers = sqliteTable(
  "candidate_stopover",
  {
    id: text("id").primaryKey(),
    itineraryCandidateId: text("itinerary_candidate_id")
      .notNull()
      .references(() => itineraryCandidates.id, { onDelete: "cascade" }),
    stopIndex: integer("stop_index").notNull(),
    cityCode: text("city_code").notNull(),
    airportCode: text("airport_code").notNull(),
    countryCode: text("country_code"),
    arrivalAt: text("arrival_at").notNull(),
    departureAt: text("departure_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    isIntentional: integer("is_intentional", { mode: "boolean" }).notNull().default(false),
    isMainlandChina: integer("is_mainland_china", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    stopoverUnique: uniqueIndex("candidate_stopover_candidate_stop_index_idx").on(
      table.itineraryCandidateId,
      table.stopIndex
    )
  })
);

export const priceObservations = sqliteTable(
  "price_observation",
  {
    id: text("id").primaryKey(),
    itineraryCandidateId: text("itinerary_candidate_id")
      .notNull()
      .references(() => itineraryCandidates.id, { onDelete: "cascade" }),
    searchRunId: text("search_run_id")
      .notNull()
      .references(() => searchRuns.id, { onDelete: "cascade" }),
    verificationAttemptId: text("verification_attempt_id"),
    priceKind: text("price_kind").notNull(),
    sourceCurrency: text("source_currency").notNull(),
    sourceAmount: real("source_amount").notNull(),
    displayCurrency: text("display_currency").notNull(),
    displayAmount: real("display_amount").notNull(),
    fxProvider: text("fx_provider"),
    fxRate: real("fx_rate"),
    fxRateTimestamp: text("fx_rate_timestamp"),
    observedAt: text("observed_at").notNull()
  },
  (table) => ({
    priceKindCheck: check(
      "price_observation_price_kind_check",
      sql`${table.priceKind} in (${priceKindValues})`
    )
  })
);

export const sessionShortlistEntries = sqliteTable(
  "session_shortlist_entry",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    candidateFamilyId: text("candidate_family_id")
      .notNull()
      .references(() => candidateFamilies.id, { onDelete: "cascade" }),
    itineraryCandidateId: text("itinerary_candidate_id")
      .notNull()
      .references(() => itineraryCandidates.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    userNote: text("user_note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    shortlistStatusCheck: check(
      "session_shortlist_entry_status_check",
      sql`${table.status} in (${shortlistStatusValues})`
    ),
    shortlistUnique: uniqueIndex("session_shortlist_entry_session_family_idx").on(
      table.sessionId,
      table.candidateFamilyId
    )
  })
);
