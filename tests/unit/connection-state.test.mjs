import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSignals,
  classifyConnectionState,
  detectNoResultsState
} from "../../scripts/automation/lib/tripcom-browser.mjs";

const RESULTS_URL = "https://au.trip.com/flights/showfarefirst?dcity=mel&acity=can";
const classify = (title, bodyText, actions = [], url = RESULTS_URL) =>
  classifyConnectionState(buildSignals(url, title, bodyText, actions), url);

test("Trip.com's whaleguard bot-protection page is classified as blocked", () => {
  const result = classify("", "whaleguard block");

  assert.equal(result.state, "blocked");
  assert.match(result.detail, /bot protection/);
});

test("captcha and verification pages are classified as blocked", () => {
  assert.equal(classify("Security check", "Please complete the captcha").state, "blocked");
  assert.equal(classify("", "Verify it's you to continue").state, "blocked");
});

test("a login URL is classified as needing login", () => {
  assert.equal(
    classify("Sign in", "Sign in to continue", [], "https://au.trip.com/account/signin").state,
    "needs_login"
  );
});

test("account signals without a login prompt are classified as authenticated", () => {
  assert.equal(classify("Trip.com", "Trip Coins balance", ["Sign out"]).state, "ready_authenticated");
});

test("an ordinary results page is classified as ready_public", () => {
  assert.equal(
    classify("Cheap Flights from Melbourne to Guangzhou | Trip.com", "45 results Cheapest Direct first", [
      "Select"
    ]).state,
    "ready_public"
  );
});

test("no-results detection only fires on no-results wording", () => {
  assert.ok(detectNoResultsState({ bodyText: "No available flights for your search" }));
  assert.equal(detectNoResultsState({ bodyText: "45 results sorted by cheapest" }), null);
});
