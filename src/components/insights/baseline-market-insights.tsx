import type { ReactNode } from "react";

export type BaselineMarketSummary = {
  analysedCandidateCount?: number;
  analysedQueryCount?: number;
  airlineFindings?: Array<{
    airline: string;
    averagePrice?: number | null;
    candidateCount?: number;
    cheapestPrice?: number | null;
  }>;
  departureAirlineFindings?: Array<{
    airline: string;
    averagePrice?: number | null;
    candidateCount?: number;
    cheapestPrice?: number | null;
    departDate: string;
  }>;
  departureDateFindings?: Array<{
    averagePrice?: number | null;
    candidateCount?: number;
    cheapestPrice?: number | null;
    departDate: string;
    linkedQueryCount?: number;
    observedReturnDates?: string[];
  }>;
  recommendedDepartureAnchors?: Array<{
    cheapestPrice?: number | null;
    departDate: string;
    rationale?: string;
    sampledReturnDates?: string[];
  }>;
  stopoverCityFindings?: Array<{
    cheapestObservedPrice?: number | null;
    cityCode: string;
    cityName: string;
    observationCount?: number;
  }>;
};

type BaselineMarketInsightsProps = {
  summary: BaselineMarketSummary;
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `AUD ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatCountLabel(value: number | undefined, noun: string) {
  const count = Number(value ?? 0);
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getPriceBarWidth(values: Array<number | null | undefined>, current: number | null | undefined) {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (finiteValues.length === 0 || typeof current !== "number" || !Number.isFinite(current)) {
    return 0;
  }

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);

  if (minimum === maximum) {
    return 100;
  }

  const relative = (maximum - current) / (maximum - minimum);
  return 22 + relative * 78;
}

function InsightMetric(props: {
  description: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {props.label}
      </p>
      <p className="mt-2 text-xl font-semibold text-ink">{props.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.description}</p>
    </div>
  );
}

function InsightRow(props: {
  footer?: string;
  label: string;
  meta: string;
  price: number | null | undefined;
  priceValues: Array<number | null | undefined>;
}) {
  const width = getPriceBarWidth(props.priceValues, props.price);

  return (
    <div className="rounded-[16px] bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{props.label}</p>
          <p className="mt-1 text-xs text-slate-500">{props.meta}</p>
        </div>
        <p className="text-sm font-semibold text-ink">{formatCurrency(props.price)}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-sea transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      {props.footer ? <p className="mt-2 text-xs text-slate-500">{props.footer}</p> : null}
    </div>
  );
}

function InsightSection(props: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-[20px] bg-mist px-4 py-4">
      <p className="text-sm font-semibold text-ink">{props.title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{props.description}</p>
      <div className="mt-3 space-y-3">{props.children}</div>
    </div>
  );
}

export function BaselineMarketInsights({ summary }: BaselineMarketInsightsProps) {
  const departureDates = (summary.departureDateFindings ?? []).slice(0, 6);
  const airlines = (summary.airlineFindings ?? []).slice(0, 6);
  const dateAirlineCombos = (summary.departureAirlineFindings ?? []).slice(0, 6);
  const stopoverCities = (summary.stopoverCityFindings ?? []).slice(0, 4);
  const anchors = (summary.recommendedDepartureAnchors ?? []).slice(0, 4);
  const cheapestObservedFare = Math.min(
    ...[
      ...departureDates.map((entry) => entry.cheapestPrice ?? Number.POSITIVE_INFINITY),
      ...airlines.map((entry) => entry.cheapestPrice ?? Number.POSITIVE_INFINITY),
      ...dateAirlineCombos.map((entry) => entry.cheapestPrice ?? Number.POSITIVE_INFINITY)
    ]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightMetric
          label="Cheapest observed fare"
          value={formatCurrency(Number.isFinite(cheapestObservedFare) ? cheapestObservedFare : null)}
          description="Lowest fare seen across the baseline ranking tables."
        />
        <InsightMetric
          label="Queries analysed"
          value={Number(summary.analysedQueryCount ?? 0)}
          description="How many baseline date-pair searches fed this first market picture."
        />
        <InsightMetric
          label="Candidates extracted"
          value={Number(summary.analysedCandidateCount ?? 0)}
          description="How many priced candidates were captured from those baseline searches."
        />
        <InsightMetric
          label="Promoted anchors"
          value={anchors.length}
          description="Departure dates the planner currently considers strongest for deeper follow-up."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightSection
          title="Cheapest departure dates"
          description="Lower bars mean weaker value; fuller bars mean more affordable dates among the current baseline leaders."
        >
          {departureDates.length > 0 ? (
            departureDates.map((entry) => (
              <InsightRow
                key={entry.departDate}
                label={entry.departDate}
                meta={`${formatCountLabel(entry.candidateCount, "candidate")} | ${formatCountLabel(entry.linkedQueryCount, "query")}`}
                price={entry.cheapestPrice}
                priceValues={departureDates.map((value) => value.cheapestPrice)}
                footer={
                  entry.observedReturnDates?.length
                    ? `Observed with return dates ${entry.observedReturnDates.slice(0, 3).join(", ")}${entry.observedReturnDates.length > 3 ? "..." : ""}`
                    : undefined
                }
              />
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No departure-date evidence recorded yet.
            </p>
          )}
        </InsightSection>

        <InsightSection
          title="Cheapest airlines"
          description="This helps show whether one carrier is consistently cheap or only appears once."
        >
          {airlines.length > 0 ? (
            airlines.map((entry) => (
              <InsightRow
                key={entry.airline}
                label={entry.airline}
                meta={`${formatCountLabel(entry.candidateCount, "candidate")} | average ${formatCurrency(entry.averagePrice)}`}
                price={entry.cheapestPrice}
                priceValues={airlines.map((value) => value.cheapestPrice)}
              />
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No airline evidence recorded yet.
            </p>
          )}
        </InsightSection>

        <InsightSection
          title="Cheap date + airline combinations"
          description="This is usually the most useful next metric. Dates and airlines alone can mislead; this shows the specific pairing that is actually producing the price."
        >
          {dateAirlineCombos.length > 0 ? (
            dateAirlineCombos.map((entry) => (
              <InsightRow
                key={`${entry.departDate}-${entry.airline}`}
                label={`${entry.departDate} | ${entry.airline}`}
                meta={`${formatCountLabel(entry.candidateCount, "candidate")} | average ${formatCurrency(entry.averagePrice)}`}
                price={entry.cheapestPrice}
                priceValues={dateAirlineCombos.map((value) => value.cheapestPrice)}
              />
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No date-and-airline combination evidence recorded yet.
            </p>
          )}
        </InsightSection>

        <InsightSection
          title="Stopover city clues"
          description="Useful when the baseline is hinting at follow-on strategy opportunities beyond direct round-trip ranking."
        >
          {stopoverCities.length > 0 ? (
            stopoverCities.map((entry) => (
              <InsightRow
                key={entry.cityCode}
                label={`${entry.cityName} (${entry.cityCode})`}
                meta={formatCountLabel(entry.observationCount, "observation")}
                price={entry.cheapestObservedPrice}
                priceValues={stopoverCities.map((value) => value.cheapestObservedPrice)}
              />
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No stopover-city clues were recorded in the baseline scan.
            </p>
          )}
        </InsightSection>
      </div>

      {anchors.length > 0 ? (
        <InsightSection
          title="Promoted departure anchors"
          description="These are the departure dates the planner would carry forward into anchored follow-up work."
        >
          {anchors.map((entry) => (
            <div key={entry.departDate} className="rounded-[16px] bg-white px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{entry.departDate}</p>
                <p className="text-sm font-semibold text-ink">{formatCurrency(entry.cheapestPrice)}</p>
              </div>
              {entry.rationale ? (
                <p className="mt-2 text-xs leading-6 text-slate-500">{entry.rationale}</p>
              ) : null}
            </div>
          ))}
        </InsightSection>
      ) : null}
    </div>
  );
}
