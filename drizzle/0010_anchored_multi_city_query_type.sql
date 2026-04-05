PRAGMA foreign_keys=OFF;

ALTER TABLE query_candidate_link RENAME TO query_candidate_link_old;
ALTER TABLE query_execution RENAME TO query_execution_old;

CREATE TABLE query_execution (
  id TEXT PRIMARY KEY NOT NULL,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  strategy_execution_id TEXT NOT NULL REFERENCES strategy_execution(id) ON DELETE CASCADE,
  parent_query_execution_id TEXT,
  query_type TEXT NOT NULL CHECK (
    query_type IN (
      'direct_round_trip',
      'anchored_multi_city',
      'return_option_expansion',
      'stopover_filtered_round_trip'
    )
  ),
  source TEXT NOT NULL CHECK (source IN ('planned', 'derived_from_result')),
  priority INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'blocked', 'completed', 'failed', 'skipped', 'cancelled')
  ),
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

INSERT INTO query_execution (
  id,
  search_run_id,
  strategy_execution_id,
  parent_query_execution_id,
  query_type,
  source,
  priority,
  status,
  reason,
  query_input_json,
  result_summary_json,
  observed_stopover_cities_json,
  tripcom_result_url,
  started_at,
  finished_at,
  failure_reason,
  created_at
)
SELECT
  id,
  search_run_id,
  strategy_execution_id,
  parent_query_execution_id,
  query_type,
  source,
  priority,
  status,
  reason,
  query_input_json,
  result_summary_json,
  observed_stopover_cities_json,
  tripcom_result_url,
  started_at,
  finished_at,
  failure_reason,
  created_at
FROM query_execution_old;

CREATE TABLE query_candidate_link (
  id TEXT PRIMARY KEY NOT NULL,
  query_execution_id TEXT NOT NULL REFERENCES query_execution(id) ON DELETE CASCADE,
  itinerary_candidate_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('result')),
  created_at TEXT NOT NULL
);

INSERT INTO query_candidate_link (
  id,
  query_execution_id,
  itinerary_candidate_id,
  link_type,
  created_at
)
SELECT
  id,
  query_execution_id,
  itinerary_candidate_id,
  link_type,
  created_at
FROM query_candidate_link_old;

DROP TABLE query_candidate_link_old;
DROP TABLE query_execution_old;

CREATE INDEX IF NOT EXISTS query_execution_run_strategy_priority_idx
  ON query_execution (search_run_id, strategy_execution_id, priority);

CREATE INDEX IF NOT EXISTS query_execution_run_status_started_idx
  ON query_execution (search_run_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS query_candidate_link_query_idx
  ON query_candidate_link (query_execution_id);

PRAGMA foreign_keys=ON;
