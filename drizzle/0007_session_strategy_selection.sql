CREATE TABLE IF NOT EXISTS session_strategy_selection (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_strategy_selection_unique_idx
  ON session_strategy_selection (session_id, strategy_key);

CREATE INDEX IF NOT EXISTS session_strategy_selection_session_priority_idx
  ON session_strategy_selection (session_id, priority ASC, created_at ASC);
