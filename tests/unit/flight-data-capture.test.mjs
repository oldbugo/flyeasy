import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeServerSentEvents } from "../../scripts/automation/lib/flight-data-capture.mjs";

test("decodes named JSON events and skips comments", () => {
  const events = decodeServerSentEvents(
    ': keep-alive\n\nevent: flights\ndata: {"itineraryList":[{"price":1215}]}\n\n'
  );

  assert.deepEqual(events, [
    { data: { itineraryList: [{ price: 1215 }] }, event: "flights", id: null, isJson: true }
  ]);
});

test("joins multi-line data and keeps non-JSON data as text", () => {
  const [event] = decodeServerSentEvents("data: line one\ndata: line two\n\n");

  assert.equal(event.data, "line one\nline two");
  assert.equal(event.isJson, false);
  assert.equal(event.event, "message");
});

test("handles CRLF line endings, ids, and a missing trailing blank line", () => {
  const events = decodeServerSentEvents('id: 7\r\ndata: {"done":true}\r\n\r\ndata: last');

  assert.equal(events.length, 2);
  assert.equal(events[0].id, "7");
  assert.deepEqual(events[0].data, { done: true });
  assert.equal(events[1].data, "last");
});

test("returns no events for empty or missing input", () => {
  assert.deepEqual(decodeServerSentEvents(""), []);
  assert.deepEqual(decodeServerSentEvents(null), []);
});
