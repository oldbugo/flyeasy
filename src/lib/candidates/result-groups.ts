export type CandidateLeg = {
  arrivalAt: string;
  carrierCode: string | null;
  departureAt: string;
  destinationAirport: string;
  fareBrand?: string | null;
  flightNumber: string | null;
  id: string;
  originAirport: string;
  segmentGroup: string;
};

export type CandidateStopover = {
  airportCode: string;
  arrivalAt?: string;
  cityCode: string;
  departureAt?: string;
  durationMinutes: number;
  id: string;
  isIntentional: boolean;
};

export type CandidateResult = {
  bookingType: string;
  candidateFamilyId: string;
  displayedDisplayCurrency: string;
  displayedDisplayAmount: number;
  id: string;
  intentionalStopCount: number;
  isCurrentBest: boolean;
  isShortlisted: boolean;
  latestVerificationStatus: string;
  legs: CandidateLeg[];
  outboundDestinationCity: string;
  riskNotes: string | null;
  runId: string;
  sessionId?: string;
  stopCount: number;
  stopovers: CandidateStopover[];
  stitchedRiskLevel: string | null;
  totalTravelMinutes: number | null;
  tripShape?: string | null;
};

export type CandidateRecommendationGroup = {
  deduplicatedExactCount: number;
  groupKey: string;
  representative: CandidateResult;
  variants: CandidateResult[];
};

function getSegmentLegs(legs: CandidateLeg[], segmentGroup: string) {
  return legs.filter((leg) => leg.segmentGroup === segmentGroup);
}

function buildExactSignature(candidate: CandidateResult) {
  const outbound = getSegmentLegs(candidate.legs, "outbound");
  const inbound = getSegmentLegs(candidate.legs, "return");

  return JSON.stringify({
    bookingType: candidate.bookingType,
    tripShape: candidate.tripShape ?? "round_trip",
    inbound,
    outbound,
    stopovers: candidate.stopovers
      .map((stopover) => ({
        airportCode: stopover.airportCode,
        cityCode: stopover.cityCode,
        durationMinutes: stopover.durationMinutes,
        isIntentional: stopover.isIntentional
      }))
      .sort((left, right) => left.cityCode.localeCompare(right.cityCode))
  });
}

function buildRecommendationGroupSignature(candidate: CandidateResult) {
  return JSON.stringify({
    bookingType: candidate.bookingType,
    tripShape: candidate.tripShape ?? "round_trip",
    legs: candidate.legs.map((leg) => ({
      carrierCode: leg.carrierCode ?? null,
      destinationAirport: leg.destinationAirport,
      fareBrand: leg.fareBrand ?? null,
      flightNumber: leg.flightNumber ?? null,
      originAirport: leg.originAirport,
      segmentGroup: leg.segmentGroup
    })),
    outboundDestinationCity: candidate.outboundDestinationCity,
    stopovers: candidate.stopovers.map((stopover) => ({
      airportCode: stopover.airportCode,
      cityCode: stopover.cityCode,
      isIntentional: stopover.isIntentional
    })),
    stitchedRiskLevel: candidate.stitchedRiskLevel ?? "none"
  });
}

export function isMultiCityCandidate(candidate: Pick<CandidateResult, "legs" | "tripShape">) {
  if (candidate.tripShape === "open_jaw") {
    return true;
  }

  return candidate.legs.length > 2;
}

function getTripSpanDays(candidate: CandidateResult) {
  const outbound = getSegmentLegs(candidate.legs, "outbound")[0];
  const inbound = getSegmentLegs(candidate.legs, "return")[0];

  if (!outbound?.departureAt || !inbound?.departureAt) {
    return Number.NEGATIVE_INFINITY;
  }

  return Math.round(
    (new Date(inbound.departureAt).getTime() - new Date(outbound.departureAt).getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

function sortCandidates(left: CandidateResult, right: CandidateResult) {
  const tripSpanDifference = getTripSpanDays(right) - getTripSpanDays(left);

  if (tripSpanDifference !== 0) {
    return tripSpanDifference;
  }

  const priceDifference = left.displayedDisplayAmount - right.displayedDisplayAmount;

  if (priceDifference !== 0) {
    return priceDifference;
  }

  return left.id.localeCompare(right.id);
}

export function buildCandidateRecommendationGroups(candidates: CandidateResult[]) {
  const deduplicated = new Map<string, CandidateResult>();
  let duplicateCount = 0;

  for (const candidate of candidates) {
    const signature = buildExactSignature(candidate);
    const existing = deduplicated.get(signature);

    if (!existing) {
      deduplicated.set(signature, candidate);
      continue;
    }

    duplicateCount += 1;
    const keepCurrent =
      candidate.displayedDisplayAmount < existing.displayedDisplayAmount ||
      (candidate.displayedDisplayAmount === existing.displayedDisplayAmount &&
        candidate.isCurrentBest &&
        !existing.isCurrentBest);

    if (keepCurrent) {
      deduplicated.set(signature, candidate);
    }
  }

  const groups = new Map<string, CandidateResult[]>();

  for (const candidate of deduplicated.values()) {
    const key = buildRecommendationGroupSignature(candidate);
    const current = groups.get(key) ?? [];
    current.push(candidate);
    groups.set(key, current);
  }

  const recommendationGroups: CandidateRecommendationGroup[] = [...groups.entries()]
    .map(([groupKey, variants]) => {
      const sortedVariants = [...variants].sort(sortCandidates);

      return {
        deduplicatedExactCount: duplicateCount,
        groupKey,
        representative: sortedVariants[0],
        variants: sortedVariants
      };
    })
    .sort((left, right) => {
      const priceDifference =
        left.representative.displayedDisplayAmount - right.representative.displayedDisplayAmount;

      if (priceDifference !== 0) {
        return priceDifference;
      }

      return sortCandidates(left.representative, right.representative);
    });

  return {
    deduplicatedCandidateCount: deduplicated.size,
    duplicateCount,
    recommendationGroups
  };
}
