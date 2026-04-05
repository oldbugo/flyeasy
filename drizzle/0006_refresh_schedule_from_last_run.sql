UPDATE session
SET next_refresh_at = datetime(last_run_finished_at, '+' || refresh_interval_hours || ' hours')
WHERE monitoring_state = 'enabled'
  AND is_live = 1
  AND last_run_finished_at IS NOT NULL;
