# Queued Baseline Experiment Mode

## Status

- `Complete`

## Goal

Add a bounded strategy-selection experiment mode so manual scans can launch a
small queued baseline comparison suite instead of always running exactly one
baseline arm.

The intent is not to mix unrelated strategy families together yet. The safer
first step is to compare compatible baseline strategies under the same session
constraints, store the grouped outcome, and use that evidence to refine the
search algorithm over time.

## What Changed

### Session settings

The session model now stores:

- `strategy_experiment_mode`
- `strategy_experiment_sample_size`

For this uplift, the supported mode is:

- `baseline_parallel_random`

This means manual `Start baseline run` and `Rerun now` actions can create a
queued experiment suite instead of one baseline run.

### Experiment grouping

New experiment groups are persisted in `strategy_experiment_group`.

Each created run arm records:

- the experiment group id
- the arm key
- the arm label

That keeps the experiment arms auditable as separate runs while still preserving
their shared experiment context.

### Selection rule

The current baseline selection on the strategy page becomes the champion arm.

Compatible challenger baselines are then selected from the available baseline
pool, using deterministic randomness from a generated seed. This keeps the
experiment bounded and reproducible while still avoiding a rigid always-the-same
ordering once more baseline arms exist.

### UI surface

The `Search strategy` tab now includes a dedicated `Strategy experiments`
section with:

- an enable toggle
- an arm-count control
- plain-language explanation of champion-versus-challenger behavior

### Outcome visibility

Overview and Results now show:

- the historical `Baseline strategy lab`
- the latest stored queued experiment suite
- arm-by-arm baseline metrics
- a current suite leader readout

### Stored conclusion

Experiment groups are refreshed when arm runs finish. The group stores:

- resolved experiment status
- a latest leader label
- a compact comparison summary json

That gives FlyEasy a persistent audit trail for later review instead of relying
on transient UI state alone.

## Boundaries

This feature is intentionally limited to baseline experiments for now.

It does **not** yet:

- randomize optional follow-on strategy clusters in the same experiment
- treat multi-city, alternate-city, and stitched strategies as interchangeable
  experiment arms
- decide automatically which strategy family should run next

Those remain later planner-evolution steps.

## Verification

Verified with:

- `npm run typecheck`
- `npm run lint`

The strategy, overview, and results surfaces were also checked after wiring the
new experiment mode through the session data model.
