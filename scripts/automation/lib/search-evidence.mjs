import crypto from "node:crypto";

function resolveCityLabel(resolveCityName, cityCode) {
  return typeof resolveCityName === "function" ? resolveCityName(cityCode) : cityCode;
}

const baselineStrategySourceLabels = {
  packaged_departure_anchor_followup: "Anchored departure follow-up",
  packaged_direct_sweep: "Direct sweep",
  packaged_return_option_expansion: "Return option expansion"
};

const baselineStrategySourceWeights = {
  packaged_departure_anchor_followup: 3,
  packaged_direct_sweep: 1,
  packaged_return_option_expansion: 4
};

function createDeterministicUnitInterval(seed) {
  const digest = crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 8);
  return parseInt(digest, 16) / 0xffffffff;
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readIsoDayBucket(dateValue, bucketSizeDays = 3) {
  if (!dateValue) {
    return "undated";
  }

  const timestamp = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(timestamp)) {
    return "undated";
  }

  return String(Math.floor(timestamp / (bucketSizeDays * 24 * 60 * 60_000)));
}

function resolveAirlineLabel(candidateRow, payload) {
  return payload?.airline ?? payload?.carrier ?? candidateRow?.carrier_code ?? "Unknown";
}

function formatDatePairLabel(departDate, returnDate) {
  if (departDate && returnDate) {
    return `${departDate} -> ${returnDate}`;
  }

  if (departDate) {
    return departDate;
  }

  return returnDate ?? "Undated";
}

export function collectRecordedStopoverEvidence({
  db,
  destinationCityCode,
  isMainlandChinaCity,
  resolveCityName,
  safeJsonParse,
  strategyId
}) {
  const rows = db
    .prepare(
      `select id, observed_stopover_cities_json, tripcom_result_url, query_input_json
       from query_execution
       where strategy_execution_id = ? and status = 'completed'
       order by priority asc`
    )
    .all(strategyId);
  const evidence = new Map();

  for (const row of rows) {
    const stopovers = safeJsonParse(row.observed_stopover_cities_json, []);
    const queryInput = safeJsonParse(row.query_input_json, {});

    for (const stopover of stopovers) {
      if (!stopover?.cityCode || !isMainlandChinaCity(stopover.cityCode)) {
        continue;
      }

      if (stopover.cityCode === destinationCityCode) {
        continue;
      }

      const price = Number(stopover.displayedPriceAmount ?? Number.POSITIVE_INFINITY);
      const existing = evidence.get(stopover.cityCode);

      if (!existing || price < existing.lowestObservedPrice) {
        evidence.set(stopover.cityCode, {
          cityCode: stopover.cityCode,
          cityName: stopover.cityName ?? resolveCityLabel(resolveCityName, stopover.cityCode),
          lowestObservedPrice: price,
          observationCount: (existing?.observationCount ?? 0) + 1,
          parentQueryExecutionId: row.id,
          queryInput,
          resultUrl: row.tripcom_result_url
        });
      } else {
        existing.observationCount += 1;
        evidence.set(stopover.cityCode, existing);
      }
    }
  }

  return [...evidence.values()].sort((left, right) => left.lowestObservedPrice - right.lowestObservedPrice);
}

export function buildPreferredSignalSets(analysisSnapshot) {
  const summary = analysisSnapshot?.summary ?? {};
  const preferredDepartureDates = Array.isArray(summary.departureDateFindings)
    ? summary.departureDateFindings
        .slice(0, 3)
        .map((entry) => entry?.departDate)
        .filter(Boolean)
    : [];
  const preferredReturnDates = Array.isArray(summary.departureDateFindings)
    ? summary.departureDateFindings
        .slice(0, 3)
        .flatMap((entry) =>
          Array.isArray(entry?.observedReturnDates) ? entry.observedReturnDates.slice(0, 3) : []
        )
        .filter(Boolean)
    : [];
  const preferredAirlines = Array.isArray(summary.airlineFindings)
    ? summary.airlineFindings
        .slice(0, 3)
        .map((entry) => entry?.airline)
        .filter(Boolean)
    : [];

  return {
    preferredAirlines,
    preferredAirlineSet: new Set(preferredAirlines.map((value) => String(value).toLowerCase())),
    preferredDepartureDates,
    preferredDepartureSet: new Set(preferredDepartureDates),
    preferredReturnDates: [...new Set(preferredReturnDates)],
    preferredReturnSet: new Set(preferredReturnDates)
  };
}

export function collectTopRoundTripCandidateEvidence({
  db,
  candidateLimit,
  destinationCityCode,
  isMainlandChinaCity,
  preferredSignals,
  resolveCityName,
  runId,
  safeJsonParse,
  strategyIds
}) {
  if (!Array.isArray(strategyIds) || strategyIds.length === 0 || candidateLimit <= 0) {
    return {
      reviewedCandidates: [],
      stopoverEvidence: []
    };
  }

  const strategyPlaceholders = strategyIds.map(() => "?").join(", ");
  const candidateRows = db
    .prepare(
      `select
         c.id as candidate_id,
         c.displayed_display_amount,
         cl.departure_at as outbound_departure_at,
         cl.carrier_code,
         cl.raw_leg_payload_json
       from itinerary_candidate c
       left join candidate_leg cl
         on cl.itinerary_candidate_id = c.id
        and cl.segment_group = 'outbound'
        and cl.leg_index = 0
       where c.search_run_id = ?
         and c.strategy_execution_id in (${strategyPlaceholders})
         and c.stop_count > 0
       order by c.displayed_display_amount asc
       limit ?`
    )
    .all(runId, ...strategyIds, candidateLimit);
  const candidateIds = candidateRows.map((row) => row.candidate_id);

  if (candidateIds.length === 0) {
    return {
      reviewedCandidates: [],
      stopoverEvidence: []
    };
  }

  const candidatePlaceholders = candidateIds.map(() => "?").join(", ");
  const stopoverRows = db
    .prepare(
      `select
         itinerary_candidate_id,
         city_code,
         airport_code,
         duration_minutes,
         is_intentional
       from candidate_stopover
       where itinerary_candidate_id in (${candidatePlaceholders})
       order by itinerary_candidate_id asc, stop_index asc`
    )
    .all(...candidateIds);
  const stopoversByCandidateId = new Map();

  for (const row of stopoverRows) {
    if (!row?.city_code || !isMainlandChinaCity(row.city_code) || row.city_code === destinationCityCode) {
      continue;
    }

    const current = stopoversByCandidateId.get(row.itinerary_candidate_id) ?? [];
    current.push(row);
    stopoversByCandidateId.set(row.itinerary_candidate_id, current);
  }

  const evidenceByCity = new Map();
  const reviewedCandidates = [];

  for (const candidate of candidateRows) {
    const rawLegPayload = safeJsonParse(candidate.raw_leg_payload_json, null);
    const airline =
      rawLegPayload?.airline ??
      rawLegPayload?.carrier ??
      candidate.carrier_code ??
      "Unknown";
    const departDate = candidate.outbound_departure_at
      ? String(candidate.outbound_departure_at).slice(0, 10)
      : null;
    const candidateStopovers = stopoversByCandidateId.get(candidate.candidate_id) ?? [];
    const uniqueCityCodes = new Set();

    reviewedCandidates.push({
      airline,
      candidateId: candidate.candidate_id,
      departDate,
      displayedAmount: Number(candidate.displayed_display_amount ?? Number.POSITIVE_INFINITY),
      stopoverCities: candidateStopovers.map((entry) => entry.city_code)
    });

    for (const stopover of candidateStopovers) {
      if (uniqueCityCodes.has(stopover.city_code)) {
        continue;
      }

      uniqueCityCodes.add(stopover.city_code);

      const existing = evidenceByCity.get(stopover.city_code) ?? {
        cheapestCandidatePrice: Number.POSITIVE_INFINITY,
        cityCode: stopover.city_code,
        cityName: resolveCityLabel(resolveCityName, stopover.city_code),
        longestStopDurationMinutes: 0,
        matchingAirlineCount: 0,
        matchingDepartureTrendCount: 0,
        reviewedCandidateCount: 0,
        sampleAirlines: new Set(),
        sampleDepartureDates: new Set(),
        totalIntentionalStopCount: 0
      };
      existing.cheapestCandidatePrice = Math.min(
        existing.cheapestCandidatePrice,
        Number(candidate.displayed_display_amount ?? Number.POSITIVE_INFINITY)
      );
      existing.longestStopDurationMinutes = Math.max(
        existing.longestStopDurationMinutes,
        Number(stopover.duration_minutes ?? 0)
      );
      existing.reviewedCandidateCount += 1;
      existing.totalIntentionalStopCount += Number(stopover.is_intentional ?? 0) > 0 ? 1 : 0;
      if (departDate) {
        existing.sampleDepartureDates.add(departDate);
        if (preferredSignals.preferredDepartureSet.has(departDate)) {
          existing.matchingDepartureTrendCount += 1;
        }
      }
      if (airline) {
        existing.sampleAirlines.add(airline);
        if (preferredSignals.preferredAirlineSet.has(String(airline).toLowerCase())) {
          existing.matchingAirlineCount += 1;
        }
      }
      evidenceByCity.set(stopover.city_code, existing);
    }
  }

  return {
    reviewedCandidates,
    stopoverEvidence: [...evidenceByCity.values()].map((entry) => ({
      ...entry,
      cheapestCandidatePrice: Number.isFinite(entry.cheapestCandidatePrice)
        ? entry.cheapestCandidatePrice
        : null,
      sampleAirlines: [...entry.sampleAirlines].slice(0, 3),
      sampleDepartureDates: [...entry.sampleDepartureDates].slice(0, 4)
    }))
  };
}

