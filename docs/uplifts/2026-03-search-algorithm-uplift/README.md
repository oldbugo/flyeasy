# Search Algorithm Uplift

## Context

FlyEasy's search behavior has improved through several focused uplifts, but the
core search methodology is still too fixed in shape.

The current implementation has a strong audit trail and a better query model
than the early baseline, yet it still behaves like a fixed pipeline:

- strategy order is hard-coded from `searchIntensity`
- the follow-up branches are narrow and predetermined
- the so-called AI suggestion layer is deterministic template generation, not a
  real inference or recommendation system

The key strategic recognition for the next iteration is simple:

- there is no single best search strategy
- the system needs to choose among multiple search patterns dynamically
- any suggestion layer must be honest about what it is and useful in practice

## Goal

Create an umbrella uplift record for the search algorithm work so later changes
can be grouped under one navigable theme instead of being scattered across
unrelated point fixes.

This planning uplift should:

- review the current search/scanning artefacts end to end
- explain how the current system actually works
- capture the main strategic gaps
- define a phased plan for the next search-methodology changes

## Scope

Included in this uplift:

- planning-doc review
- existing uplift review
- runtime search-flow review
- UI and persistence review for strategy planning and suggestion behavior
- a phased next-steps plan

Excluded from this uplift:

- changing the live search worker
- renaming UI copy
- replacing the current proposal system
- introducing a real model-backed recommendation service

## Folder Map

- `01-current-state-review.md`
  - artefacts reviewed
  - actual runtime flow today
  - strengths, constraints, and strategic gaps
- `02-next-steps-plan.md`
  - design principles
  - phased uplift plan
  - recommended sequence for implementation
- `03-session-strategy-bundles-and-tab.md`
  - first implemented slice
  - bundle-based session strategy selection
  - new session tab and planner integration
- `04-pass-level-strategy-controls.md`
  - pass-by-pass explanations inside the strategy tab
  - toggle visibility for every pass
  - plain-language wording and inline tooltips
- `05-round-trip-baseline-and-multi-city-cluster.md`
  - renamed baseline strategy
  - stopover work split into its own strategy cluster
  - expected inputs and outputs shown per strategy
  - richer multi-city evidence ranking before live verification
  - long-stop validation stage plus evidence visibility
- `06-long-stop-followup-pass.md`
  - first true long-stop query pass
  - duration-aware stopover filtering
  - latest long-stop follow-up evidence in the session and run UI
- `07-shared-evidence-layer.md`
  - first extracted shared evidence module
  - multi-city ranking and validation moved behind reusable helpers
  - groundwork for future strategy families
- `08-alternate-return-city-exploration.md`
  - new alternate-city strategy cluster
  - bounded round-trip comparison probes for flexible return-origin sessions
  - comparison-board evidence for alternate mainland cities
- `09-program-transparency-and-suggestion-wording.md`
  - compiled search-program preview
  - estimated pre-run query budget visibility
  - honest deterministic suggestion wording
- `10-baseline-round-trip-insights-board.md`
  - shared round-trip baseline evidence board
  - cheapest dates, airlines, and date-airline combinations
  - clearer baseline outcome visibility in both session and run views
- `11-strategy-workspace-separation.md`
  - moved summaries to overview and detailed insight boards to results
  - kept search strategy focused on explanation and control
  - reordered session tabs and renamed `Search settings` to `Trip settings`
- `12-results-timeline-accordions-and-grouping.md`
  - expandable live-timeline rows with exact flight details
  - stricter timing-only grouping for similar routes
  - more honest grouped-variant presentation in results
- `13-direct-sweep-distinct-card-selection.md`
  - broader direct-sweep card scanning before branch selection
  - distinct-card grouping tightened around price, airline, stopover, and schedule
  - branch budgets now apply to cheapest distinct options instead of the first raw block
- `14-baseline-return-option-expansion-and-family-coverage.md`
  - bounded deep-return expansion inside the baseline
  - family-coverage selection before same-family repeats
  - stop spending extra queries when repeated family expansion stops surfacing new stopover clues
- `15-baseline-handoff-and-results-visibility.md`
  - structured baseline handoff candidate set
  - results and overview visibility for baseline expansion coverage
  - stronger data foundation for later strategy consumption
- `16-multi-city-seed-based-verification.md`
  - baseline city-entry board and city-date-airline matrix
  - multi-city verification rewritten around baseline seed contexts
  - cheapest verified multi-city outcomes surfaced in results and live run progress
