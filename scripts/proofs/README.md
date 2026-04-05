# Proof Harness

This folder contains the Phase 0.5 proof scripts that exercise the Trip.com automation boundary before broader MVP implementation.

## Commands

- `npm run proof:install-browser`
  - installs the Playwright Chromium runtime used by the proof scripts
- `npm run proof:session-probe`
  - runs the baseline Trip.com session probe in headless mode
- `npm run proof:packaged-search`
  - runs the baseline Melbourne-to-Guangzhou packaged-search extraction proof against the authenticated browser state
- `npm run proof:deep-verification`
  - drives one selected packaged candidate to the traveler-details page and records the safe pre-purchase price state
- `npm run proof:recovery-resume`
  - invalidates the authenticated Trip.com session, confirms the blocked state, then resumes the run after same-browser recovery

## Manual Authenticated Probe

To establish a reusable authenticated browser context for proof 1, run:

```powershell
$env:FLYEASY_PROOF_HEADFUL="1"
$env:FLYEASY_PROOF_ALLOW_MANUAL_LOGIN="1"
npm run proof:session-probe
```

When the Trip.com window opens:

1. complete login or recovery manually
2. return to the terminal and press Enter
3. let the script capture the post-login state

If the post-login state is classified as `connected`, the script writes an authentication marker into the proof browser-state directory. Future runs can then distinguish:

- anonymous or unverified persistent state
- expired authenticated state
- connected authenticated state

## Artefacts

Each proof run writes:

- `initial.png`
- `initial.html`
- `result.json`

These live under the local FlyEasy app-data artifact path, not the repository.