function scoreMultiCitySeed(seed) {
  const baselineDelta = Number(seed.baselinePriceDelta ?? Number.POSITIVE_INFINITY);
  const cheapnessScore = Number.isFinite(baselineDelta)
    ? Math.max(0, 24 - Math.floor(Math.max(0, baselineDelta) / 50))
    : 0;

  return (
    cheapnessScore +
    (seed.matchesPreferredDeparture ? 8 : 0) +
    (seed.matchesPreferredReturn ? 5 : 0) +
    (seed.matchesPreferredAirline ? 7 : 0) +
    Math.min(8, Number(seed.cityObservationCount ?? 0) * 2) +
    Math.min(6, Number(seed.intentionalStopCandidateCount ?? 0) * 2) +
    Math.min(6, Math.round(Number(seed.longestStopDurationMinutes ?? 0) / 180)) +
    Number(seed.discoveryConfidence ?? 0)
  );
}

function orderSeedGroupsForReview(seedGroups, runSeed) {
  const sorted = [...seedGroups].sort((left, right) => {
    if (left.cheapestPrice !== right.cheapestPrice) {
      return left.cheapestPrice - right.cheapestPrice;
    }

    return String(left?.groupKey ?? "").localeCompare(String(right?.groupKey ?? ""));
  });
  const ordered = [];
  const chunkSize = 3;

  for (let index = 0; index < sorted.length; index += chunkSize) {
    const chunk = sorted.slice(index, index + chunkSize);
    chunk.sort((left, right) => {
      const leftWeight = createDeterministicUnitInterval(`${runSeed}:${left.groupKey}`);
      const rightWeight = createDeterministicUnitInterval(`${runSeed}:${right.groupKey}`);
      return leftWeight - rightWeight;
    });
    ordered.push(...chunk);
  }

  return ordered;
}

function buildMultiCitySeedReviewQueue(seedEntries, limit, runSeed) {
  if (!Array.isArray(seedEntries) || seedEntries.length === 0 || limit <= 0) {
    return [];
  }

  const groupMap = new Map();

  for (const seed of seedEntries) {
    const groupKey = `${seed.cityCode}::${seed.candidateFamilyId}`;
    const groupEntry = groupMap.get(groupKey) ?? {
      cheapestPrice: Number(seed.cheapestPrice ?? Number.POSITIVE_INFINITY),
      groupKey,
      members: [],
      usedDateBuckets: new Set()
    };
    groupEntry.cheapestPrice = Math.min(
      groupEntry.cheapestPrice,
      Number(seed.cheapestPrice ?? Number.POSITIVE_INFINITY)
    );
    groupEntry.members.push(seed);
    groupMap.set(groupKey, groupEntry);
  }

  const orderedGroups = orderSeedGroupsForReview([...groupMap.values()], runSeed).map((group) => ({
    ...group,
    members: [...group.members].sort((left, right) => {
      if (right.seedScore !== left.seedScore) {
        return right.seedScore - left.seedScore;
      }

      const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return (
        createDeterministicUnitInterval(`${runSeed}:${group.groupKey}:${left.seedKey}`) -
        createDeterministicUnitInterval(`${runSeed}:${group.groupKey}:${right.seedKey}`)
      );
    })
  }));

  const selected = [];
  const selectedSeedKeys = new Set();
  let allowRepeatDateBuckets = false;

  while (selected.length < limit) {
    let addedInRound = false;

    for (const group of orderedGroups) {
      const preferredSeed = group.members.find((seed) => {
        if (selectedSeedKeys.has(seed.seedKey)) {
          return false;
        }

        if (allowRepeatDateBuckets) {
          return true;
        }

        const dateBucket = `${readIsoDayBucket(seed.departDate)}::${readIsoDayBucket(seed.returnDate)}`;
        return !group.usedDateBuckets.has(dateBucket);
      });

      if (!preferredSeed) {
        continue;
      }

      const dateBucket = `${readIsoDayBucket(preferredSeed.departDate)}::${readIsoDayBucket(preferredSeed.returnDate)}`;
      group.usedDateBuckets.add(dateBucket);
      selectedSeedKeys.add(preferredSeed.seedKey);
      selected.push(preferredSeed);
      addedInRound = true;

      if (selected.length >= limit) {
        break;
      }
    }

    if (selected.length >= limit) {
      break;
    }

    if (!addedInRound && allowRepeatDateBuckets) {
      break;
    }

    if (!addedInRound) {
      allowRepeatDateBuckets = true;
    }
  }

  return selected;
}

function selectTopSeedContextsForCity(seedContexts, limit, runSeed) {
  if (!Array.isArray(seedContexts) || seedContexts.length === 0 || limit <= 0) {
    return [];
  }

  const familyMap = new Map();

  for (const seed of seedContexts) {
    const familyEntry = familyMap.get(seed.candidateFamilyId) ?? {
      cheapestPrice: Number(seed.cheapestPrice ?? Number.POSITIVE_INFINITY),
      familyKey: seed.candidateFamilyId,
      members: [],
      usedDateBuckets: new Set()
    };
    familyEntry.cheapestPrice = Math.min(
      familyEntry.cheapestPrice,
      Number(seed.cheapestPrice ?? Number.POSITIVE_INFINITY)
    );
    familyEntry.members.push(seed);
    familyMap.set(seed.candidateFamilyId, familyEntry);
  }

  const orderedFamilies = orderSeedGroupsForReview([...familyMap.values()], `${runSeed}:city`).map(
    (family) => ({
      ...family,
      members: [...family.members].sort((left, right) => {
        if (right.seedScore !== left.seedScore) {
          return right.seedScore - left.seedScore;
        }

        const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
        const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return (
          createDeterministicUnitInterval(`${runSeed}:${family.familyKey}:${left.seedKey}`) -
          createDeterministicUnitInterval(`${runSeed}:${family.familyKey}:${right.seedKey}`)
        );
      })
    })
  );

  const selected = [];
  const selectedSeedKeys = new Set();
  let allowRepeatDateBuckets = false;

  while (selected.length < limit) {
    let addedInRound = false;

    for (const family of orderedFamilies) {
      const preferredSeed = family.members.find((seed) => {
        if (selectedSeedKeys.has(seed.seedKey)) {
          return false;
        }

        if (allowRepeatDateBuckets) {
          return true;
        }

        const dateBucket = `${readIsoDayBucket(seed.departDate)}::${readIsoDayBucket(seed.returnDate)}`;
        return !family.usedDateBuckets.has(dateBucket);
      });

      if (!preferredSeed) {
        continue;
      }

      const dateBucket = `${readIsoDayBucket(preferredSeed.departDate)}::${readIsoDayBucket(preferredSeed.returnDate)}`;
      family.usedDateBuckets.add(dateBucket);
      selectedSeedKeys.add(preferredSeed.seedKey);
      selected.push(preferredSeed);
      addedInRound = true;

      if (selected.length >= limit) {
        break;
      }
    }

    if (selected.length >= limit) {
      break;
    }

    if (!addedInRound && allowRepeatDateBuckets) {
      break;
    }

    if (!addedInRound) {
      allowRepeatDateBuckets = true;
    }
  }

  return selected;
}

