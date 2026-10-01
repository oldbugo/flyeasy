// Parses Trip.com GetLowPriceInCalender responses. Calendar prices come from
// Trip.com's cache and are treated as unverified hints, never as fares:
// `-1` cells become null (unknown), not "expensive".

export const CALENDAR_URL_PATTERN = /\/getLowPriceInCalender/i;

function epochSecondsToIsoDate(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  // Trip.com sends midnight of the calendar day as epoch seconds.
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function parseLowPriceCalendar(payload) {
  const rows = Array.isArray(payload?.lowPriceInCalenderDtoInfoList)
    ? payload.lowPriceInCalenderDtoInfoList
    : [];
  const cells = [];

  for (const row of rows) {
    const departDate = epochSecondsToIsoDate(row?.dDate);
    if (!departDate) {
      continue;
    }

    const price = Number(row?.currencyPrice ?? row?.originPrice);
    cells.push({
      departDate,
      price: Number.isFinite(price) && price > 0 ? price : null,
      returnDate: epochSecondsToIsoDate(row?.aDate),
      segmentNo: row?.segmentNo ?? null
    });
  }

  const kind = cells.some((cell) => cell.returnDate) ? "round_trip_grid" : "one_way_daily";
  const priced = cells.filter((cell) => cell.price !== null);
  const dates = cells.map((cell) => cell.departDate).sort();

  return {
    cells,
    currency: payload?.currency ?? null,
    firstDate: dates[0] ?? null,
    kind,
    lastDate: dates[dates.length - 1] ?? null,
    lowestPrice: Number(payload?.lowestCurrencyPrice) || null,
    pricedCellCount: priced.length,
    totalCellCount: cells.length
  };
}
