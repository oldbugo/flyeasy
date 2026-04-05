ALTER TABLE session
  ADD COLUMN strategy_experiment_mode TEXT NOT NULL DEFAULT 'off'
  CHECK (strategy_experiment_mode IN ('off', 'baseline_parallel_random'));

ALTER TABLE session
  ADD COLUMN strategy_experiment_sample_size INTEGER NOT NULL DEFAULT 2
  CHECK (strategy_experiment_sample_size BETWEEN 2 AND 4);

ALTER TABLE search_run
  ADD COLUMN strategy_experiment_group_id TEXT;

ALTER TABLE search_run
  ADD COLUMN strategy_experiment_arm_key TEXT;

ALTER TABLE search_run
  ADD COLUMN strategy_experiment_arm_label TEXT;

CREATE TABLE IF NOT EXISTS strategy_experiment_group (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  experiment_mode TEXT NOT NULL CHECK (
    experiment_mode IN ('baseline_parallel_random')
  ),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  sample_size INTEGER NOT NULL CHECK (sample_size BETWEEN 2 AND 4),
  champion_strategy_key TEXT,
  selected_strategy_keys_json TEXT NOT NULL,
  random_seed TEXT NOT NULL,
  summary_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS strategy_experiment_group_session_created_idx
  ON strategy_experiment_group (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS search_run_experiment_group_started_idx
  ON search_run (strategy_experiment_group_id, started_at DESC);