export function buildMultiCityVerificationSeedBoard({
  anchorDates,
  candidateReviewLimit,
  db,
  destinationCityCode,
  preferredSignals,
  resolveCityName,
  runSeed,
  safeJsonParse,
  strategyIds
}) {
  const baselineEvidence = collectBaselineFamilyCityEvidence({
    anchorDates,
    db,
    destinationCityCode,
    resolveCityName,
    safeJsonParse,
    strategyIds
  });

  const reviewedSeeds = buildMultiCitySeedReviewQueue(
    baselineEvidence.seedEntries.map((seed) => {
      const outboundAirline = String(seed.outboundAirline ?? "");
      const returnAirline = String(seed.returnAirline ?? "");
      const matchesPreferredAirline =
        preferredSignals.preferredAirlineSet.has(outboundAirline.toLowerCase()) ||
        preferredSignals.preferredAirlineSet.has(returnAirline.toLowerCase());
      const matchesPreferredDeparture =
        seed.departDate && preferredSignals.preferredDepartureSet.has(seed.departDate);
      const matchesPreferredReturn = seed.returnDate && preferredSignals.preferredReturnSet.has(seed.returnDate);

      return {
        ...seed,
        matchesPreferredAirline,
        matchesPreferredDeparture,
        matchesPreferredReturn,
        seedScore: scoreMultiCitySeed({
          ...seed,
          matchesPreferredAirline,
          matchesPreferredDeparture,
          matchesPreferredReturn
        })
      };
    }),
    candidateReviewLimit,
    runSeed
  );

  return {
    baselineCheapestPrice: baselineEvidence.baselineCheapestPrice,
    cityDateAirlineMatrix: baselineEvidence.cityDateAirlineMatrix,
    cityEntryFindings: baselineEvidence.cityEntryFindings,
    reviewedSeeds,
    totalAvailableSeedCount: baselineEvidence.seedEntries.length
  };
}

export function buildMultiCityVerificationEvidence({
  baselineCheapestPrice,
  candidateReviewLimit,
  preferredSignals,
  queryEvidence,
  resolveCityName,
  reviewedSeeds
}) {
  const queryEvidenceByCity = new Map(queryEvidence.map((entry) => [entry.cityCode, entry]));
  const cityEvidence = new Map();

  for (const seed of reviewedSeeds ?? []) {
    const existing = cityEvidence.get(seed.cityCode) ?? {
      baselineCheapestPrice: baselineCheapestPrice ?? null,
      bestSeedScore: Number.NEGATIVE_INFINITY,
      cheapestSeedPrice: Number.POSITIVE_INFINITY,
      cityCode: seed.cityCode,
      cityName: resolveCityLabel(resolveCityName, seed.cityCode),
      familyIds: new Set(),
      longestStopDurationMinutes: 0,
      matchingAirlineCount: 0,
      matchingDepartureTrendCount: 0,
      matchingReturnTrendCount: 0,
      reviewedSeedCount: 0,
      sampleAirlines: new Set(),
      sampleDepartureDates: new Set(),
      seedContexts: [],
      totalIntentionalStopCount: 0
    };

    existing.reviewedSeedCount += 1;
    existing.familyIds.add(seed.candidateFamilyId);
    existing.cheapestSeedPrice = Math.min(
      existing.cheapestSeedPrice,
      Number(seed.cheapestPrice ?? Number.POSITIVE_INFINITY)
    );
    existing.longestStopDurationMinutes = Math.max(
      existing.longestStopDurationMinutes,
      Number(seed.longestStopDurationMinutes ?? 0)
    );
    existing.totalIntentionalStopCount += Number(seed.intentionalStopCandidateCount ?? 0);
    if (seed.matchesPreferredDeparture) {
      existing.matchingDepartureTrendCount += 1;
    }
    if (seed.matchesPreferredReturn) {
      existing.matchingReturnTrendCount += 1;
    }
    if (seed.matchesPreferredAirline) {
      existing.matchingAirlineCount += 1;
    }
    if (seed.outboundAirline) {
      existing.sampleAirlines.add(seed.outboundAirline);
    }
    if (seed.returnAirline) {
      existing.sampleAirlines.add(seed.returnAirline);
    }
    if (seed.departDate) {
      existing.sampleDepartureDates.add(seed.departDate);
    }
    existing.seedContexts.push(seed);
    existing.bestSeedScore = Math.max(existing.bestSeedScore, Number(seed.seedScore ?? 0));
    cityEvidence.set(seed.cityCode, existing);
  }

  const rankedEvidence = [];

  for (const [cityCode, entry] of cityEvidence.entries()) {
    const queryEntry = queryEvidenceByCity.get(cityCode);
    const cheapestSeedPrice = Number(entry.cheapestSeedPrice ?? Number.POSITIVE_INFINITY);
    const baselinePriceDelta =
      typeof baselineCheapestPrice === "number" && Number.isFinite(baselineCheapestPrice)
        ? Math.max(0, cheapestSeedPrice - baselineCheapestPrice)
        : null;
    const cheapnessScore =
      typeof baselinePriceDelta === "number"
        ? Math.max(0, 20 - Math.floor(Math.max(0, baselinePriceDelta) / 50))
        : 0;
    const score =
      Number(entry.bestSeedScore ?? 0) +
      entry.reviewedSeedCount * 4 +
      entry.familyIds.size * 5 +
      entry.matchingDepartureTrendCount * 4 +
      entry.matchingReturnTrendCount * 2 +
      entry.matchingAirlineCount * 3 +
      Math.min(6, entry.totalIntentionalStopCount * 2) +
      cheapnessScore +
      Number(queryEntry?.observationCount ?? 0);
    const orderedSeedContexts = [...entry.seedContexts].sort((left, right) => {
      if (right.seedScore !== left.seedScore) {
        return right.seedScore - left.seedScore;
      }

      const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }

      return String(left?.seedKey ?? "").localeCompare(String(right?.seedKey ?? ""));
    });

    if (!queryEntry?.resultUrl && orderedSeedContexts.length === 0) {
      continue;
    }

    rankedEvidence.push({
      baselinePriceDelta,
      candidateReviewLimit,
      cheapestCandidatePrice: Number.isFinite(cheapestSeedPrice) ? cheapestSeedPrice : null,
      cityCode,
      cityName:
        queryEntry?.cityName ?? entry.cityName ?? resolveCityLabel(resolveCityName, cityCode),
      familyCount: entry.familyIds.size,
      longestStopDurationMinutes: entry.longestStopDurationMinutes,
      lowestObservedPrice: queryEntry?.lowestObservedPrice ?? null,
      matchingAirlineCount: entry.matchingAirlineCount,
      matchingDepartureTrendCount: entry.matchingDepartureTrendCount,
      matchingReturnTrendCount: entry.matchingReturnTrendCount,
      observationCount: queryEntry?.observationCount ?? 0,
      preferredAirlines: preferredSignals.preferredAirlines,
      preferredDepartureDates: preferredSignals.preferredDepartureDates,
      preferredReturnDates: preferredSignals.preferredReturnDates,
      queryInput: queryEntry?.queryInput ?? null,
      reviewedCandidateCount: entry.reviewedSeedCount,
      reviewedSeedCount: entry.reviewedSeedCount,
      sampleAirlines: [...entry.sampleAirlines].slice(0, 4),
      sampleDepartureDates: [...entry.sampleDepartureDates].slice(0, 4),
      score,
      seedContexts: orderedSeedContexts,
      totalIntentionalStopCount: entry.totalIntentionalStopCount
    });
  }

  return rankedEvidence.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftCandidatePrice = Number(left.cheapestCandidatePrice ?? Number.POSITIVE_INFINITY);
    const rightCandidatePrice = Number(right.cheapestCandidatePrice ?? Number.POSITIVE_INFINITY);
    if (leftCandidatePrice !== rightCandidatePrice) {
      return leftCandidatePrice - rightCandidatePrice;
    }

    const leftDelta = Number(left.baselinePriceDelta ?? Number.POSITIVE_INFINITY);
    const rightDelta = Number(right.baselinePriceDelta ?? Number.POSITIVE_INFINITY);
    if (leftDelta !== rightDelta) {
      return leftDelta - rightDelta;
    }

    return right.familyCount - left.familyCount;
  });
}

