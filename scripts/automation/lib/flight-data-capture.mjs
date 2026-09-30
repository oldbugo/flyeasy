import fs from "node:fs/promises";
import path from "node:path";

// Trip.com's results page streams its flight list from this endpoint.
const FLIGHT_LIST_URL_PATTERN = /\/FlightListSearch/i;
const MAX_BODY_CHARS = 5_000_000;

// Decode a text/event-stream body into events, following the WHATWG
// server-sent events format. Data that parses as JSON is returned parsed.
export function decodeServerSentEvents(text) {
  const events = [];

  for (const block of String(text ?? "").replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    let eventName = "message";
    let eventId = null;
    const dataLines = [];

    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) {
        continue;
      }

      const separatorIndex = line.indexOf(":");
      const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      let value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);

      if (value.startsWith(" ")) {
        value = value.slice(1);
      }

      if (field === "data") {
        dataLines.push(value);
      } else if (field === "event") {
        eventName = value;
      } else if (field === "id") {
        eventId = value;
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    const rawData = dataLines.join("\n");
    let parsedData = null;

    try {
      parsedData = JSON.parse(rawData);
    } catch {
      parsedData = null;
    }

    events.push({
      data: parsedData ?? rawData,
      event: eventName,
      id: eventId,
      isJson: parsedData !== null
    });
  }

  return events;
}

// Saves a bounded number of the flight-list responses the results page
// already downloads, so a structured parser can be built and tested against
// real data. Recording never changes how the page is scraped.
export function createFlightDataRecorder({ artifactRecords, maxSamples = 3, runDir }) {
  let sampleCount = 0;
  const pendingWrites = new Set();

  async function saveResponse(response, label, sampleIndex) {
    const filePath = path.join(runDir, `${label}-flight-list-${sampleIndex}.json`);
    let body = null;
    let bodyError = null;

    try {
      body = await response.text();
    } catch (error) {
      bodyError = error instanceof Error ? error.message : String(error);
    }

    const record = {
      bodyError,
      capturedAt: new Date().toISOString(),
      contentType: response.headers()["content-type"] ?? null,
      events: body ? decodeServerSentEvents(body) : [],
      rawBody: body ? body.slice(0, MAX_BODY_CHARS) : null,
      rawBodyTruncated: Boolean(body && body.length > MAX_BODY_CHARS),
      status: response.status(),
      url: response.url().split("?")[0]
    };

    await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
    artifactRecords.push({
      filePath,
      mimeType: "application/json",
      notes: `Trip.com flight-list response sample ${sampleIndex}${bodyError ? " (body unavailable)" : ""}.`,
      type: "json_export"
    });
  }

  return {
    attach(page, label) {
      page.on("response", (response) => {
        if (sampleCount >= maxSamples || !FLIGHT_LIST_URL_PATTERN.test(response.url())) {
          return;
        }

        sampleCount += 1;
        const write = saveResponse(response, label, sampleCount)
          .catch(() => {
            // Samples are diagnostic; never let them fail a search.
          })
          .finally(() => pendingWrites.delete(write));
        pendingWrites.add(write);
      });
    },

    // Wait for in-flight samples before their artifact records are persisted.
    async flush() {
      await Promise.all([...pendingWrites]);
    }
  };
}
