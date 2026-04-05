PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('draft', 'live_running', 'live_idle', 'needs_attention', 'not_live', 'completed', 'archived')),
  monitoring_state TEXT NOT NULL CHECK (monitoring_state IN ('enabled', 'disabled', 'blocked')),
  is_live INTEGER NOT NULL DEFAULT 0,
  origin_airport TEXT NOT NULL,
  outbound_destination_city TEXT NOT NULL,
  return_destination_airport TEXT NOT NULL,
  return_origin_mode TEXT NOT NULL CHECK (return_origin_mode IN ('fixed_city', 'any_mainland_city')),
  return_origin_city TEXT,
  departure_start_date TEXT NOT NULL,
  departure_end_date TEXT NOT NULL,
  duration_min_days INTEGER,
  duration_max_days INTEGER,
  return_start_date TEXT,
  return_end_date TEXT,
  layover_scope TEXT NOT NULL CHECK (layover_scope IN ('mainland_china')),
  max_stops INTEGER NOT NULL CHECK (max_stops BETWEEN 0 AND 2),
  stop_duration_min_days INTEGER NOT NULL CHECK (stop_duration_min_days >= 0),
  stop_duration_max_days INTEGER NOT NULL CHECK (stop_duration_max_days >= stop_duration_min_days),
  booking_mode TEXT NOT NULL CHECK (booking_mode IN ('single_booking', 'stitched', 'both')),
  search_intensity TEXT NOT NULL CHECK (search_intensity IN ('low', 'balanced', 'high')),
  cabin_policy TEXT NOT NULL CHECK (cabin_policy IN ('any')),
  notes TEXT,
  last_run_started_at TEXT,
  last_run_finished_at TEXT,
  last_successful_run_id TEXT,
  current_best_candidate_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_city_preference (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  city_code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('preferred_stopover_city', 'excluded_stopover_city', 'preferred_return_origin_city')),
  priority INTEGER NOT NULL CHECK (priority >= 0),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_city_preference_unique_idx
  ON session_city_preference (session_id, city_code, role);

CREATE TABLE IF NOT EXISTS search_run (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  run_mode TEXT NOT NULL CHECK (run_mode IN ('interactive', 'monitoring')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'blocked', 'paused', 'completed', 'failed', 'cancelled')),
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('manual', 'scheduled', 'rerank_only', 'debug')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  search_snapshot_json TEXT NOT NULL,
  total_strategies_planned INTEGER NOT NULL DEFAULT 0,
  total_strategies_executed INTEGER NOT NULL DEFAULT 0,
  total_candidates_found INTEGER NOT NULL DEFAULT 0,
  total_candidates_verified INTEGER NOT NULL DEFAULT 0,
  best_candidate_id TEXT,
  summary_text TEXT,
  failure_reason TEXT,
  recovery_state TEXT NOT NULL DEFAULT 'not_required' CHECK (recovery_state IN ('not_required', 'pending', 'completed', 'abandoned')),
  recovery_type TEXT CHECK (recovery_type IS NULL OR recovery_type IN ('login_required', 'challenge_required', 'verification_blocked', 'app_interrupted')),
  recovery_reason TEXT,
  blocked_at TEXT,
  resume_available INTEGER NOT NULL DEFAULT 0,
  resume_mode TEXT CHECK (resume_mode IS NULL OR resume_mode IN ('same_run', 'partial_restart', 'new_run')),
  resume_checkpoint_json TEXT,
  recovery_completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_execution (
  id TEXT PRIMARY KEY NOT NULL,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  parent_strategy_execution_id TEXT,
  strategy_type TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('system', 'ai')),
  priority INTEGER NOT NULL,
  reason TEXT NOT NULL,
  strategy_payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'blocked', 'completed', 'failed', 'skipped', 'cancelled')),
  estimated_search_cost INTEGER NOT NULL DEFAULT 0,
  actual_search_cost INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  verified_candidate_count INTEGER NOT NULL DEFAULT 0,
  best_candidate_id TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS candidate_family (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('single_booking', 'stitched')),
  trip_shape TEXT NOT NULL CHECK (trip_shape IN ('round_trip', 'open_jaw')),
  route_summary_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS candidate_family_session_family_key_idx
  ON candidate_family (session_id, family_key);

