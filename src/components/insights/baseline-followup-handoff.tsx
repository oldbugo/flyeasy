export type BaselineReturnOptionExpansionSummary = {
  expandedCandidateCount?: number;
  expandedFamilyCount?: number;
  expandedQueryCount?: number;
  familyResults?: Array<{
    discoveredStopoverCities?: Array<{
      cityCode: string;
      cityName: string;
    }>;
    discoveredStopoverCityCount?: number;
    executedCount?: number;
    familyKey: string;
    isSaturated?: boolean;
    repeatedNoNewInsightCount?: number;
  }>;
  plannedTargetCount?: number;
};

export type BaselineFollowupHandoffSummary = {
  baselineCheapestPrice?: number | null;
  candidateFamilies?: Array<{
    anchorMatches?: string[];
    baselinePriceDelta?: number | null;
    candidateCount?: number;
    candidateFamilyId: string;
    cheapestPrice?: number | null;
    departDates?: string[];
    discoverySources?: string[];
    familyKey: string;
    outboundAirlines?: string[];
    rationale?: string[];
    recommendedFollowups?: string[];
    returnAirlines?: string[];
    returnDates?: string[];
    score?: number;
    stopCount?: number;
    stopoverCities?: Array<{
      baselinePriceDelta?: number | null;
      cheapestPrice?: number | null;
      cityCode: string;
      cityName: string;
      discoverySources?: string[];
      longestStopDurationHours?: number | null;
      observationCount?: number;
    }>;
  }>;
  cityDateAirlineMatrix?: Array<{
    baselinePriceDelta?: number | null;
    cheapestPrice?: number | null;
    cityCode: string;
    cityName: string;
    departureDate?: string | null;
    discoverySources?: string[];
    familyCount?: number;
    outboundAirline?: string | null;
    returnAirline?: string | null;
    returnDate?: string | null;
  }>;
  cityEntryFindings?: Array<{
    baselinePriceDelta?: number | null;
    bestDepartDate?: string | null;
    bestFamilyKey?: string | null;
    bestOutboundAirline?: string | null;
    bestReturnAirline?: string | null;
    bestReturnDate?: string | null;
    cheapestPrice?: number | null;
    cityCode: string;
    cityName: string;
    discoverySources?: string[];
    familyCount?: number;
  }>;
  recommendedFamilyCount?: number;
  totalCandidateFamilyCount?: number;
};

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `AUD ${value.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatCount(value: number | undefined, singular: string, plural = `${singular}s`) {
  const count = Number(value ?? 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function SummaryCard(props: {
  detail: string;
  label: string;
  meta: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sea">{props.label}</p>
      <p className="mt-3 text-lg font-semibold text-ink">{props.value}</p>
      <p className="mt-2 text-sm text-slate-600">{props.meta}</p>
      <p className="mt-3 text-sm leading-7 text-slate-500">{props.detail}</p>
    </div>
  );
}

export function BaselineHandoffSummary({
  expansionSummary,
  handoffSummary
}: {
  expansionSummary: BaselineReturnOptionExpansionSummary | null | undefined;
  handoffSummary: BaselineFollowupHandoffSummary | null | undefined;
}) {
  const topFamily = handoffSummary?.candidateFamilies?.[0] ?? null;
  const topExpansionFamily = expansionSummary?.familyResults?.[0] ?? null;
  const topCityEntry = handoffSummary?.cityEntryFindings?.[0] ?? null;
  const topExpansionCities =
    topExpansionFamily?.discoveredStopoverCities?.map((entry) => entry.cityCode).join(", ") ??
    "None yet";

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <SummaryCard
        label="Expanded baseline families"
        value={Number(expansionSummary?.expandedFamilyCount ?? 0)}
        meta={`${formatCount(expansionSummary?.expandedQueryCount, "query")} | planned ${Number(expansionSummary?.plannedTargetCount ?? 0)} target${Number(expansionSummary?.plannedTargetCount ?? 0) === 1 ? "" : "s"}`}
        detail={`Top family discovered stopover clues: ${topExpansionCities}.`}
      />
      <SummaryCard
        label="Follow-up ready families"
        value={Number(handoffSummary?.recommendedFamilyCount ?? 0)}
        meta={`${formatCount(handoffSummary?.totalCandidateFamilyCount, "family candidate")} in the baseline handoff`}
        detail={
          topFamily
            ? `${topFamily.outboundAirlines?.[0] ?? "Unknown"} | ${formatCurrency(topFamily.cheapestPrice)} | next ${topFamily.recommendedFollowups?.slice(0, 2).join(", ")}`
            : "The baseline handoff shortlist will appear here after analysis runs."
        }
      />
      <SummaryCard
        label="Cheapest city entry"
        value={topCityEntry ? `${topCityEntry.cityName} (${topCityEntry.cityCode})` : "Not recorded"}
        meta={
          topCityEntry
            ? `${formatCurrency(topCityEntry.cheapestPrice)} | delta ${formatCurrency(topCityEntry.baselinePriceDelta ?? null)}`
            : "Waiting for baseline city-entry evidence"
        }
        detail={
          topCityEntry
            ? `${topCityEntry.bestDepartDate ?? "Undated"} -> ${topCityEntry.bestReturnDate ?? "Undated"} | ${[topCityEntry.bestOutboundAirline, topCityEntry.bestReturnAirline].filter(Boolean).join(" / ") || "Unknown carrier"}`
            : "The baseline city-entry board will appear here after analysis runs."
        }
      />
    </section>
  );
}

export function BaselineHandoffDetails({
  expansionSummary,
  handoffSummary
}: {
  expansionSummary: BaselineReturnOptionExpansionSummary | null | undefined;
  handoffSummary: BaselineFollowupHandoffSummary | null | undefined;
}) {
  const families = handoffSummary?.candidateFamilies ?? [];
  const familyCoverageRows = expansionSummary?.familyResults ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[18px] bg-mist px-4 py-4">
        <p className="text-sm font-semibold text-ink">Return-option expansion coverage</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatCount(expansionSummary?.expandedQueryCount, "query")} across{" "}
          {formatCount(expansionSummary?.expandedFamilyCount, "family")} from{" "}
          {Number(expansionSummary?.plannedTargetCount ?? 0)} planned target
          {Number(expansionSummary?.plannedTargetCount ?? 0) === 1 ? "" : "s"}.
        </p>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {familyCoverageRows.length > 0 ? (
            familyCoverageRows.slice(0, 5).map((entry) => (
              <div key={entry.familyKey} className="rounded-[16px] bg-white px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{entry.familyKey}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      entry.isSaturated
                        ? "bg-slate-200 text-slate-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {entry.isSaturated ? "saturated" : "active"}
                  </span>
                </div>
                <p className="mt-1">
                  {formatCount(entry.executedCount, "probe")} | discovered{" "}
                  {formatCount(entry.discoveredStopoverCityCount, "city")}
                </p>
                <p className="mt-1">
                  {(entry.discoveredStopoverCities ?? [])
                    .map((city) => `${city.cityName} (${city.cityCode})`)
                    .join(", ") || "No new stopover clues"}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No return-option expansion coverage has been recorded yet.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[18px] bg-mist px-4 py-4">
        <p className="text-sm font-semibold text-ink">Baseline follow-up candidates</p>
        <p className="mt-1 text-xs text-slate-500">
          These family-level candidates are the baseline handoff for later strategy clusters.
        </p>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {families.length > 0 ? (
            families.slice(0, 6).map((family) => (
              <div key={family.candidateFamilyId} className="rounded-[16px] bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-ink">
                    {(family.outboundAirlines ?? []).join(", ") || "Unknown airline"}
                  </p>
                  <p className="font-semibold text-ink">{formatCurrency(family.cheapestPrice)}</p>
                </div>
                <p className="mt-1">
                  {formatCount(family.candidateCount, "candidate")} | {formatCount(family.stopCount, "stop")}
                  {family.stopoverCities?.length
                    ? ` | stopover clues ${family.stopoverCities.map((entry) => entry.cityCode).join(", ")}`
                    : " | no stopover city captured yet"}
                </p>
                <p className="mt-1">
                  Next: {(family.recommendedFollowups ?? []).join(", ")}
                </p>
                <p className="mt-1">
                  Departures {(family.departDates ?? []).slice(0, 3).join(", ") || "not recorded"}
                  {(family.anchorMatches ?? []).length
                    ? ` | anchor overlap ${(family.anchorMatches ?? []).join(", ")}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(family.discoverySources ?? []).map((source) => (
                    <span
                      key={`${family.candidateFamilyId}-${source}`}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700"
                    >
                      {source}
                    </span>
                  ))}
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {(family.rationale ?? []).slice(0, 2).map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
              No baseline handoff candidates have been recorded yet.
            </p>
          )}
        </div>
      </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[18px] bg-mist px-4 py-4">
          <p className="text-sm font-semibold text-ink">Cheapest city-entry board</p>
          <p className="mt-1 text-xs text-slate-500">
            These are the cheapest baseline contexts in which each stopover city appears.
          </p>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {(handoffSummary?.cityEntryFindings ?? []).slice(0, 6).map((entry) => (
              <div key={entry.cityCode} className="rounded-[16px] bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-ink">
                    {entry.cityName} ({entry.cityCode})
                  </p>
                  <p className="font-semibold text-ink">{formatCurrency(entry.cheapestPrice)}</p>
                </div>
                <p className="mt-1">
                  Delta from baseline cheapest {formatCurrency(entry.baselinePriceDelta ?? null)} | seen in{" "}
                  {formatCount(entry.familyCount, "family")}
                </p>
                <p className="mt-1">
                  {entry.bestDepartDate ?? "Undated"} {"->"} {entry.bestReturnDate ?? "Undated"} |{" "}
                  {[entry.bestOutboundAirline, entry.bestReturnAirline].filter(Boolean).join(" / ") || "Unknown carrier"}
                </p>
              </div>
            ))}
            {!handoffSummary?.cityEntryFindings?.length ? (
              <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                No city-entry board has been recorded yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[18px] bg-mist px-4 py-4">
          <p className="text-sm font-semibold text-ink">City x date x airline matrix</p>
          <p className="mt-1 text-xs text-slate-500">
            This matrix compresses the strongest city/date/airline combinations from the baseline handoff.
          </p>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {(handoffSummary?.cityDateAirlineMatrix ?? []).slice(0, 6).map((entry) => (
              <div
                key={`${entry.cityCode}-${entry.departureDate ?? "na"}-${entry.returnDate ?? "na"}-${entry.outboundAirline ?? "na"}`}
                className="rounded-[16px] bg-white px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-ink">
                    {entry.cityName} ({entry.cityCode})
                  </p>
                  <p className="font-semibold text-ink">{formatCurrency(entry.cheapestPrice)}</p>
                </div>
                <p className="mt-1">
                  {entry.departureDate ?? "Undated"} {"->"} {entry.returnDate ?? "Undated"} |{" "}
                  {[entry.outboundAirline, entry.returnAirline].filter(Boolean).join(" / ") || "Unknown carrier"}
                </p>
                <p className="mt-1">
                  Delta {formatCurrency(entry.baselinePriceDelta ?? null)} | {formatCount(entry.familyCount, "family")}
                </p>
              </div>
            ))}
            {!handoffSummary?.cityDateAirlineMatrix?.length ? (
              <p className="rounded-[16px] bg-white px-3 py-3 text-sm text-slate-500">
                No city/date/airline matrix has been recorded yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
