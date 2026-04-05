"use client";

import { useId, useState, type FormEvent, type FocusEvent } from "react";

import { bookingModes, searchIntensities } from "@/lib/db/schema/session";
import {
  getDefaultRefreshIntervalHours,
  getRefreshIntervalBounds
} from "@/lib/monitoring/refresh";
import {
  airportCatalog,
  cityCatalog,
  resolveAirportInput,
  resolveAirportInputDetailed,
  resolveCityInput
} from "@/lib/locations/catalog";

type SessionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: {
    bookingMode?: string;
    departureStartDate?: string;
    durationMaxDays?: number | null;
    durationMinDays?: number | null;
    latestReturnDate?: string | null;
    maxStops?: number;
    name?: string;
    notes?: string | null;
    originAirport?: string;
    outboundDestinationCity?: string;
    requireIncludedCheckedBaggage?: boolean;
    returnDestinationAirport?: string;
    returnOriginCity?: string | null;
    returnOriginMode?: string;
    restrictToChineseAirlines?: boolean;
    refreshIntervalHours?: number;
    searchIntensity?: string;
    sessionId?: string;
    stopDurationMaxDays?: number;
    stopDurationMinDays?: number;
  };
  formError?: string | null;
  secondaryAction?: (formData: FormData) => void | Promise<void>;
  secondaryLabel?: string;
  submitLabel: string;
};

type FieldErrors = Partial<Record<string, string>>;

function textValue(value?: string | null) {
  return value ?? "";
}

