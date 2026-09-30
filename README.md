# FlyEasy

FlyEasy is a local-first desktop app for planning and monitoring Trip.com flight hunts.

It is built for trips where you care about more than a single cheapest fare. You can define a route, travel window, trip length, stopover rules, and monitoring preferences, then let FlyEasy run Trip.com searches locally and keep the results in one workspace.

Core capabilities:

- create a trip session with route and date constraints
- monitor Guangzhou and other China-bound fare hunts over time
- run local Playwright-powered Trip.com searches
- review candidate itineraries, progress, and run history
- keep browser state and search data on the local machine

## Open The App

### Windows installer

The simplest way to open FlyEasy is from the packaged Windows app:

1. Download the latest `FlyEasy-Setup-*.exe` from GitHub Releases.
2. Run the installer.
3. Open FlyEasy from the Start menu or desktop shortcut.

Notes:

- On first launch, FlyEasy may take longer to open because it prepares the local browser automation runtime.
- Playwright Chromium is installed into the user's FlyEasy app-data directory on first use instead of being fully bundled into the installer.
- The first empty install creates one minimal example Guangzhou session automatically so the app is not blank.

### Local development

To run the app locally from the repo:

```bash
npm install
npm run dev:desktop
```

That starts the Next.js UI and opens the Electron shell pointed at the local app runtime.

## Testing

```bash
npx playwright install chromium
npm test
```

`npm test` builds the app and runs everything (about 2.5 minutes). Parts can be run on their own:

- `npm run test:unit`: fast checks for block detection, flight-data decoding and progress summaries
- `npm run test:browser`: result-page helpers and the card parser against saved Trip.com pages
- `npm run test:worker`: the real search worker and queue dispatcher, end to end
- `npm run test:app`: builds the app, then opens every page as a plain browser and as the Electron window and fails on any console error (such as React hydration mismatches)

The browser and worker tests never contact Trip.com. They use a local fake site (`tests/support/fake-tripcom.mjs`) that serves saved result pages from `tests/fixtures/tripcom/`, and each test gets its own data folder under `.tmp/tests/` with a fresh database. Set `FLYEASY_KEEP_TEST_DATA=1` to keep those folders for inspection.

GitHub Actions runs lint, typecheck and the full test suite on every push and pull request ([.github/workflows/tests.yml](.github/workflows/tests.yml)).

## Windows Packaging

FlyEasy can now be packaged as a Windows installer:

- `npm run dist:win` builds a Windows `.exe` installer into `release/`
- the packaged app starts its own local Next.js server through a bundled Node runtime instead of depending on `next dev`
- Playwright Chromium is installed on first launch into the user's FlyEasy app-data directory so the installer stays smaller
- `release/win-unpacked/FlyEasy.exe` runs the built app directly; keep the entire `win-unpacked` folder together.
- Native dependencies are built for the bundled Node runtime. Electron Builder's automatic Electron ABI rebuild is disabled because SQLite runs in the separate Node server.

After packaging, `npm run proof:desktop` checks the executable, preload bridge, local database, main pages (including errors logged in the window), and server shutdown using an isolated `.tmp/` data folder. Set `FLYEASY_SMOKE_BROWSER_CACHE` to an existing Playwright browser cache to reuse its Chromium installation during this check.

GitHub Actions in [.github/workflows/windows-release.yml](.github/workflows/windows-release.yml) will build the installer on tag pushes like `v1.0.0` and attach it to a draft GitHub Release.

## Tech stack

- Electron desktop shell
- Next.js UI and local app server
- Playwright for Trip.com automation
- SQLite for local persistence

## Planning docs

See [docs/planning/README.md](docs/planning/README.md) for the current planning index and implementation direction.
