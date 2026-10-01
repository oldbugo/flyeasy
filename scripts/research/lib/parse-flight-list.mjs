// Parses Trip.com FlightListSearch(SSE) responses into compact itineraries so
// research datasets can apply any session filter after collection.

import { CHINA_BASED_AIRLINE_CODES } from "../../automation/lib/china-based-airlines.mjs";

export const FLIGHT_LIST_URL_PATTERN = /\/FlightListSearch/i;

function readPolicyPrice(policy) {
  const price = Number(policy?.price?.totalPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function hasTag(policy, key) {
  return (policy?.tagList ?? []).some((tag) => tag?.key === key);
}

function readTagContent(policy, key) {
  return (policy?.tagList ?? []).find((tag) => tag?.key === key)?.content ?? null;
}

function compactJourney(journey) {
  const sections = (journey?.transSectionList ?? []).filter(
    (section) => section?.transportType === "FLIGHT" || section?.flightInfo
  );
  const first = sections[0];
  const last = sections[sections.length - 1];

  return {
    airlines: sections.map((section) => section?.flightInfo?.airlineCode ?? null),
    arriveAt: last?.arriveDateTime ?? null,
    departAt: first?.departDateTime ?? null,
    durationMinutes: Number(journey?.duration ?? 0) || null,
    flightNumbers: sections.map((section) => section?.flightInfo?.flightNo ?? null),
    journeyNo: Number(journey?.journeyNo ?? 0),
    transferCities: sections.slice(0, -1).map((section) => section?.arrivePoint?.cityCode ?? null)
  };
}

// One itinerary can carry several fare policies; the cheapest one is what the
// card shows, so it is the one kept.
export function compactItinerary(itinerary) {
  const policies = (itinerary?.policies ?? [])
    .map((policy) => ({ policy, price: readPolicyPrice(policy) }))
    .filter((entry) => entry.price !== null)
    .sort((left, right) => left.price - right.price);
  const cheapest = policies[0];

  if (!cheapest) {
    return null;
  }

  const journeys = (itinerary?.journeyList ?? []).map(compactJourney);
  const airlines = [...new Set(journeys.flatMap((journey) => journey.airlines).filter(Boolean))];

  return {
    airlines,
    baggageIncluded: hasTag(cheapest.policy, "FREE_CHECKED_BAGGAGE"),
    journeys,
    price: cheapest.price,
    productCategory: readTagContent(cheapest.policy, "PRODUCT_CATEGORY"),
    stops: Math.max(0, ...journeys.map((journey) => journey.transferCities.length)),
    transferCities: [...new Set(journeys.flatMap((journey) => journey.transferCities).filter(Boolean))],
    uniqueId: journeys.map((journey) => journey.flightNumbers.join("+")).join("|")
  };
}

export function findFlightListPayload(record) {
  const events = Array.isArray(record?.events) ? record.events : [record];

  for (const event of events) {
    const data = event?.data ?? event;
    if (data && typeof data === "object" && Array.isArray(data.itineraryList)) {
      return data;
    }
  }

  return null;
}

function readFilterMinima(filterOptionList, key, idField) {
  const minima = {};

  for (const option of filterOptionList ?? []) {
    for (const entry of option?.[key] ?? []) {
      const id = entry?.[idField];
      const price = Number(entry?.lowestTotalPrice ?? entry?.lowestPrice);

      if (id && Number.isFinite(price) && price > 0) {
        minima[id] = Math.min(minima[id] ?? Number.POSITIVE_INFINITY, price);
      }
    }
  }

  return minima;
}

export function parseFlightListPayload(payload) {
  if (!payload) {
    return null;
  }

  const basicInfo = payload.basicInfo ?? {};
  const selectJourneyList = basicInfo.searchCondition?.selectJourneyList ?? [];
  const itineraries = (payload.itineraryList ?? []).map(compactItinerary).filter(Boolean);

  return {
    airlineMinima: readFilterMinima(payload.filterOptionList, "airlineFilters", "code"),
    currency: basicInfo.currency ?? null,
    itineraries,
    lowestPrice: Number(basicInfo.lowestPrice?.totalPrice) || null,
    // Only "Price" lists are complete cheapest-first lists; a "Direct" or
    // recommended sort can leave out the cheapest fares.
    orderBy: basicInfo.searchCondition?.orderBy ?? null,
    recordCount: Number(basicInfo.recordCount ?? itineraries.length),
    // A non-empty selection means this list is the return stage of a round trip.
    stage: selectJourneyList.length > 0 ? "return" : "first",
    transferMinima: readFilterMinima(payload.filterOptionList, "transferFilters", "cityCode")
  };
}

// Trip.com may stream or poll the list in several responses; merge them,
// keeping the cheapest price seen per itinerary.
export function mergeFlightLists(lists) {
  const present = lists.filter(Boolean);

  if (present.length === 0) {
    return null;
  }

  const byId = new Map();
  const airlineMinima = {};
  const transferMinima = {};

  for (const list of present) {
    for (const itinerary of list.itineraries) {
      const existing = byId.get(itinerary.uniqueId);
      if (!existing || itinerary.price < existing.price) {
        byId.set(itinerary.uniqueId, itinerary);
      }
    }

    for (const [target, source] of [
      [airlineMinima, list.airlineMinima],
      [transferMinima, list.transferMinima]
    ]) {
      for (const [key, price] of Object.entries(source)) {
        target[key] = Math.min(target[key] ?? Number.POSITIVE_INFINITY, price);
      }
    }
  }

  const itineraries = [...byId.values()].sort((left, right) => left.price - right.price);
  const last = present[present.length - 1];

  return {
    airlineMinima,
    currency: last.currency,
    itineraries,
    lowestPrice: itineraries[0]?.price ?? last.lowestPrice,
    orderBy: last.orderBy,
    recordCount: Math.max(...present.map((list) => list.recordCount)),
    stage: last.stage,
    transferMinima
  };
}

export const ITINERARY_FILTERS = {
  any: () => true,
  chinese_airlines: (itinerary) =>
    itinerary.airlines.length > 0 && itinerary.airlines.every((code) => CHINA_BASED_AIRLINE_CODES.has(code)),
  single_ticket: (itinerary) => itinerary.productCategory !== "MultiTicket",
  baggage_included: (itinerary) => itinerary.baggageIncluded
};

export function cheapestUnderFilters(itineraries, filterNames) {
  const filters = filterNames.map((name) => ITINERARY_FILTERS[name]);
  const match = itineraries.find((itinerary) => filters.every((filter) => filter(itinerary)));
  return match ? { airlines: match.airlines, price: match.price, transferCities: match.transferCities } : null;
}

// The per-airline minimum price over itineraries where that airline flies
// every segment. Trip.com's own airlineFilters also counts mixed itineraries.
export function singleAirlineMinima(itineraries) {
  const minima = {};

  for (const itinerary of itineraries) {
    if (itinerary.airlines.length === 1) {
      const [code] = itinerary.airlines;
      minima[code] = Math.min(minima[code] ?? Number.POSITIVE_INFINITY, itinerary.price);
    }
  }

  return minima;
}

export function summarizeFlightList(list, { keepItineraries = 40 } = {}) {
  if (!list) {
    return null;
  }

  const variants = {
    any: cheapestUnderFilters(list.itineraries, ["any"]),
    chinese_airlines: cheapestUnderFilters(list.itineraries, ["chinese_airlines"]),
    single_ticket: cheapestUnderFilters(list.itineraries, ["single_ticket"]),
    chinese_single_ticket: cheapestUnderFilters(list.itineraries, ["chinese_airlines", "single_ticket"])
  };

  return {
    airlineMinima: list.airlineMinima,
    cheapest: Object.fromEntries(Object.entries(variants).map(([key, value]) => [key, value?.price ?? null])),
    cheapestDetail: variants,
    currency: list.currency,
    itineraryCount: list.itineraries.length,
    orderBy: list.orderBy,
    itineraries: list.itineraries.slice(0, keepItineraries),
    recordCount: list.recordCount,
    singleAirlineMinima: singleAirlineMinima(list.itineraries),
    stage: list.stage,
    transferMinima: list.transferMinima
  };
}