export function buildMultiCityVerificationFollowupTargets({
  followupCityLimit,
  rankedCities,
  runSeed,
  seedContextsPerCityLimit
}) {
  return Array.isArray(rankedCities)
    ? rankedCities
        .slice(0, Math.max(0, Number(followupCityLimit ?? 0)))
        .map((entry) => ({
          ...entry,
          selectedSeedContexts: selectTopSeedContextsForCity(
            entry.seedContexts ?? [],
            Math.max(1, Number(seedContextsPerCityLimit ?? 1)),
            `${runSeed}:${entry.cityCode}`
          )
        }))
        .filter((entry) => entry.selectedSeedContexts.length > 0)
    : [];
}

export function buildMultiCityVerificationResultsSummary({
  baselineCheapestPrice,
  seedResults
}) {
  const cityResults = new Map();
  let cheapestMultiCityCandidate = null;
  let cheapestVerifiedMultiCityCandidate = null;
  let intentionalCandidateCount = 0;

  for (const seedResult of seedResults ?? []) {
    const seedContext = seedResult.seedContext ?? {};
    const cityCode = seedContext.cityCode ?? seedResult.cityCode;

    if (!cityCode) {
      continue;
    }

    const existing = cityResults.get(cityCode) ?? {
      baselineCheapestPrice: baselineCheapestPrice ?? null,
      candidateCount: 0,
      cheapestCandidatePrice: null,
      cheapestVerifiedCandidatePrice: null,
      cityCode,
      cityName: seedContext.cityName ?? seedResult.cityName ?? cityCode,
      intentionalCandidateCount: 0,
      seedContextCount: 0,
      testedAirlines: new Set(),
      testedDatePairs: new Set(),
      testedFamilies: new Set(),
      bestCandidate: null,
      bestSeedContext: null,
      bestVerifiedCandidate: null
    };

    existing.seedContextCount += 1;
    if (seedContext.candidateFamilyId) {
      existing.testedFamilies.add(seedContext.candidateFamilyId);
    }
    if (seedContext.outboundAirline) {
      existing.testedAirlines.add(seedContext.outboundAirline);
    }
    if (seedContext.returnAirline) {
      existing.testedAirlines.add(seedContext.returnAirline);
    }
    existing.testedDatePairs.add(formatDatePairLabel(seedContext.departDate, seedContext.returnDate));

    for (const candidate of seedResult.createdCandidates ?? []) {
      existing.candidateCount += 1;
      const displayedAmount = Number(candidate.displayedAmount ?? Number.POSITIVE_INFINITY);
      const candidateStopovers = Array.isArray(candidate.stopovers) ? candidate.stopovers : [];
      const isIntentionalCandidate =
        Number(candidate.intentionalStopCount ?? 0) > 0 ||
        candidateStopovers.some((stopover) => stopover?.isIntentional);
      const baselinePriceDelta =
        typeof baselineCheapestPrice === "number" && Number.isFinite(baselineCheapestPrice)
          ? Math.max(0, displayedAmount - baselineCheapestPrice)
          : null;
      const candidateSummary = {
        baselinePriceDelta,
        candidateId: candidate.id,
        cityCode,
        cityName: existing.cityName,
        displayedAmount,
        intentionalStopCount: Number(candidate.intentionalStopCount ?? 0),
        intentionalStopoverCityCodes: candidateStopovers
          .filter((stopover) => stopover?.isIntentional && stopover?.cityCode)
          .map((stopover) => stopover.cityCode),
        sourceCandidateFamilyId: seedContext.candidateFamilyId ?? null,
        sourceFamilyKey: seedContext.familyKey ?? null,
        sourceOutboundAirline: seedContext.outboundAirline ?? null,
        sourceReturnAirline: seedContext.returnAirline ?? null,
        sourceDepartDate: seedContext.departDate ?? null,
        sourceReturnDate: seedContext.returnDate ?? null
      };

      if (
        existing.cheapestVerifiedCandidatePrice === null ||
        displayedAmount < Number(existing.cheapestVerifiedCandidatePrice ?? Number.POSITIVE_INFINITY)
      ) {
        existing.cheapestVerifiedCandidatePrice = displayedAmount;
        existing.bestSeedContext = {
          baselinePriceDelta: seedContext.baselinePriceDelta ?? null,
          candidateFamilyId: seedContext.candidateFamilyId ?? null,
          cityCode,
          cityName: existing.cityName,
          departDate: seedContext.departDate ?? null,
          discoverySources: seedContext.discoverySources ?? [],
          familyKey: seedContext.familyKey ?? null,
          outboundAirline: seedContext.outboundAirline ?? null,
          returnAirline: seedContext.returnAirline ?? null,
          returnDate: seedContext.returnDate ?? null,
          sourceQueryExecutionId: seedContext.sourceQueryExecutionId ?? null,
          sourceResultUrl: seedContext.sourceResultUrl ?? null
        };
        existing.bestVerifiedCandidate = candidateSummary;
      }

      if (
        !cheapestVerifiedMultiCityCandidate ||
        displayedAmount <
          Number(cheapestVerifiedMultiCityCandidate.displayedAmount ?? Number.POSITIVE_INFINITY)
      ) {
        cheapestVerifiedMultiCityCandidate = candidateSummary;
      }

      if (!isIntentionalCandidate) {
        continue;
      }

      intentionalCandidateCount += 1;
      existing.intentionalCandidateCount += 1;

      if (
        existing.cheapestCandidatePrice === null ||
        displayedAmount < Number(existing.cheapestCandidatePrice ?? Number.POSITIVE_INFINITY)
      ) {
        existing.cheapestCandidatePrice = displayedAmount;
        existing.bestCandidate = candidateSummary;
      }

      if (
        !cheapestMultiCityCandidate ||
        displayedAmount < Number(cheapestMultiCityCandidate.displayedAmount ?? Number.POSITIVE_INFINITY)
      ) {
        cheapestMultiCityCandidate = candidateSummary;
      }
    }

    cityResults.set(cityCode, existing);
  }

  return {
    baselineCheapestPrice: baselineCheapestPrice ?? null,
    candidateCount: [...cityResults.values()].reduce(
      (total, entry) => total + Number(entry.candidateCount ?? 0),
      0
    ),
    cheapestMultiCityCandidate,
    cheapestVerifiedMultiCityCandidate,
    intentionalCandidateCount,
    cityResults: [...cityResults.values()]
      .map((entry) => ({
        ...entry,
        testedAirlines: [...entry.testedAirlines].slice(0, 4),
        testedDatePairs: [...entry.testedDatePairs].slice(0, 4),
        testedFamilies: [...entry.testedFamilies].slice(0, 4)
      }))
      .sort((left, right) => {
        const leftPrice = Number(
          left.cheapestCandidatePrice ?? left.cheapestVerifiedCandidatePrice ?? Number.POSITIVE_INFINITY
        );
        const rightPrice = Number(
          right.cheapestCandidatePrice ?? right.cheapestVerifiedCandidatePrice ?? Number.POSITIVE_INFINITY
        );
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        const intentionalDifference =
          Number(right.intentionalCandidateCount ?? 0) - Number(left.intentionalCandidateCount ?? 0);
        if (intentionalDifference !== 0) {
          return intentionalDifference;
        }

        return Number(right.candidateCount ?? 0) - Number(left.candidateCount ?? 0);
      }),
    queriedCityCount: cityResults.size,
    queriedSeedCount: (seedResults ?? []).length
  };
}

export function buildAnchoredMultiCityResultsSummary({
  baselineCheapestPrice,
  seedResults
}) {
  return {
    ...buildMultiCityVerificationResultsSummary({
      baselineCheapestPrice,
      seedResults
    }),
    searchMode: "anchored_multi_city"
  };
}