- `17-intentional-stopover-foundation-and-outcomes.md`
  - baseline candidates now persist visible-card stopover rows
  - multi-city outcomes now distinguish verified stopover fares from intentional-stop outcomes
  - results and run progress now call out intentional-stop matches explicitly
- `18-historical-direct-sweep-hypotheses.md`
  - historical direct-sweep review against completed run data
  - candidate hypotheses for search-efficiency uplift
  - rationale for choosing adaptive coverage over simple replay
- `19-adaptive-coverage-baseline-and-efficiency-insights.md`
  - second selectable baseline strategy
  - adaptive direct-sweep budget allocation
  - run-level baseline efficiency board for comparison
- `20-baseline-experiment-loop-and-continuous-refinement.md`
  - session-level baseline strategy lab
  - champion-versus-challenger comparison loop
  - continuous refinement workflow for future baseline changes
- `21-parallel-baseline-experiment-mode.md`
  - strategy-tab experiment toggle for manual baseline suites
  - stored experiment groups and arm tagging
  - latest-suite comparison visibility in overview and results
- `22-multi-city-outcome-visibility.md`
  - explicit qualifying vs near-miss multi-city outcome states in results
  - cheapest verified fallback visibility when no qualifying trip exists
  - stitched placeholder no longer fakes intentional-stop badges
- `23-anchored-true-multi-city-search.md`
  - new true Trip.com multi-city strategy bundle
  - bounded three-leg anchored multi-city adapter
  - explicit true multi-city outcome boards in results and run progress
- `24-single-worker-live-automation-queue.md`
  - prevented concurrent live Trip.com workers
  - added a dispatcher-backed single-worker queue
  - baseline experiment suites now run through the same queue
- `25-trip-settings-baggage-and-chinese-airline-filters.md`
  - added trip-setting constraints for included checked baggage
  - added a mainland China airline-only constraint
  - enforced both filters directly in the live Trip.com worker
- `26-overview-multi-city-recommendations-and-results-separation.md`
  - added a dedicated top multi-city recommendations tab in overview
  - split the results timeline into round-trip and multi-city sections
  - started persisting true multi-city trip shape for anchored multi-city candidates

Future search-related uplift records should live in this folder when they are
part of the same algorithmic redesign thread.

## Related History

This umbrella builds on:

- `../2026-03-query-led-search-model/README.md`
- `../2026-03-pass1-analysis-layer/README.md`
- `../2026-03-stopover-followup-card-matching/README.md`
- `../2026-03-tripcom-combination-branch-search/README.md`
- `../../planning/foundation/search-strategy.md`

## Outcome

This folder now acts as the anchor point for the broader search algorithm
redesign.

It now contains:

- the original current-state review
- the revised plan shaped by the bundle-based strategy discussion
- the first implemented slice:
  - session-visible strategy bundles
  - a new `Search strategy` tab
  - planner compilation from session strategy selection
- the next UX refinement:
  - pass-level controls inside the strategy tab
  - read-only toggles for required passes
  - expandable explanations and tooltips
- the next strategy-model refinement:
  - `Round trip baseline` naming
  - a dedicated `Multi-city verification` cluster
  - explicit expected inputs and outputs per strategy
  - ranked multi-city evidence derived from round-trip winners and pass-1 trends
  - long-stop readiness analysis surfaced in the UI
- the next executable multi-city milestone:
  - a real long-stop follow-up query pass
  - duration-aware candidate filtering for longer-stop work
  - long-stop follow-up evidence surfaced in the session and run UI
- the next architectural milestone:
  - extracted shared evidence helpers for the multi-city family
  - less scoring logic embedded directly in the worker
  - a better seam for future strategy clusters
- the next bundle-catalog milestone:
  - a dedicated alternate return-city exploration cluster
  - bounded comparison probes for flexible return-origin sessions
  - reusable alternate-city comparison evidence
- the next trip-settings constraint milestone:
  - included checked-baggage filtering from the trip settings page
  - mainland China airline filtering from the trip settings page
  - worker-side enforcement so the search budget only covers eligible cards
- the next presentation-separation milestone:
  - overview can now highlight top multi-city trips separately from normal recommendations
  - results timeline now separates round-trip and multi-city route lines
  - true anchored multi-city candidates now persist an explicit multi-city trip shape
