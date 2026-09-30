// A local stand-in for Trip.com, serving saved result pages so the search
// worker can be tested end to end without touching the real site.
import fs from "node:fs";
import http from "node:http";

const fixtureDir = new URL("../fixtures/tripcom/", import.meta.url);
const readFixture = (name) => fs.readFileSync(new URL(name, fixtureDir), "utf8");

// Mimics the two interactions the worker relies on: the "Cheapest" sort tab
// and the per-card select button that moves to the return stage.
const INTERACTION_SCRIPT = `<script>
document.addEventListener("click", (event) => {
  const tab = event.target.closest('[data-testid^="sort_type_item_"]');
  if (tab) {
    document.querySelectorAll('[data-testid^="sort_type_item_"]').forEach((node) => {
      node.setAttribute("aria-selected", node === tab ? "true" : "false");
    });
  }
  if (event.target.closest('[data-testid="u_select_btn"]') && location.pathname.endsWith("/showfarefirst")) {
    const next = "/flights/showfarenext" + location.search;
    if (window.__FAKE_REPLACE_HISTORY__) {
      location.replace(next);
    } else {
      location.assign(next);
    }
  }
});
fetch("/restapi/soa2/27015/FlightListSearchSSE", { method: "POST", body: "{}" });
</script>`;

export const FLIGHT_LIST_STREAM =
  'event: flights\ndata: {"itineraryList":[{"price":1215}]}\n\n' + 'data: {"done":true}\n\n';

const HOME_PAGE = `<!doctype html><html><head><title>Cheap Flights | Trip.com</title></head>
<body><h1>Flights</h1><p>Search cheap flights and airline tickets.</p><button>Search</button></body></html>`;
const BLOCK_PAGE = "<html><body><pre>whaleguard block</pre></body></html>";
const EMPTY_RESULTS_PAGE = `<!doctype html><html><head><title>Flights | Trip.com</title></head>
<body><p>Loading flights...</p></body></html>`;

const withScript = (html, { replaceHistory = false } = {}) =>
  html.replace(
    /<\/body>/i,
    `${replaceHistory ? "<script>window.__FAKE_REPLACE_HISTORY__ = true;</script>" : ""}${INTERACTION_SCRIPT}</body>`
  );

/**
 * Modes:
 *  - "normal": real saved outbound and return pages
 *  - "blocked": every page is Trip.com's bot-protection block page
 *  - "results-blocked": home page works, result pages are blocked
 *  - "no-results-ever": result pages never show flight cards (timeouts)
 *  - "select-replaces-history": selecting a flight replaces the history entry,
 *    so going back cannot return to the outbound list
 */
export async function startFakeTripcom({ mode = "normal" } = {}) {
  const pages = {
    outbound: withScript(readFixture("outbound-results.html"), {
      replaceHistory: mode === "select-replaces-history"
    }),
    return: withScript(readFixture("return-results.html"))
  };
  const requestCounts = {};

  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    requestCounts[pathname] = (requestCounts[pathname] ?? 0) + 1;

    const send = (body, contentType = "text/html; charset=utf-8") => {
      response.writeHead(200, { "content-type": contentType });
      response.end(body);
    };

    if (pathname.endsWith("/FlightListSearchSSE")) {
      return send(FLIGHT_LIST_STREAM, "text/event-stream");
    }

    if (mode === "blocked") {
      return send(BLOCK_PAGE);
    }

    if (pathname === "/flights/" || pathname === "/flights") {
      return send(HOME_PAGE);
    }

    if (pathname === "/flights/showfarefirst" || pathname === "/flights/showfarenext") {
      if (mode === "results-blocked") {
        return send(BLOCK_PAGE);
      }

      if (mode === "no-results-ever") {
        return send(EMPTY_RESULTS_PAGE);
      }

      return send(pathname.endsWith("showfarefirst") ? pages.outbound : pages.return);
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    requestCounts,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
