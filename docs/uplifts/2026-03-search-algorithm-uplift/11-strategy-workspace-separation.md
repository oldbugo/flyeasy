# Strategy Workspace Separation

## Status

`Complete`

## Why this change was needed

The `Search strategy` tab had drifted into a mixed workspace.

It was showing:

- strategy explanation
- strategy controls
- latest search outcomes
- analysis insight boards

That made the page harder to use because strategy planning and run outcomes are
two different jobs.

## Decision

The session workspace is now split more cleanly:

- `Overview` keeps concise summaries
- `Results` holds detailed outcome and insight boards
- `Trip settings` holds route and rule configuration
- `Search strategy` stays focused on what each strategy does and how it can be
  configured
- `History` stays focused on reruns and continuity

## What changed

- removed baseline, multi-city, and alternate-city outcome boards from the
  strategy tab
- added a concise search-insight summary to `Overview`
- added detailed search-outcome boards to `Results`
- reordered the tabs to:
  - Overview
  - Results
  - Trip settings
  - Search strategy
  - History
- renamed the visible `Search settings` tab to `Trip settings`
- changed new run and rerun launches to send the user to `Results`

## Result

The session workspace now has a clearer division of responsibility:

- planning stays in strategy
- constraints stay in trip settings
- summaries stay in overview
- details stay in results