- the next transparency milestone:
  - compiled search-program preview on the strategy page
  - pre-run query budget visibility
  - system-suggestion wording instead of misleading AI copy
- the next baseline-visibility milestone:
  - a shared round-trip baseline insights board
  - clearer evidence for cheapest dates, cheapest airlines, and cheap
    date-airline pairings
  - the same baseline board adapted into overview summaries and results detail
- the next workspace-separation milestone:
  - outcome summaries moved out of search strategy
  - overview now carries concise search insight summaries
  - results now carries the detailed insight boards
  - run launches land on results instead of the run-detail page
- the next results-surface milestone:
  - timeline rows expand as accordions
  - grouped variants expose exact flight details
  - similar-route grouping is restricted to timing variants of the same flight chain
- the next baseline-selection milestone:
  - direct sweep scans broader visible card sets before branch selection
  - outbound and return branch budgets now apply to cheapest distinct cards
  - clustered duplicates are less likely to crowd out the next meaningful candidate family
- the next baseline-depth milestone:
  - a bounded return-option expansion pass now sits inside the baseline
  - expansion targets are chosen by family coverage before same-family repeats
  - repeated family expansion is deprioritised once it stops surfacing new stopover-city clues
- the next baseline-handoff milestone:
  - the baseline now records a structured follow-up candidate family set
  - results and overview show baseline expansion coverage and baseline handoff candidates
  - later strategies now have a cleaner artifact to consume than raw candidate rows alone
- the next multi-city-algorithm milestone:
  - the baseline handoff now carries city-entry and city-date-airline planning boards
  - multi-city verification now reviews bounded baseline seed contexts instead of the
    raw cheapest stopover candidates alone
  - multi-city results now show the cheapest verified multi-city trip overall and per city
- the next intentional-stop foundation milestone:
  - baseline candidates now persist stopover rows from visible Trip.com cards
  - multi-city outcomes now treat `cheapest multi-city trip` as the cheapest
    intentional-stop result within the session stop window
  - results and run progress now distinguish intentional-stop outcomes from
    generic verified stopover fares
- the next efficiency-experiment milestone:
  - historical direct-sweep data now drives explicit search-efficiency hypotheses
  - FlyEasy now has an `Adaptive coverage baseline` alongside the stable baseline
  - results and run progress now expose baseline execution efficiency so the two
    baselines can be compared on real runs
- the next refinement-loop milestone:
  - overview and results now aggregate recent baseline runs by strategy
  - the session surfaces now show a lightweight leader readout instead of
    relying on one-off manual inspection
  - future baseline changes can now be evaluated through a repeatable
    champion-versus-challenger loop
- the next experiment-orchestration milestone:
- the strategy tab now supports a bounded queued baseline experiment mode
- manual runs can launch separate champion-versus-challenger baseline arms
  through a single-worker queue
  - grouped experiment outcomes are now stored and surfaced back into overview
    and results
- the next results-clarity milestone:
  - multi-city results now explicitly say whether a qualifying intentional trip
    exists
  - when no qualifying trip exists, results now show the cheapest verified
    fallback and the closest miss against the stop window
  - stitched placeholder candidates no longer present fake intentional-stop
    badges
- the next worker-orchestration milestone:
  - concurrent live Trip.com workers are now prevented
  - queued live runs are dispatched one at a time
  - baseline experiment suites now use the same single-worker queue
    counts
- the next true-multi-city milestone:
  - a dedicated `Anchored multi-city search` bundle now exists beside the
    cheaper verification cluster
  - the worker now supports a bounded three-leg Trip.com multi-city adapter
  - overview, results, and run progress now surface the cheapest qualifying
    true multi-city trip and fallback verified outcomes

## Status Snapshot

- `Complete`
  - first implemented slice recorded in `03-session-strategy-bundles-and-tab.md`
  - session strategy tab
  - bundle catalog
  - planner compilation from session bundle selection
  - pass-level strategy controls recorded in `04-pass-level-strategy-controls.md`
  - plain-language pass explanations and tooltips in the strategy tab
- `In progress`
  - broader strategy-cluster expansion recorded in `05-round-trip-baseline-and-multi-city-cluster.md`
  - richer multi-city evidence ranking and verification handoff
  - long-stop readiness analysis after multi-city verification
- `Complete`
- queued baseline experiment mode recorded in `21-parallel-baseline-experiment-mode.md`
  - strategy-tab experiment controls
  - stored experiment groups, arm tagging, and latest-suite comparison visibility