export function buildLongStopValidationSummary({
  db,
  minimumLongStopHours,
  rankingSnapshot,
  resolveCityName,
  safeJsonParse,
  sourceStrategyId
}) {
  if (!sourceStrategyId) {
    return [];
  }

  const minimumLongStopMinutes = Math.max(1, Number(minimumLongStopHours ?? 12)) * 60;
  const candidateRows = db
    .prepare(
      `select
         c.id as candidate_id,
         c.displayed_display_amount,
         cl.departure_at as outbound_departure_at,
         cl.carrier_code,
         cl.raw_leg_payload_json
       from itinerary_candidate c
       left join candidate_leg cl
         on cl.itinerary_candidate_id = c.id
        and cl.segment_group = 'outbound'
        and cl.leg_index = 0
       where c.strategy_execution_id = ?
       order by c.displayed_display_amount asc`
    )
    .all(sourceStrategyId);

  if (candidateRows.length === 0) {
    return [];
  }

  const candidateIds = candidateRows.map((row) => row.candidate_id);
  const candidatePlaceholders = candidateIds.map(() => "?").join(", ");
  const stopoverRows = db
    .prepare(
      `select
         itinerary_candidate_id,
         city_code,
         duration_minutes,
         is_intentional
       from candidate_stopover
       where itinerary_candidate_id in (${candidatePlaceholders})
       order by itinerary_candidate_id asc, stop_index asc`
    )
    .all(...candidateIds);
  const stopoversByCandidateId = new Map();

  for (const stopover of stopoverRows) {
    const current = stopoversByCandidateId.get(stopover.itinerary_candidate_id) ?? [];
    current.push(stopover);
    stopoversByCandidateId.set(stopover.itinerary_candidate_id, current);
  }

  const rankingByCity = new Map(
    Array.isArray(rankingSnapshot?.summary?.rankedCities)
      ? rankingSnapshot.summary.rankedCities.map((entry) => [entry.cityCode, entry])
      : []
  );
  const citySummary = new Map();

  for (const candidate of candidateRows) {
    const rawLegPayload = safeJsonParse(candidate.raw_leg_payload_json, null);
    const airline =
      rawLegPayload?.airline ??
      rawLegPayload?.carrier ??
      candidate.carrier_code ??
      "Unknown";
    const departDate = candidate.outbound_departure_at
      ? String(candidate.outbound_departure_at).slice(0, 10)
      : null;
    const candidateStopovers = stopoversByCandidateId.get(candidate.candidate_id) ?? [];
    const uniqueCityCodes = new Set();

    for (const stopover of candidateStopovers) {
      if (!stopover?.city_code || uniqueCityCodes.has(stopover.city_code)) {
        continue;
      }

      uniqueCityCodes.add(stopover.city_code);
      const existing = citySummary.get(stopover.city_code) ?? {
        candidateIds: new Set(),
        cheapestVerifiedPrice: Number.POSITIVE_INFINITY,
        cityCode: stopover.city_code,
        cityName: resolveCityLabel(resolveCityName, stopover.city_code),
        longestObservedStopMinutes: 0,
        passesMinimumHoursCount: 0,
        sampleAirlines: new Set(),
        sampleDepartureDates: new Set(),
        totalIntentionalStopCount: 0
      };
      existing.candidateIds.add(candidate.candidate_id);
      existing.cheapestVerifiedPrice = Math.min(
        existing.cheapestVerifiedPrice,
        Number(candidate.displayed_display_amount ?? Number.POSITIVE_INFINITY)
      );
      existing.longestObservedStopMinutes = Math.max(
        existing.longestObservedStopMinutes,
        Number(stopover.duration_minutes ?? 0)
      );
      if (Number(stopover.duration_minutes ?? 0) >= minimumLongStopMinutes) {
        existing.passesMinimumHoursCount += 1;
      }
      if (Number(stopover.is_intentional ?? 0) > 0) {
        existing.totalIntentionalStopCount += 1;
      }
      if (airline) {
        existing.sampleAirlines.add(airline);
      }
      if (departDate) {
        existing.sampleDepartureDates.add(departDate);
      }
      citySummary.set(stopover.city_code, existing);
    }
  }

  return [...citySummary.values()]
    .map((entry) => {
      const rankingEntry = rankingByCity.get(entry.cityCode);
      const verifiedCandidateCount = entry.candidateIds.size;
      const longestObservedStopHours = Number((entry.longestObservedStopMinutes / 60).toFixed(1));
      let recommendation = "not_ready";

      if (entry.passesMinimumHoursCount > 0 || entry.totalIntentionalStopCount > 0) {
        recommendation = "promising";
      } else if (
        verifiedCandidateCount >= 2 &&
        entry.longestObservedStopMinutes >= minimumLongStopMinutes * 0.5
      ) {
        recommendation = "watch";
      }

      return {
        cheapestVerifiedPrice: Number.isFinite(entry.cheapestVerifiedPrice)
          ? entry.cheapestVerifiedPrice
          : null,
        cityCode: entry.cityCode,
        cityName: entry.cityName,
        longestObservedStopHours,
        minimumLongStopHours: Number(minimumLongStopHours ?? 12),
        passesMinimumHoursCount: entry.passesMinimumHoursCount,
        rankedEvidenceScore: rankingEntry?.score ?? 0,
        recommendation,
        sampleAirlines: [...entry.sampleAirlines].slice(0, 3),
        sampleDepartureDates: [...entry.sampleDepartureDates].slice(0, 4),
        totalIntentionalStopCount: entry.totalIntentionalStopCount,
        verifiedCandidateCount
      };
    })
    .sort((left, right) => {
      const priorityOrder = {
        promising: 0,
        watch: 1,
        not_ready: 2
      };
      if (priorityOrder[left.recommendation] !== priorityOrder[right.recommendation]) {
        return priorityOrder[left.recommendation] - priorityOrder[right.recommendation];
      }

      if (right.rankedEvidenceScore !== left.rankedEvidenceScore) {
        return right.rankedEvidenceScore - left.rankedEvidenceScore;
      }

      if (right.longestObservedStopHours !== left.longestObservedStopHours) {
        return right.longestObservedStopHours - left.longestObservedStopHours;
      }

      return (left.cheapestVerifiedPrice ?? Number.POSITIVE_INFINITY) -
        (right.cheapestVerifiedPrice ?? Number.POSITIVE_INFINITY);
    });
}

export function buildLongStopFollowupTargets({
  followupCityLimit,
  longStopValidationSummary
}) {
  return Array.isArray(longStopValidationSummary?.cityValidations)
    ? longStopValidationSummary.cityValidations
        .filter(
          (entry) =>
            entry?.cityCode &&
            (entry.recommendation === "promising" || entry.recommendation === "watch")
        )
        .slice(0, Math.max(0, Number(followupCityLimit ?? 0)))
    : [];
}

