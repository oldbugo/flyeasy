# FlyEasy

FlyEasy is a local-first desktop travel-hunt app for finding and verifying low-cost Trip.com flight options.

## Current Direction

The project is planned as:

- an Electron-packaged local app
- a Next.js UI with session-first workflows
- Playwright automation for Trip.com search and verification
- SQLite for local persistence
- OS-backed secure storage for credentials and API keys

## MVP Focus

The true MVP is intentionally narrow:

- session creation and editing
- one reliable packaged Trip.com search flow
- candidate extraction and results review
- deep verification for the top few candidates
- recovery for login/session interruptions

Stitched search, broader search expansion, and AI strategy generation are planned after the core trust loop is proven.

## Windows Packaging

FlyEasy can now be packaged as a Windows installer:

- `npm run dist:win` builds a Windows `.exe` installer into `release/`
- the packaged app starts its own local Next.js server through a bundled Node runtime instead of depending on `next dev`
- Playwright Chromium is installed on first launch into the user's FlyEasy app-data directory so the installer stays smaller

GitHub Actions in [.github/workflows/windows-release.yml](.github/workflows/windows-release.yml) will build the installer on tag pushes like `v1.0.0` and attach it to a draft GitHub Release.

## Planning Docs

See [docs/planning/README.md](docs/planning/README.md) for the current planning index and implementation direction.
