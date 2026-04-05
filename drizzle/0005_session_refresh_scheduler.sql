ALTER TABLE session ADD COLUMN refresh_interval_hours INTEGER NOT NULL DEFAULT 12;
ALTER TABLE session ADD COLUMN next_refresh_at TEXT;

UPDATE session
SET refresh_interval_hours = COALESCE(refresh_interval_hours, 12);

UPDATE session
SET next_refresh_at = COALESCE(last_run_finished_at, created_at)
WHERE monitoring_state = 'enabled' AND is_live = 1 AND next_refresh_at IS NULL;