export function buildAlternateReturnCityTargets({
  candidateCityLimit,
  destinationCityCode,
  isMainlandChinaCity,
  longStopFollowupSnapshot,
  longStopValidationSnapshot,
  multiCityRankingSnapshot,
  pass1Snapshot,
  resolveCityName
}) {
  const cityTargets = new Map();

  function ensureCity(cityCode, cityName) {
    if (!cityCode || cityCode === destinationCityCode || !isMainlandChinaCity(cityCode)) {
      return null;
    }

    const existing = cityTargets.get(cityCode) ?? {
      baselineCheapestObservedPrice: null,
      baselineObservationCount: 0,
      cityCode,
      cityName: cityName ?? resolveCityLabel(resolveCityName, cityCode),
      longStopCandidateCount: 0,
      longStopCheapestFare: null,
      longStopRecommendation: null,
      multiCityRankScore: 0,
      reasons: [],
      targetScore: 0
    };
    cityTargets.set(cityCode, existing);
    return existing;
  }

  const baselineFindings = Array.isArray(pass1Snapshot?.summary?.stopoverCityFindings)
    ? pass1Snapshot.summary.stopoverCityFindings
    : [];

  for (const [index, entry] of baselineFindings.entries()) {
    const target = ensureCity(entry?.cityCode, entry?.cityName);

    if (!target) {
      continue;
    }

    target.baselineObservationCount = Number(entry?.observationCount ?? 0);
    target.baselineCheapestObservedPrice =
      typeof entry?.cheapestObservedPrice === "number" ? entry.cheapestObservedPrice : null;
    target.targetScore += Math.max(1, 6 - index) + target.baselineObservationCount * 2;
    target.reasons.push(
      target.baselineObservationCount > 0
        ? `baseline stopover evidence observed this city ${target.baselineObservationCount} time${target.baselineObservationCount === 1 ? "" : "s"}`
        : "baseline stopover evidence surfaced this city"
    );
  }

  const rankedCities = Array.isArray(multiCityRankingSnapshot?.summary?.rankedCities)
    ? multiCityRankingSnapshot.summary.rankedCities
    : [];

  for (const entry of rankedCities) {
    const target = ensureCity(entry?.cityCode, entry?.cityName);

    if (!target) {
      continue;
    }

    target.multiCityRankScore = Number(entry?.score ?? 0);
    target.targetScore += target.multiCityRankScore;
    if (target.multiCityRankScore > 0) {
      target.reasons.push(`multi-city verification ranked this city with score ${target.multiCityRankScore}`);
    }
  }

  const validationCities = Array.isArray(longStopValidationSnapshot?.summary?.cityValidations)
    ? longStopValidationSnapshot.summary.cityValidations
    : [];

  for (const entry of validationCities) {
    const target = ensureCity(entry?.cityCode, entry?.cityName);

    if (!target) {
      continue;
    }

    target.longStopRecommendation = entry?.recommendation ?? null;
    if (target.longStopRecommendation === "promising") {
      target.targetScore += 12;
      target.reasons.push("long-stop validation marked this city promising");
    } else if (target.longStopRecommendation === "watch") {
      target.targetScore += 6;
      target.reasons.push("long-stop validation marked this city worth watching");
    }
  }

  const followupCities = Array.isArray(longStopFollowupSnapshot?.summary?.cityResults)
    ? longStopFollowupSnapshot.summary.cityResults
    : [];

  for (const entry of followupCities) {
    const target = ensureCity(entry?.cityCode, entry?.cityName);

    if (!target) {
      continue;
    }

    target.longStopCandidateCount = Number(entry?.candidateCount ?? 0);
    target.longStopCheapestFare =
      typeof entry?.cheapestCandidatePrice === "number" ? entry.cheapestCandidatePrice : null;
    target.targetScore += target.longStopCandidateCount * 4;
    if (target.longStopCandidateCount > 0) {
      target.reasons.push(
        `long-stop follow-up already found ${target.longStopCandidateCount} candidate${target.longStopCandidateCount === 1 ? "" : "s"}`
      );
    }
  }

  return [...cityTargets.values()]
    .sort((left, right) => {
      if (right.targetScore !== left.targetScore) {
        return right.targetScore - left.targetScore;
      }

      const leftLongStopFare = Number(left.longStopCheapestFare ?? Number.POSITIVE_INFINITY);
      const rightLongStopFare = Number(right.longStopCheapestFare ?? Number.POSITIVE_INFINITY);
      if (leftLongStopFare !== rightLongStopFare) {
        return leftLongStopFare - rightLongStopFare;
      }

      const leftObservedFare = Number(left.baselineCheapestObservedPrice ?? Number.POSITIVE_INFINITY);
      const rightObservedFare = Number(right.baselineCheapestObservedPrice ?? Number.POSITIVE_INFINITY);
      if (leftObservedFare !== rightObservedFare) {
        return leftObservedFare - rightObservedFare;
      }

      return right.baselineObservationCount - left.baselineObservationCount;
    })
    .slice(0, Math.max(0, Number(candidateCityLimit ?? 0)));
}

