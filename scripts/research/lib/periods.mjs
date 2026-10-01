// Fixed research configuration from docs/uplifts/2026-10-date-search-strategy/03.

export const ROUTE = {
  destinationCity: "CAN",
  originAirport: "MEL"
};

export const PERIODS = {
  A: {
    departureEnd: "2026-12-31",
    departureStart: "2026-12-01",
    durationMax: 21,
    durationMin: 14,
    label: "Dec 2026 departures",
    // Spread across the window and the price range seen in earlier runs.
    sentinels: [
      ["2026-12-03", "2026-12-17"],
      ["2026-12-10", "2026-12-24"],
      ["2026-12-14", "2026-12-28"],
      ["2026-12-18", "2027-01-01"],
      ["2026-12-22", "2027-01-05"],
      ["2026-12-26", "2027-01-09"]
    ]
  },
  B: {
    departureEnd: "2027-06-30",
    departureStart: "2027-03-01",
    durationMax: 21,
    durationMin: 14,
    label: "Mar–Jun 2027 departures",
    sentinels: [
      ["2027-03-03", "2027-03-17"],
      ["2027-03-24", "2027-04-10"],
      ["2027-04-14", "2027-04-28"],
      ["2027-05-05", "2027-05-26"],
      ["2027-05-26", "2027-06-09"],
      ["2027-06-16", "2027-07-02"]
    ]
  }
};

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round(
    (new Date(`${toIso}T00:00:00.000Z`).getTime() - new Date(`${fromIso}T00:00:00.000Z`).getTime()) /
      86_400_000
  );
}

export function departureDates(period) {
  const dates = [];
  for (let date = period.departureStart; date <= period.departureEnd; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function returnDates(period) {
  const dates = [];
  const last = addDays(period.departureEnd, period.durationMax);
  for (let date = addDays(period.departureStart, period.durationMin); date <= last; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function datePairs(period) {
  return departureDates(period).flatMap((departDate) =>
    Array.from({ length: period.durationMax - period.durationMin + 1 }, (_, index) => ({
      departDate,
      durationDays: period.durationMin + index,
      returnDate: addDays(departDate, period.durationMin + index)
    }))
  );
}

// Deterministic shuffle, so collection order is random but resumable.
export function seededShuffle(values, seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}
