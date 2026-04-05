import { z } from "zod";

import {
  bookingModeSchema,
  monitoringStateSchema,
  returnOriginModeSchema,
  searchIntensitySchema,
  sessionLifecycleStateSchema
} from "@/lib/db/schema/session";
import {
  resolveAirportInputDetailed,
  resolveCityInput
} from "@/lib/locations/catalog";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCode(value: unknown) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizeNumber(value: unknown) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCheckbox(value: unknown) {
  return value === "on" || value === "true" || value === "1";
}

const baseSessionFormObject = z.object({
    name: z.string().trim().min(2),
    originAirport: z.string().trim().min(2),
    outboundDestinationCity: z.string().trim().min(2),
    returnDestinationAirport: z.string().trim().min(2),
    returnOriginMode: returnOriginModeSchema,
    returnOriginCity: z.preprocess(normalizeOptionalString, z.string().min(2).optional()),
    departureStartDate: z.string().trim().min(10),
    latestReturnDate: z.string().trim().min(10),
    durationMinDays: z.preprocess(normalizeNumber, z.number().int().min(1).max(365).optional()),
    durationMaxDays: z.preprocess(normalizeNumber, z.number().int().min(1).max(365).optional()),
    maxStops: z.preprocess(normalizeNumber, z.number().int().min(0).max(2)),
    stopDurationMinDays: z.preprocess(normalizeNumber, z.number().int().min(0).max(30)),
    stopDurationMaxDays: z.preprocess(normalizeNumber, z.number().int().min(0).max(30)),
    refreshIntervalHours: z.preprocess(normalizeNumber, z.number().int().min(1).max(168)),
    bookingMode: bookingModeSchema,
    requireIncludedCheckedBaggage: z.preprocess(normalizeCheckbox, z.boolean()),
    restrictToChineseAirlines: z.preprocess(normalizeCheckbox, z.boolean()),
    searchIntensity: searchIntensitySchema,
    notes: z.preprocess(normalizeOptionalString, z.string().max(2000).optional())
  });

function addSessionFormRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<typeof baseSessionFormObject>, ctx) => {
    const originAirport = resolveAirportInputDetailed(value.originAirport);
    if (originAirport.status !== "resolved") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          originAirport.status === "ambiguous"
            ? `Multiple airports match ${value.originAirport}. Choose a specific airport from the suggestions.`
            : "Choose a valid origin airport from the location suggestions.",
        path: ["originAirport"]
      });
    }

    const returnDestinationAirport = resolveAirportInputDetailed(value.returnDestinationAirport);
    if (returnDestinationAirport.status !== "resolved") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          returnDestinationAirport.status === "ambiguous"
            ? `Multiple airports match ${value.returnDestinationAirport}. Choose a specific airport from the suggestions.`
            : "Choose a valid return destination airport from the location suggestions.",
        path: ["returnDestinationAirport"]
      });
    }

    const outboundDestinationCity = resolveCityInput(value.outboundDestinationCity);
    if (!outboundDestinationCity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a valid destination city from the location suggestions.",
        path: ["outboundDestinationCity"]
      });
    }

    if (value.latestReturnDate < value.departureStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latest return date must be after the earliest departure date.",
        path: ["latestReturnDate"]
      });
    }

    if (
      value.durationMinDays !== undefined &&
      value.durationMaxDays !== undefined &&
      value.durationMaxDays < value.durationMinDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum duration must be greater than or equal to minimum duration.",
        path: ["durationMaxDays"]
      });
    }

    if (value.durationMinDays !== undefined) {
      const minimumReturnDate = new Date(`${value.departureStartDate}T00:00:00.000Z`);
      minimumReturnDate.setUTCDate(minimumReturnDate.getUTCDate() + value.durationMinDays);
      const minimumReturnIso = minimumReturnDate.toISOString().slice(0, 10);

      if (minimumReturnIso > value.latestReturnDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Latest return date must allow at least the minimum trip duration.",
          path: ["latestReturnDate"]
        });
      }
    }

    if (value.stopDurationMaxDays < value.stopDurationMinDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum stop duration must be greater than or equal to minimum stop duration.",
        path: ["stopDurationMaxDays"]
      });
    }

    if (value.refreshIntervalHours < 1 || value.refreshIntervalHours > 168) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Refresh interval must be between 1 and 168 hours.",
        path: ["refreshIntervalHours"]
      });
    }

    if (value.returnOriginMode === "fixed_city" && !value.returnOriginCity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Return origin city is required when using a fixed city.",
        path: ["returnOriginCity"]
      });
    }

    if (value.returnOriginCity) {
      const returnOriginCity = resolveCityInput(value.returnOriginCity);
      if (!returnOriginCity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a valid return origin city from the location suggestions.",
          path: ["returnOriginCity"]
        });
      }
    }

    if (originAirport.status === "resolved") {
      value.originAirport = originAirport.match.code;
    }

    if (returnDestinationAirport.status === "resolved") {
      value.returnDestinationAirport = returnDestinationAirport.match.code;
    }

    if (outboundDestinationCity) {
      value.outboundDestinationCity = outboundDestinationCity.displayName;
    }

    if (value.returnOriginCity) {
      const returnOriginCity = resolveCityInput(value.returnOriginCity);
      if (returnOriginCity) {
        value.returnOriginCity = returnOriginCity.displayName;
      }
    }
  });
}

export const createSessionFormSchema = addSessionFormRefinements(baseSessionFormObject);

export const updateSessionFormSchema = addSessionFormRefinements(
  baseSessionFormObject.extend({
    sessionId: z.string().trim().min(1),
    lifecycleState: sessionLifecycleStateSchema.optional(),
    monitoringState: monitoringStateSchema.optional()
  })
);

export type CreateSessionFormValues = z.infer<typeof createSessionFormSchema>;
export type UpdateSessionFormValues = z.infer<typeof updateSessionFormSchema>;

export function parseCreateSessionForm(formData: FormData) {
  return createSessionFormSchema.parse(Object.fromEntries(formData));
}

export function parseUpdateSessionForm(formData: FormData) {
  return updateSessionFormSchema.parse(Object.fromEntries(formData));
}
