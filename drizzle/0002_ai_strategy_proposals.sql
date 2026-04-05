CREATE TABLE IF NOT EXISTS ai_strategy_proposal (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  strategy_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  strategy_payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'dismissed')),
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid')),
  validation_notes TEXT,
  generated_from_session_updated_at TEXT NOT NULL,
  last_applied_run_id TEXT REFERENCES search_run(id) ON DELETE SET NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_strategy_proposal_session_status_updated_idx
  ON ai_strategy_proposal (session_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategy_proposal_session_generated_idx
  ON ai_strategy_proposal (session_id, generated_from_session_updated_at);