- `Complete`
  - multi-city outcome visibility recorded in `22-multi-city-outcome-visibility.md`
  - explicit results-side qualifying vs near-miss outcome state
  - stitched placeholder intentional-stop cleanup
- `Complete`
  - anchored true multi-city search recorded in `23-anchored-true-multi-city-search.md`
  - dedicated true Trip.com multi-city bundle beside the verification cluster
  - bounded three-leg adapter plus results visibility for true multi-city outcomes
- `Complete`
  - first true longer-stop follow-up recorded in `06-long-stop-followup-pass.md`
  - executable long-stop query pass after multi-city validation
  - duration-aware candidate filtering and evidence visibility
- `Complete`
  - alternate return-city exploration recorded in `08-alternate-return-city-exploration.md`
  - bounded alternate-city comparison cluster for flexible return-origin sessions
- `Complete`
  - program transparency and suggestion wording cleanup recorded in `09-program-transparency-and-suggestion-wording.md`
  - compiled program preview and more honest deterministic suggestion copy
- `Complete`
  - baseline round-trip insights board recorded in `10-baseline-round-trip-insights-board.md`
  - shared outcome view for cheapest dates, cheapest airlines, and combined date-airline signals
- `Complete`
  - strategy workspace separation recorded in `11-strategy-workspace-separation.md`
  - search strategy focused back on explanation and control
  - overview and results aligned with summary vs detail responsibilities
- `Complete`
  - results timeline accordions and grouping recorded in `12-results-timeline-accordions-and-grouping.md`
  - timeline rows now expand to show exact flights
  - similar-route grouping tightened to timing-only variants of the same provider chain
- `Complete`
  - direct-sweep distinct card selection recorded in `13-direct-sweep-distinct-card-selection.md`
  - broader card scanning before outbound and return branch selection
  - cheapest distinct options kept by price, airline, stopover location, date window, and similar schedule
- `Complete`
  - baseline return-option expansion and family coverage recorded in `14-baseline-return-option-expansion-and-family-coverage.md`
  - bounded deep-return expansion added between direct sweep and pass-1 analysis
  - expansion budget now covers distinct candidate families before repeating the same family
- `Complete`
  - baseline handoff and results visibility recorded in `15-baseline-handoff-and-results-visibility.md`
  - explicit baseline handoff candidate families recorded after pass-1 analysis
  - overview, results, and live run progress now surface baseline expansion coverage and handoff candidates
- `Complete`
  - seed-based multi-city verification recorded in `16-multi-city-seed-based-verification.md`
  - baseline handoff now includes city-entry and city-date-airline planning boards
  - multi-city verification now probes bounded family-city seed contexts and records cheapest verified multi-city outcomes
- `Complete`
  - intentional stopover foundation and outcomes recorded in `17-intentional-stopover-foundation-and-outcomes.md`
  - baseline candidates now persist visible-card stopover data for later strategy reuse
  - multi-city outcomes now distinguish intentional-stop matches from generic verified stopover fares
- `Complete`
  - historical direct-sweep hypothesis review recorded in `18-historical-direct-sweep-hypotheses.md`
  - existing completed-run data now justifies which efficiency uplift to test next
- `Complete`
  - adaptive coverage baseline and efficiency insights recorded in `19-adaptive-coverage-baseline-and-efficiency-insights.md`
  - second selectable baseline strategy added for bounded efficiency testing
  - latest-run results and run progress now expose direct-sweep efficiency metrics
- `Complete`
  - baseline experiment loop recorded in `20-baseline-experiment-loop-and-continuous-refinement.md`
  - overview and results now compare recent runs across baseline strategies
  - the session now has a lightweight continuous-refinement loop for future baseline changes
- `Complete`
  - session run stop controls recorded in `27-session-run-stop-controls.md`
  - shared workspace actions now stop the current run or clear the rest of the session queue
  - results no longer show a running spinner for blocked or paused runs
- `In progress`
  - broader search-program redesign
  - bundle-based planner architecture beyond the first slice
- `In progress`
  - shared evidence scoring layer recorded in `07-shared-evidence-layer.md`
  - extracted multi-city evidence helpers, with wider planner reuse still pending
- `In progress`
  - broader execution-adapter decoupling
  - current alternate-city strategy is still a bounded round-trip comparison, not a true open-jaw adapter
- `Not started`
  - broader bundle catalog expansion
