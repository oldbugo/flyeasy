CREATE TABLE IF NOT EXISTS query_execution (
  id TEXT PRIMARY KEY NOT NULL,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  strategy_execution_id TEXT NOT NULL REFERENCES strategy_execution(id) ON DELETE CASCADE,
  parent_query_execution_id TEXT,
  query_type TEXT NOT NULL CHECK (query_type IN ('direct_round_trip', 'stopover_filtered_round_trip')),
  source TEXT NOT NULL CHECK (source IN ('planned', 'derived_from_result')),
  priority INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'blocked', 'completed', 'failed', 'skipped', 'cancelled')),
  reason TEXT NOT NULL,
  query_input_json TEXT NOT NULL,
  result_summary_json TEXT,
  observed_stopover_cities_json TEXT,
  tripcom_result_url TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS query_candidate_link (
  id TEXT PRIMARY KEY NOT NULL,
  query_execution_id TEXT NOT NULL REFERENCES query_execution(id) ON DELETE CASCADE,
  itinerary_candidate_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('result')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS query_execution_run_strategy_priority_idx
  ON query_execution (search_run_id, strategy_execution_id, priority);

CREATE INDEX IF NOT EXISTS query_execution_run_status_started_idx
  ON query_execution (search_run_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS query_candidate_link_query_idx
  ON query_candidate_link (query_execution_id);