CREATE TABLE IF NOT EXISTS itinerary_candidate (
  id TEXT PRIMARY KEY NOT NULL,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  strategy_execution_id TEXT NOT NULL REFERENCES strategy_execution(id) ON DELETE CASCADE,
  candidate_family_id TEXT NOT NULL REFERENCES candidate_family(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('single_booking', 'stitched')),
  trip_shape TEXT NOT NULL CHECK (trip_shape IN ('round_trip', 'open_jaw')),
  outbound_destination_city TEXT NOT NULL,
  return_origin_city TEXT,
  stop_count INTEGER NOT NULL CHECK (stop_count >= 0),
  intentional_stop_count INTEGER NOT NULL DEFAULT 0 CHECK (intentional_stop_count >= 0),
  displayed_source_currency TEXT NOT NULL,
  displayed_source_amount REAL NOT NULL,
  displayed_display_currency TEXT NOT NULL,
  displayed_display_amount REAL NOT NULL,
  latest_verified_source_currency TEXT,
  latest_verified_source_amount REAL,
  latest_verified_display_currency TEXT,
  latest_verified_display_amount REAL,
  latest_verification_status TEXT NOT NULL DEFAULT 'not_checked' CHECK (latest_verification_status IN ('not_checked', 'verified', 'repriced', 'unavailable', 'partial', 'failed')),
  fare_class_summary TEXT,
  total_travel_minutes INTEGER,
  stitched_risk_level TEXT CHECK (stitched_risk_level IS NULL OR stitched_risk_level IN ('low', 'medium', 'high')),
  risk_notes TEXT,
  tripcom_resume_url TEXT,
  tripcom_resume_token TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_ranked_at TEXT,
  is_current_best INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS itinerary_candidate_run_dedupe_idx
  ON itinerary_candidate (search_run_id, dedupe_key);

CREATE TABLE IF NOT EXISTS candidate_leg (
  id TEXT PRIMARY KEY NOT NULL,
  itinerary_candidate_id TEXT NOT NULL REFERENCES itinerary_candidate(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,
  segment_group TEXT NOT NULL,
  booking_reference_group TEXT NOT NULL,
  carrier_code TEXT,
  flight_number TEXT,
  origin_airport TEXT NOT NULL,
  destination_airport TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  arrival_at TEXT NOT NULL,
  cabin_class TEXT,
  fare_brand TEXT,
  baggage_summary TEXT,
  raw_leg_payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS candidate_leg_candidate_leg_index_idx
  ON candidate_leg (itinerary_candidate_id, leg_index);

CREATE TABLE IF NOT EXISTS candidate_stopover (
  id TEXT PRIMARY KEY NOT NULL,
  itinerary_candidate_id TEXT NOT NULL REFERENCES itinerary_candidate(id) ON DELETE CASCADE,
  stop_index INTEGER NOT NULL,
  city_code TEXT NOT NULL,
  airport_code TEXT NOT NULL,
  country_code TEXT,
  arrival_at TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_intentional INTEGER NOT NULL DEFAULT 0,
  is_mainland_china INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS candidate_stopover_candidate_stop_index_idx
  ON candidate_stopover (itinerary_candidate_id, stop_index);

CREATE TABLE IF NOT EXISTS verification_attempt (
  id TEXT PRIMARY KEY NOT NULL,
  itinerary_candidate_id TEXT NOT NULL REFERENCES itinerary_candidate(id) ON DELETE CASCADE,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  attempt_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'blocked', 'verified', 'repriced', 'unavailable', 'partial', 'failed', 'cancelled')),
  failure_code TEXT,
  failure_detail TEXT,
  checkout_stage_reached TEXT CHECK (checkout_stage_reached IS NULL OR checkout_stage_reached IN ('results', 'details', 'traveler_form', 'final_review')),
  source_currency TEXT,
  source_amount REAL,
  display_currency TEXT,
  display_amount REAL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS verification_attempt_candidate_attempt_idx
  ON verification_attempt (itinerary_candidate_id, attempt_index);

CREATE TABLE IF NOT EXISTS price_observation (
  id TEXT PRIMARY KEY NOT NULL,
  itinerary_candidate_id TEXT NOT NULL REFERENCES itinerary_candidate(id) ON DELETE CASCADE,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  verification_attempt_id TEXT,
  price_kind TEXT NOT NULL CHECK (price_kind IN ('displayed_search_price', 'verified_checkout_price')),
  source_currency TEXT NOT NULL,
  source_amount REAL NOT NULL,
  display_currency TEXT NOT NULL,
  display_amount REAL NOT NULL,
  fx_provider TEXT,
  fx_rate REAL,
  fx_rate_timestamp TEXT,
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_shortlist_entry (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  candidate_family_id TEXT NOT NULL REFERENCES candidate_family(id) ON DELETE CASCADE,
  itinerary_candidate_id TEXT NOT NULL REFERENCES itinerary_candidate(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('shortlisted', 'top_pick', 'dismissed')),
  user_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_shortlist_entry_session_family_idx
  ON session_shortlist_entry (session_id, candidate_family_id);

CREATE TABLE IF NOT EXISTS run_artifact (
  id TEXT PRIMARY KEY NOT NULL,
  search_run_id TEXT NOT NULL REFERENCES search_run(id) ON DELETE CASCADE,
  strategy_execution_id TEXT REFERENCES strategy_execution(id) ON DELETE SET NULL,
  verification_attempt_id TEXT REFERENCES verification_attempt(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('screenshot', 'html_snapshot', 'playwright_trace', 'json_export')),
  file_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS session_lifecycle_updated_idx
  ON session (lifecycle_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS session_monitoring_updated_idx
  ON session (monitoring_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS search_run_session_started_idx
  ON search_run (session_id, started_at DESC);

CREATE INDEX IF NOT EXISTS search_run_session_status_started_idx
  ON search_run (session_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS strategy_execution_run_status_priority_idx
  ON strategy_execution (search_run_id, status, priority);

CREATE INDEX IF NOT EXISTS itinerary_candidate_run_verification_price_idx
  ON itinerary_candidate (search_run_id, latest_verification_status, latest_verified_display_amount);

CREATE INDEX IF NOT EXISTS itinerary_candidate_dedupe_key_idx
  ON itinerary_candidate (dedupe_key);

CREATE INDEX IF NOT EXISTS candidate_stopover_city_intentional_idx
  ON candidate_stopover (city_code, is_intentional);

CREATE INDEX IF NOT EXISTS verification_attempt_candidate_started_idx
  ON verification_attempt (itinerary_candidate_id, started_at DESC);

CREATE INDEX IF NOT EXISTS price_observation_candidate_observed_idx
  ON price_observation (itinerary_candidate_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS session_shortlist_entry_session_status_updated_idx
  ON session_shortlist_entry (session_id, status, updated_at DESC);