function inputClass(error?: string) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
    error
      ? "border-rose-400 bg-rose-50 focus:border-rose-500"
      : "border-line focus:border-sea"
  }`;
}

function validateAirport(value: string) {
  if (!value.trim()) {
    return "Choose a valid airport from the suggestions.";
  }

  const result = resolveAirportInputDetailed(value);
  if (result.status === "resolved") {
    return null;
  }

  if (result.status === "ambiguous") {
    return `Multiple airports match ${value}. Choose a specific airport from the suggestions.`;
  }

  return "Choose a valid airport from the suggestions.";
}

function validateCity(value: string, required = true) {
  if (!value.trim()) {
    return required ? "Choose a valid city from the suggestions." : null;
  }

  return resolveCityInput(value) ? null : "Choose a valid city from the suggestions.";
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const utcDate = new Date(`${isoDate}T00:00:00.000Z`);
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

export function SessionForm({
  action,
  defaults,
  formError,
  secondaryAction,
  secondaryLabel,
  submitLabel
}: SessionFormProps) {
  const airportListId = useId();
  const cityListId = useId();
  const refreshIntervalBounds = getRefreshIntervalBounds();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [returnOriginMode, setReturnOriginMode] = useState(
    defaults?.returnOriginMode ?? "any_mainland_city"
  );
  const [departureStartDate, setDepartureStartDate] = useState(
    textValue(defaults?.departureStartDate)
  );
  const [durationMinDays, setDurationMinDays] = useState(
    defaults?.durationMinDays?.toString() ?? "14"
  );

  const minimumReturnDate =
    departureStartDate && durationMinDays
      ? addDaysToIsoDate(departureStartDate, Math.max(Number(durationMinDays) || 0, 0))
      : departureStartDate;

  function normalizeField(field: HTMLInputElement | HTMLTextAreaElement) {
    const { name, value } = field;

    if (name === "originAirport" || name === "returnDestinationAirport") {
      const airport = resolveAirportInput(value);
      if (airport) {
        field.value = airport.code;
      }
      return;
    }

    if (name === "outboundDestinationCity" || name === "returnOriginCity") {
      const city = resolveCityInput(value);
      if (city) {
        field.value = city.displayName;
      }
      return;
    }

  }

  function validateField(name: string, value: string, nextReturnOriginMode = returnOriginMode) {
    if (name === "originAirport" || name === "returnDestinationAirport") {
      return validateAirport(value);
    }

    if (name === "outboundDestinationCity") {
      return validateCity(value, true);
    }

    if (name === "returnOriginCity") {
      return validateCity(value, nextReturnOriginMode === "fixed_city");
    }

    return null;
  }

  function collectCompositeErrors(
    formData: FormData,
    nextReturnOriginMode = returnOriginMode
  ): FieldErrors {
    const nextErrors: FieldErrors = {};
    const departureDate = String(formData.get("departureStartDate") ?? "").trim();
    const latestReturnDate = String(formData.get("latestReturnDate") ?? "").trim();
    const minDurationDays = parseOptionalInteger(formData.get("durationMinDays"));
    const maxDurationDays = parseOptionalInteger(formData.get("durationMaxDays"));
    const minStopDurationDays = parseOptionalInteger(formData.get("stopDurationMinDays"));
    const maxStopDurationDays = parseOptionalInteger(formData.get("stopDurationMaxDays"));
    const returnOriginCityValue = String(formData.get("returnOriginCity") ?? "");
    const returnOriginCityError = validateField(
      "returnOriginCity",
      returnOriginCityValue,
      nextReturnOriginMode
    );

    if (returnOriginCityError) {
      nextErrors.returnOriginCity = returnOriginCityError;
    }

    if (departureDate && latestReturnDate && latestReturnDate < departureDate) {
      nextErrors.latestReturnDate =
        "Latest return date must be after the earliest departure date.";
    }

    if (
      !nextErrors.latestReturnDate &&
      departureDate &&
      latestReturnDate &&
      minDurationDays !== null
    ) {
      const minimumAllowedReturnDate = addDaysToIsoDate(departureDate, minDurationDays);
      if (minimumAllowedReturnDate > latestReturnDate) {
        nextErrors.latestReturnDate =
          "Latest return date must allow at least the minimum trip duration.";
      }
    }

    if (
      minDurationDays !== null &&
      maxDurationDays !== null &&
      maxDurationDays < minDurationDays
    ) {
      nextErrors.durationMaxDays =
        "Maximum duration must be greater than or equal to minimum duration.";
    }

    if (
      minStopDurationDays !== null &&
      maxStopDurationDays !== null &&
      maxStopDurationDays < minStopDurationDays
    ) {
      nextErrors.stopDurationMaxDays =
        "Maximum stop duration must be greater than or equal to minimum stop duration.";
    }

    return nextErrors;
  }

  function revalidateCompositeFields(
    form: HTMLFormElement | null,
    nextReturnOriginMode = returnOriginMode
  ) {
    if (!form) {
      return;
    }

    const compositeErrors = collectCompositeErrors(new FormData(form), nextReturnOriginMode);
    setErrors((current) => ({
      ...current,
      latestReturnDate: compositeErrors.latestReturnDate ?? "",
      durationMaxDays: compositeErrors.durationMaxDays ?? "",
      stopDurationMaxDays: compositeErrors.stopDurationMaxDays ?? "",
      returnOriginCity: compositeErrors.returnOriginCity ?? ""
    }));
  }

  function handleBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const field = event.currentTarget;
    normalizeField(field);
    const fieldName = field.name;
    const fieldValue = field.value;
    const error = validateField(fieldName, fieldValue);

    setErrors((current) => ({
      ...current,
      [fieldName]: error ?? ""
    }));
  }

  function handleCompositeBlur(event: FocusEvent<HTMLInputElement>) {
    revalidateCompositeFields(event.currentTarget.form);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextReturnOriginMode = String(formData.get("returnOriginMode") ?? returnOriginMode);
    const nextErrors: FieldErrors = {};

    for (const field of [
      "originAirport",
      "outboundDestinationCity",
      "returnDestinationAirport",
      "returnOriginCity"
    ]) {
      const value = String(formData.get(field) ?? "");
      const error = validateField(field, value, nextReturnOriginMode);
      if (error) {
        nextErrors[field] = error;
      }
    }

    Object.assign(nextErrors, collectCompositeErrors(formData, nextReturnOriginMode));

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault();
      setErrors(nextErrors);
    } else {
      setErrors({});
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-8 rounded-[28px] border border-line bg-white p-8 shadow-sm">
      {defaults?.sessionId ? <input type="hidden" name="sessionId" value={defaults.sessionId} /> : null}

      {formError ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4">
          <p className="text-sm font-semibold text-rose-700">Review the session details and try again.</p>
          <p className="mt-1 text-sm leading-6 text-rose-700">{formError}</p>
        </section>
      ) : null}

      <datalist id={airportListId}>
        {airportCatalog.map((airport) => (
          <option
            key={airport.code}
            value={`${airport.displayName} (${airport.code})`}
            label={`${airport.cityName}, ${airport.country}`}
          />
        ))}
      </datalist>

      <datalist id={cityListId}>
        {cityCatalog.map((city) => (
          <option key={city.code} value={city.displayName} label={`${city.code}, ${city.country}`} />
        ))}
      </datalist>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Session name</span>
          <input
            required
            name="name"
            defaultValue={textValue(defaults?.name)}
            className={inputClass()}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Search intensity</span>
          <select
            name="searchIntensity"
            defaultValue={defaults?.searchIntensity ?? "balanced"}
            className={inputClass()}
          >
            {searchIntensities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Refresh every (hours)</span>
          <input
            required
            type="number"
            min={refreshIntervalBounds.min}
            max={refreshIntervalBounds.max}
            name="refreshIntervalHours"
            defaultValue={defaults?.refreshIntervalHours ?? getDefaultRefreshIntervalHours()}
            className={inputClass()}
          />
          <p className="text-xs text-slate-500">
            Live sessions queue a full monitoring run on this cadence. Default is every 12 hours.
          </p>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Origin airport</span>
          <input
            required
            name="originAirport"
            list={airportListId}
            defaultValue={textValue(defaults?.originAirport)}
            onBlur={handleBlur}
            className={`${inputClass(errors.originAirport)} uppercase`}
          />
          {errors.originAirport ? (
            <p className="text-sm text-rose-700">{errors.originAirport}</p>
          ) : (
            <p className="text-xs text-slate-500">Type an airport name or code, for example MEL or Melbourne.</p>
          )}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Outbound destination city</span>
          <input
            required
            name="outboundDestinationCity"
            list={cityListId}
            defaultValue={textValue(defaults?.outboundDestinationCity)}
            onBlur={handleBlur}
            className={inputClass(errors.outboundDestinationCity)}
          />
          {errors.outboundDestinationCity ? (
            <p className="text-sm text-rose-700">{errors.outboundDestinationCity}</p>
          ) : (
            <p className="text-xs text-slate-500">Type a city name, for example Guangzhou or Shanghai.</p>
          )}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Return destination airport</span>
          <input
            required
            name="returnDestinationAirport"
            list={airportListId}
            defaultValue={textValue(defaults?.returnDestinationAirport)}
            onBlur={handleBlur}
            className={`${inputClass(errors.returnDestinationAirport)} uppercase`}
          />
          {errors.returnDestinationAirport ? (
            <p className="text-sm text-rose-700">{errors.returnDestinationAirport}</p>
          ) : (
            <p className="text-xs text-slate-500">Type an airport name or code, for example MEL or Sydney.</p>
          )}
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Earliest departure date</span>
          <input
            required
            type="date"
            name="departureStartDate"
            defaultValue={textValue(defaults?.departureStartDate)}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              setDepartureStartDate(event.currentTarget.value);
              if (errors.latestReturnDate) {
                revalidateCompositeFields(event.currentTarget.form);
              }
            }}
            className={inputClass()}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Latest return date</span>
          <input
            required
            type="date"
            name="latestReturnDate"
            defaultValue={textValue(defaults?.latestReturnDate)}
            min={minimumReturnDate || undefined}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              if (errors.latestReturnDate) {
                revalidateCompositeFields(event.currentTarget.form);
              }
            }}
            className={inputClass(errors.latestReturnDate)}
          />
          {errors.latestReturnDate ? (
            <p className="text-sm text-rose-700">{errors.latestReturnDate}</p>
          ) : minimumReturnDate ? (
            <p className="text-xs text-slate-500">
              Must be on or after {minimumReturnDate} based on the earliest departure and minimum duration.
            </p>
          ) : null}
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Min duration days</span>
          <input
            required
            type="number"
            min={1}
            name="durationMinDays"
            defaultValue={defaults?.durationMinDays ?? 14}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              setDurationMinDays(event.currentTarget.value);
              revalidateCompositeFields(event.currentTarget.form);
            }}
            className={inputClass()}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Max duration days</span>
          <input
            required
            type="number"
            min={1}
            name="durationMaxDays"
            defaultValue={defaults?.durationMaxDays ?? 28}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              if (errors.durationMaxDays) {
                revalidateCompositeFields(event.currentTarget.form);
              }
            }}
            className={inputClass(errors.durationMaxDays)}
          />
          {errors.durationMaxDays ? (
            <p className="text-sm text-rose-700">{errors.durationMaxDays}</p>
          ) : null}
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Return origin mode</span>
          <select
            name="returnOriginMode"
            defaultValue={defaults?.returnOriginMode ?? "any_mainland_city"}
            onChange={(event) => {
              const nextMode = event.currentTarget.value;
              setReturnOriginMode(nextMode);
              setErrors((current) => ({
                ...current,
                returnOriginCity: validateField(
                  "returnOriginCity",
                  String(
                    (event.currentTarget.form?.elements.namedItem("returnOriginCity") as HTMLInputElement | null)
                      ?.value ?? ""
                  ),
                  nextMode
                ) ?? ""
              }));
            }}
            className={inputClass()}
          >
            <option value="any_mainland_city">Any mainland city</option>
            <option value="fixed_city">Fixed city</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Fixed return origin city</span>
          <input
            name="returnOriginCity"
            list={cityListId}
            defaultValue={textValue(defaults?.returnOriginCity)}
            onBlur={handleBlur}
            className={inputClass(errors.returnOriginCity)}
          />
          {errors.returnOriginCity ? (
            <p className="text-sm text-rose-700">{errors.returnOriginCity}</p>
          ) : (
            <p className="text-xs text-slate-500">
              {returnOriginMode === "fixed_city"
                ? "Required when return mode is fixed city."
                : "Optional unless you switch return mode to fixed city."}
            </p>
          )}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Max stops</span>
          <input
            required
            type="number"
            min={0}
            max={2}
            name="maxStops"
            defaultValue={defaults?.maxStops ?? 1}
            className={inputClass()}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Booking mode</span>
          <select
            name="bookingMode"
            defaultValue={defaults?.bookingMode ?? "both"}
            className={inputClass()}
          >
            {bookingModes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Flight constraints</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Apply hard filters before FlyEasy keeps or expands a Trip.com result card.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex gap-3 rounded-[24px] border border-line bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              name="requireIncludedCheckedBaggage"
              defaultChecked={defaults?.requireIncludedCheckedBaggage ?? false}
              className="mt-1 h-4 w-4 rounded border-line text-sea focus:ring-sea"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">
                Only include flights with checked baggage included
              </span>
              <span className="block text-xs leading-6 text-slate-500">
                FlyEasy will only keep Trip.com cards that explicitly show included checked baggage on the result card.
              </span>
            </span>
          </label>

          <label className="flex gap-3 rounded-[24px] border border-line bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              name="restrictToChineseAirlines"
              defaultChecked={defaults?.restrictToChineseAirlines ?? false}
              className="mt-1 h-4 w-4 rounded border-line text-sea focus:ring-sea"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">
                Only include Chinese-based airlines
              </span>
              <span className="block text-xs leading-6 text-slate-500">
                FlyEasy will only keep cards whose marketed or operating airline matches the mainland China carrier list, such as Air China, China Eastern, China Southern, Hainan, Shenzhen, Sichuan, Juneyao, Spring, XiamenAir, Shandong, and related mainland affiliates.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Min stop duration days</span>
          <input
            required
            type="number"
            min={0}
            max={30}
            name="stopDurationMinDays"
            defaultValue={defaults?.stopDurationMinDays ?? 0}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              if (errors.stopDurationMaxDays) {
                revalidateCompositeFields(event.currentTarget.form);
              }
            }}
            className={inputClass()}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Max stop duration days</span>
          <input
            required
            type="number"
            min={0}
            max={30}
            name="stopDurationMaxDays"
            defaultValue={defaults?.stopDurationMaxDays ?? 5}
            onBlur={handleCompositeBlur}
            onChange={(event) => {
              if (errors.stopDurationMaxDays) {
                revalidateCompositeFields(event.currentTarget.form);
              }
            }}
            className={inputClass(errors.stopDurationMaxDays)}
          />
          {errors.stopDurationMaxDays ? (
            <p className="text-sm text-rose-700">{errors.stopDurationMaxDays}</p>
          ) : null}
        </label>
      </section>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          defaultValue={textValue(defaults?.notes)}
          rows={5}
          className="w-full rounded-[24px] border border-line px-4 py-3 text-sm outline-none transition focus:border-sea"
        />
      </label>

      <div className="flex items-center justify-end gap-3">
        {secondaryAction && secondaryLabel ? (
          <button
            type="submit"
            formAction={secondaryAction}
            className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sea hover:text-sea"
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="submit"
          className="rounded-full bg-sea px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