function collectBaselineFamilyCityEvidence({
  anchorDates,
  db,
  destinationCityCode,
  resolveCityName,
  safeJsonParse,
  strategyIds
}) {
  if (!Array.isArray(strategyIds) || strategyIds.length === 0) {
    return {
      baselineCheapestPrice: null,
      candidateFamilies: [],
      cityDateAirlineMatrix: [],
      cityEntryFindings: [],
      seedEntries: []
    };
  }

  const strategyPlaceholders = strategyIds.map(() => "?").join(", ");
  const candidateRows = db
    .prepare(
      `select
         c.id as candidate_id,
         c.candidate_family_id,
         c.displayed_display_amount,
         c.intentional_stop_count,
         c.stop_count,
         c.strategy_execution_id,
         cf.family_key,
         cf.route_summary_json,
         outbound_leg.departure_at as outbound_departure_at,
         outbound_leg.carrier_code as outbound_carrier_code,
         outbound_leg.raw_leg_payload_json as outbound_raw_leg_payload_json,
         return_leg.departure_at as return_departure_at,
         return_leg.carrier_code as return_carrier_code,
         return_leg.raw_leg_payload_json as return_raw_leg_payload_json,
         se.strategy_type,
         q.id as query_execution_id,
         q.tripcom_result_url,
         q.query_input_json,
         q.query_type
       from itinerary_candidate c
       inner join candidate_family cf
         on cf.id = c.candidate_family_id
       inner join strategy_execution se
         on se.id = c.strategy_execution_id
       left join candidate_leg outbound_leg
         on outbound_leg.itinerary_candidate_id = c.id
        and outbound_leg.segment_group = 'outbound'
        and outbound_leg.leg_index = 0
       left join candidate_leg return_leg
         on return_leg.itinerary_candidate_id = c.id
        and return_leg.segment_group = 'return'
        and return_leg.leg_index = 1
       left join query_candidate_link qcl
         on qcl.itinerary_candidate_id = c.id
       left join query_execution q
         on q.id = qcl.query_execution_id
       where c.strategy_execution_id in (${strategyPlaceholders})
       order by c.displayed_display_amount asc, c.first_seen_at asc`
    )
    .all(...strategyIds);

  if (candidateRows.length === 0) {
    return {
      baselineCheapestPrice: null,
      candidateFamilies: [],
      cityDateAirlineMatrix: [],
      cityEntryFindings: [],
      seedEntries: []
    };
  }

  const candidateIds = candidateRows.map((row) => row.candidate_id);
  const candidatePlaceholders = candidateIds.map(() => "?").join(", ");
  const stopoverRows = db
    .prepare(
      `select itinerary_candidate_id, city_code, duration_minutes, is_intentional
       from candidate_stopover
       where itinerary_candidate_id in (${candidatePlaceholders})
       order by itinerary_candidate_id asc, stop_index asc`
    )
    .all(...candidateIds);
  const stopoversByCandidateId = new Map();

  for (const stopover of stopoverRows) {
    const current = stopoversByCandidateId.get(stopover.itinerary_candidate_id) ?? [];
    current.push(stopover);
    stopoversByCandidateId.set(stopover.itinerary_candidate_id, current);
  }

  const anchorDateSet = new Set((anchorDates ?? []).filter(Boolean));
  const familyMap = new Map();
  const cityEntryMap = new Map();
  const cityDateAirlineMatrix = new Map();
  const seedMap = new Map();
  let baselineCheapestPrice = Number.POSITIVE_INFINITY;

  for (const row of candidateRows) {
    const displayedAmount = Number(row.displayed_display_amount ?? Number.POSITIVE_INFINITY);
    baselineCheapestPrice = Math.min(baselineCheapestPrice, displayedAmount);

    const routeSummary = safeJsonParse(row.route_summary_json, {});
    const outboundPayload = safeJsonParse(row.outbound_raw_leg_payload_json, null);
    const returnPayload = safeJsonParse(row.return_raw_leg_payload_json, null);
    const queryInput = safeJsonParse(row.query_input_json, {});
    const departDate = row.outbound_departure_at ? String(row.outbound_departure_at).slice(0, 10) : null;
    const returnDate = row.return_departure_at ? String(row.return_departure_at).slice(0, 10) : null;
    const outboundAirline = resolveAirlineLabel(
      { carrier_code: row.outbound_carrier_code },
      routeSummary?.outboundAirline ? { airline: routeSummary.outboundAirline } : outboundPayload
    );
    const returnAirline = resolveAirlineLabel(
      { carrier_code: row.return_carrier_code },
      routeSummary?.returnAirline ? { airline: routeSummary.returnAirline } : returnPayload
    );
    const sourceLabel = baselineStrategySourceLabels[row.strategy_type] ?? row.strategy_type;
    const sourceWeight = baselineStrategySourceWeights[row.strategy_type] ?? 1;
    const candidateStopovers = stopoversByCandidateId.get(row.candidate_id) ?? [];
    const stopoverByCity = new Map();

    for (const stopover of candidateStopovers) {
      if (!stopover?.city_code || stopover.city_code === destinationCityCode) {
        continue;
      }

      const existing = stopoverByCity.get(stopover.city_code) ?? {
        cityCode: stopover.city_code,
        intentionalObservationCount: 0,
        longestStopDurationMinutes: 0
      };
      existing.longestStopDurationMinutes = Math.max(
        existing.longestStopDurationMinutes,
        Number(stopover.duration_minutes ?? 0)
      );
      if (Number(stopover.is_intentional ?? 0) > 0) {
        existing.intentionalObservationCount += 1;
      }
      stopoverByCity.set(stopover.city_code, existing);
    }

    if (
      routeSummary?.stopoverCityCode &&
      routeSummary.stopoverCityCode !== destinationCityCode &&
      !stopoverByCity.has(routeSummary.stopoverCityCode)
    ) {
      stopoverByCity.set(routeSummary.stopoverCityCode, {
        cityCode: routeSummary.stopoverCityCode,
        intentionalObservationCount: 0,
        longestStopDurationMinutes: 0
      });
    }

    const family = familyMap.get(row.candidate_family_id) ?? {
      candidateCount: 0,
      candidateFamilyId: row.candidate_family_id,
      cheapestPrice: Number.POSITIVE_INFINITY,
      departDates: new Set(),
      discoverySources: new Set(),
      familyKey: row.family_key,
      intentionalStopCandidateCount: 0,
      outboundAirlines: new Set(),
      returnAirlines: new Set(),
      returnDates: new Set(),
      sampleCandidateIds: [],
      sourceStrategyTypes: new Set(),
      stopCount: Number(row.stop_count ?? 0),
      stopoverCities: new Map()
    };
    family.candidateCount += 1;
    family.cheapestPrice = Math.min(family.cheapestPrice, displayedAmount);
    family.stopCount = Math.max(family.stopCount, Number(row.stop_count ?? 0));
    family.intentionalStopCandidateCount += Number(row.intentional_stop_count ?? 0) > 0 ? 1 : 0;
    if (departDate) {
      family.departDates.add(departDate);
    }
    if (returnDate) {
      family.returnDates.add(returnDate);
    }
    if (family.sampleCandidateIds.length < 4) {
      family.sampleCandidateIds.push(row.candidate_id);
    }
    if (outboundAirline) {
      family.outboundAirlines.add(outboundAirline);
    }
    if (returnAirline) {
      family.returnAirlines.add(returnAirline);
    }
    family.sourceStrategyTypes.add(row.strategy_type);
    family.discoverySources.add(sourceLabel);

    for (const stopoverEntry of stopoverByCity.values()) {
      const cityCode = stopoverEntry.cityCode;
      const cityName = resolveCityLabel(resolveCityName, cityCode);
      const familyStopover = family.stopoverCities.get(cityCode) ?? {
        baselinePriceDelta: Number.POSITIVE_INFINITY,
        cheapestPrice: Number.POSITIVE_INFINITY,
        cityCode,
        cityName,
        discoverySources: new Set(),
        intentionalObservationCount: 0,
        longestStopDurationMinutes: 0,
        observationCount: 0
      };
      familyStopover.cheapestPrice = Math.min(familyStopover.cheapestPrice, displayedAmount);
      familyStopover.baselinePriceDelta = Math.min(
        familyStopover.baselinePriceDelta,
        displayedAmount
      );
      familyStopover.discoverySources.add(sourceLabel);
      familyStopover.intentionalObservationCount += Number(
        stopoverEntry.intentionalObservationCount ?? 0
      );
      familyStopover.longestStopDurationMinutes = Math.max(
        familyStopover.longestStopDurationMinutes,
        Number(stopoverEntry.longestStopDurationMinutes ?? 0)
      );
      familyStopover.observationCount += 1;
      family.stopoverCities.set(cityCode, familyStopover);

      const cityEntry = cityEntryMap.get(cityCode) ?? {
        bestDepartDate: null,
        bestFamilyKey: null,
        bestOutboundAirline: null,
        bestReturnAirline: null,
        bestReturnDate: null,
        candidateFamilyIds: new Set(),
        cheapestPrice: Number.POSITIVE_INFINITY,
        cityCode,
        cityName,
        discoverySources: new Set(),
        familyCount: 0,
        sourceWeight: 0
      };
      cityEntry.candidateFamilyIds.add(row.candidate_family_id);
      cityEntry.discoverySources.add(sourceLabel);
      const shouldReplaceCityEntry =
        displayedAmount < cityEntry.cheapestPrice ||
        (displayedAmount === cityEntry.cheapestPrice && sourceWeight > cityEntry.sourceWeight);
      if (shouldReplaceCityEntry) {
        cityEntry.bestDepartDate = departDate;
        cityEntry.bestFamilyKey = row.family_key;
        cityEntry.bestOutboundAirline = outboundAirline;
        cityEntry.bestReturnAirline = returnAirline;
        cityEntry.bestReturnDate = returnDate;
        cityEntry.cheapestPrice = displayedAmount;
        cityEntry.sourceWeight = sourceWeight;
      }
      cityEntryMap.set(cityCode, cityEntry);

      const matrixKey = [
        cityCode,
        departDate ?? "",
        returnDate ?? "",
        normalizeText(outboundAirline),
        normalizeText(returnAirline)
      ].join("::");
      const matrixEntry = cityDateAirlineMatrix.get(matrixKey) ?? {
        candidateFamilyIds: new Set(),
        cheapestPrice: Number.POSITIVE_INFINITY,
        cityCode,
        cityName,
        departureDate: departDate,
        discoverySources: new Set(),
        outboundAirline: outboundAirline ?? null,
        returnAirline: returnAirline ?? null,
        returnDate
      };
      matrixEntry.candidateFamilyIds.add(row.candidate_family_id);
      matrixEntry.cheapestPrice = Math.min(matrixEntry.cheapestPrice, displayedAmount);
      matrixEntry.discoverySources.add(sourceLabel);
      cityDateAirlineMatrix.set(matrixKey, matrixEntry);

      const seedKey = [
        row.candidate_family_id,
        cityCode,
        departDate ?? "",
        returnDate ?? "",
        normalizeText(outboundAirline),
        normalizeText(returnAirline),
        row.query_execution_id ?? "no_query"
      ].join("::");
      const seedEntry = seedMap.get(seedKey) ?? {
        anchorMatches: new Set(),
        baselinePriceDelta: Number.POSITIVE_INFINITY,
        candidateFamilyId: row.candidate_family_id,
        candidateIds: new Set(),
        cheapestPrice: Number.POSITIVE_INFINITY,
        cityCode,
        cityName,
        cityObservationCount: 0,
        departDate,
        discoveryConfidence: 0,
        discoverySources: new Set(),
        familyKey: row.family_key,
        intentionalStopCandidateCount: 0,
        longestStopDurationMinutes: 0,
        outboundAirline: outboundAirline ?? null,
        returnAirline: returnAirline ?? null,
        returnDate,
        sampleCandidateIds: [],
        seedKey,
        sourceQueryExecutionId: row.query_execution_id ?? null,
        sourceQueryType: row.query_type ?? null,
        sourceResultUrl: row.tripcom_result_url ?? queryInput.baseResultUrl ?? null,
        sourceStrategyTypes: new Set(),
        stopCount: Number(row.stop_count ?? 0)
      };
      seedEntry.cheapestPrice = Math.min(seedEntry.cheapestPrice, displayedAmount);
      seedEntry.candidateIds.add(row.candidate_id);
      seedEntry.cityObservationCount += 1;
      seedEntry.discoveryConfidence = Math.max(seedEntry.discoveryConfidence, sourceWeight * 3);
      seedEntry.discoverySources.add(sourceLabel);
      seedEntry.intentionalStopCandidateCount += Number(stopoverEntry.intentionalObservationCount ?? 0);
      seedEntry.longestStopDurationMinutes = Math.max(
        seedEntry.longestStopDurationMinutes,
        Number(stopoverEntry.longestStopDurationMinutes ?? 0)
      );
      seedEntry.sourceStrategyTypes.add(row.strategy_type);
      if (departDate && anchorDateSet.has(departDate)) {
        seedEntry.anchorMatches.add(departDate);
      }
      if (seedEntry.sampleCandidateIds.length < 3) {
        seedEntry.sampleCandidateIds.push(row.candidate_id);
      }
      if (
        !seedEntry.sourceResultUrl &&
        (row.tripcom_result_url || queryInput.baseResultUrl)
      ) {
        seedEntry.sourceResultUrl = row.tripcom_result_url ?? queryInput.baseResultUrl;
      }
      if (!seedEntry.sourceQueryExecutionId && row.query_execution_id) {
        seedEntry.sourceQueryExecutionId = row.query_execution_id;
      }
      seedMap.set(seedKey, seedEntry);
    }

    familyMap.set(row.candidate_family_id, family);
  }

  const resolvedBaselineCheapestPrice = Number.isFinite(baselineCheapestPrice)
    ? baselineCheapestPrice
    : null;
  const candidateFamilies = [...familyMap.values()]
    .map((family) => {
      const stopoverCities = [...family.stopoverCities.values()]
        .map((entry) => ({
          baselinePriceDelta:
            resolvedBaselineCheapestPrice !== null && Number.isFinite(entry.cheapestPrice)
              ? Math.max(0, entry.cheapestPrice - resolvedBaselineCheapestPrice)
              : null,
          cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null,
          cityCode: entry.cityCode,
          cityName: entry.cityName,
          discoverySources: [...entry.discoverySources],
          longestStopDurationHours:
            entry.longestStopDurationMinutes > 0
              ? Number((entry.longestStopDurationMinutes / 60).toFixed(1))
              : null,
          observationCount: entry.observationCount
        }))
        .sort((left, right) => {
          const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
          const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
          if (leftPrice !== rightPrice) {
            return leftPrice - rightPrice;
          }

          return Number(right.observationCount ?? 0) - Number(left.observationCount ?? 0);
        });
      const anchorMatches = [...family.departDates].filter((date) => anchorDateSet.has(date));
      const recommendedFollowups = [];
      const rationale = [];

      if (stopoverCities.length > 0) {
        recommendedFollowups.push("Multi-city verification");
        rationale.push(
          `Observed stopover clues for ${stopoverCities.map((entry) => entry.cityCode).join(", ")} within this baseline family.`
        );
      }

      if (anchorMatches.length > 0) {
        recommendedFollowups.push("Anchored departure follow-up");
        rationale.push(
          `Departure date${anchorMatches.length === 1 ? "" : "s"} ${anchorMatches.join(", ")} also appeared in the strongest baseline anchors.`
        );
      }

      if (recommendedFollowups.length === 0) {
        recommendedFollowups.push("Baseline control");
        rationale.push("Keep this family as a baseline control for later comparison against deeper follow-up work.");
      }

      const cheapestPrice = Number.isFinite(family.cheapestPrice) ? family.cheapestPrice : null;
      const baselinePriceDelta =
        resolvedBaselineCheapestPrice !== null && cheapestPrice !== null
          ? Math.max(0, cheapestPrice - resolvedBaselineCheapestPrice)
          : null;
      const score =
        (stopoverCities.length > 0 ? 12 : 0) +
        anchorMatches.length * 5 +
        (family.sourceStrategyTypes.has("packaged_return_option_expansion") ? 5 : 0) +
        Math.min(4, family.candidateCount) +
        Math.min(3, family.intentionalStopCandidateCount) +
        (baselinePriceDelta !== null ? Math.max(0, 10 - Math.floor(baselinePriceDelta / 50)) : 0);

      return {
        anchorMatches,
        baselinePriceDelta,
        candidateCount: family.candidateCount,
        candidateFamilyId: family.candidateFamilyId,
        cheapestPrice,
        departDates: [...family.departDates].sort(),
        discoverySources: [...family.discoverySources],
        familyKey: family.familyKey,
        intentionalStopCandidateCount: family.intentionalStopCandidateCount,
        outboundAirlines: [...family.outboundAirlines].slice(0, 3),
        rationale,
        recommendedFollowups,
        returnAirlines: [...family.returnAirlines].slice(0, 3),
        returnDates: [...family.returnDates].sort(),
        sampleCandidateIds: family.sampleCandidateIds,
        score,
        stopCount: family.stopCount,
        stopoverCities
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY) -
        Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
    });

  return {
    baselineCheapestPrice: resolvedBaselineCheapestPrice,
    candidateFamilies,
    cityDateAirlineMatrix: [...cityDateAirlineMatrix.values()]
      .map((entry) => ({
        baselinePriceDelta:
          resolvedBaselineCheapestPrice !== null && Number.isFinite(entry.cheapestPrice)
            ? Math.max(0, entry.cheapestPrice - resolvedBaselineCheapestPrice)
            : null,
        cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null,
        cityCode: entry.cityCode,
        cityName: entry.cityName,
        departureDate: entry.departureDate,
        discoverySources: [...entry.discoverySources],
        familyCount: entry.candidateFamilyIds.size,
        outboundAirline: entry.outboundAirline,
        returnAirline: entry.returnAirline,
        returnDate: entry.returnDate
      }))
      .sort((left, right) => {
        const leftDelta = Number(left.baselinePriceDelta ?? Number.POSITIVE_INFINITY);
        const rightDelta = Number(right.baselinePriceDelta ?? Number.POSITIVE_INFINITY);
        if (leftDelta !== rightDelta) {
          return leftDelta - rightDelta;
        }

        return Number(right.familyCount ?? 0) - Number(left.familyCount ?? 0);
      }),
    cityEntryFindings: [...cityEntryMap.values()]
      .map((entry) => ({
        baselinePriceDelta:
          resolvedBaselineCheapestPrice !== null && Number.isFinite(entry.cheapestPrice)
            ? Math.max(0, entry.cheapestPrice - resolvedBaselineCheapestPrice)
            : null,
        bestDepartDate: entry.bestDepartDate,
        bestFamilyKey: entry.bestFamilyKey,
        bestOutboundAirline: entry.bestOutboundAirline,
        bestReturnAirline: entry.bestReturnAirline,
        bestReturnDate: entry.bestReturnDate,
        cheapestPrice: Number.isFinite(entry.cheapestPrice) ? entry.cheapestPrice : null,
        cityCode: entry.cityCode,
        cityName: entry.cityName,
        discoverySources: [...entry.discoverySources],
        familyCount: entry.candidateFamilyIds.size
      }))
      .sort((left, right) => {
        const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
        const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return Number(right.familyCount ?? 0) - Number(left.familyCount ?? 0);
      }),
    seedEntries: [...seedMap.values()]
      .map((seed) => ({
        anchorMatches: [...seed.anchorMatches],
        baselinePriceDelta:
          resolvedBaselineCheapestPrice !== null && Number.isFinite(seed.cheapestPrice)
            ? Math.max(0, seed.cheapestPrice - resolvedBaselineCheapestPrice)
            : null,
        candidateCount: seed.candidateIds.size,
        candidateFamilyId: seed.candidateFamilyId,
        cheapestPrice: Number.isFinite(seed.cheapestPrice) ? seed.cheapestPrice : null,
        cityCode: seed.cityCode,
        cityName: seed.cityName,
        cityObservationCount: seed.cityObservationCount,
        departDate: seed.departDate,
        discoveryConfidence: seed.discoveryConfidence,
        discoverySources: [...seed.discoverySources],
        familyKey: seed.familyKey,
        intentionalStopCandidateCount: seed.intentionalStopCandidateCount,
        longestStopDurationMinutes: seed.longestStopDurationMinutes,
        outboundAirline: seed.outboundAirline,
        returnAirline: seed.returnAirline,
        returnDate: seed.returnDate,
        sampleCandidateIds: seed.sampleCandidateIds,
        seedKey: seed.seedKey,
        sourceQueryExecutionId: seed.sourceQueryExecutionId,
        sourceQueryType: seed.sourceQueryType,
        sourceResultUrl: seed.sourceResultUrl,
        sourceStrategyTypes: [...seed.sourceStrategyTypes],
        stopCount: seed.stopCount
      }))
      .sort((left, right) => {
        const leftPrice = Number(left.cheapestPrice ?? Number.POSITIVE_INFINITY);
        const rightPrice = Number(right.cheapestPrice ?? Number.POSITIVE_INFINITY);
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }

        return String(left?.seedKey ?? "").localeCompare(String(right?.seedKey ?? ""));
      })
  };
}

export function buildBaselineFollowupHandoff({
  anchorDates,
  db,
  destinationCityCode = null,
  resolveCityName,
  safeJsonParse,
  strategyIds
}) {
  const baselineEvidence = collectBaselineFamilyCityEvidence({
    anchorDates,
    db,
    destinationCityCode,
    resolveCityName,
    safeJsonParse,
    strategyIds
  });
  const candidateFamilies = baselineEvidence.candidateFamilies;

  return {
    baselineCheapestPrice: baselineEvidence.baselineCheapestPrice,
    candidateFamilies,
    cityDateAirlineMatrix: baselineEvidence.cityDateAirlineMatrix.slice(0, 18),
    cityEntryFindings: baselineEvidence.cityEntryFindings.slice(0, 12),
    recommendedFamilyCount: candidateFamilies.filter(
      (entry) => !entry.recommendedFollowups.includes("Baseline control")
    ).length,
    totalCandidateFamilyCount: candidateFamilies.length
  };
}
