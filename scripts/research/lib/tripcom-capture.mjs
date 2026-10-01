// Records the flight-list and price-calendar responses a Trip.com results
// page downloads anyway. Nothing is requested beyond a normal page load.

import { CALENDAR_URL_PATTERN, parseLowPriceCalendar } from "./parse-calendar.mjs";
import {
  FLIGHT_LIST_URL_PATTERN,
  findFlightListPayload,
  parseFlightListPayload
} from "./parse-flight-list.mjs";
import { decodeServerSentEvents } from "../../automation/lib/flight-data-capture.mjs";

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    const events = decodeServerSentEvents(text);
    return events.length > 0 ? { events } : null;
  }
}

export function attachTripcomCapture(page) {
  const flightLists = [];
  const calendars = [];
  const raw = [];
  const pending = new Set();
  let lastListAt = 0;

  page.on("response", (response) => {
    const url = response.url();
    const isList = FLIGHT_LIST_URL_PATTERN.test(url);
    const isCalendar = CALENDAR_URL_PATTERN.test(url);

    if (!isList && !isCalendar) {
      return;
    }

    const task = response
      .text()
      .then((text) => {
        const body = parseBody(text);
        const requestBody = response.request().postData() ?? null;
        raw.push({ kind: isList ? "flight_list" : "calendar", requestBody, text, url: url.split("?")[0] });

        if (isList) {
          const parsed = parseFlightListPayload(findFlightListPayload(body));
          if (parsed) {
            flightLists.push({ at: Date.now(), parsed });
            lastListAt = Date.now();
          }
        } else if (body) {
          calendars.push({ parsed: parseLowPriceCalendar(body), requestBody });
        }
      })
      .catch(() => {})
      .finally(() => pending.delete(task));
    pending.add(task);
  });

  return {
    calendars,
    flightLists,
    raw,

    listsForStage(stage, orderBy = null) {
      return flightLists
        .filter((entry) => entry.parsed.stage === stage && (!orderBy || entry.parsed.orderBy === orderBy))
        .map((entry) => entry.parsed);
    },

    // Wait for the first list with itineraries for `stage`, then for the
    // list responses to go quiet (Trip.com may poll for more results).
    async waitForList(stage, { orderBy = null, quietMs = 2_000, timeoutMs = 45_000 } = {}) {
      const startedAt = Date.now();
      const hasList = () =>
        flightLists.some(
          (entry) =>
            entry.parsed.stage === stage &&
            entry.parsed.itineraries.length > 0 &&
            (!orderBy || entry.parsed.orderBy === orderBy)
        );

      while (Date.now() - startedAt < timeoutMs) {
        if (hasList() && Date.now() - lastListAt >= quietMs && pending.size === 0) {
          return true;
        }
        await page.waitForTimeout(200);
      }

      await Promise.all([...pending]);
      return hasList();
    },

    async flush() {
      await Promise.all([...pending]);
    }
  };
}
