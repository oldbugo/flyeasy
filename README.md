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

## Planning Docs

See [docs/planning/README.md](docs/planning/README.md) for the current planning index and implementation direction.
