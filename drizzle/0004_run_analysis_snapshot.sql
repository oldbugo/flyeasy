create table if not exists run_analysis_snapshot (
  id text primary key not null,
  search_run_id text not null references search_run(id) on delete cascade,
  strategy_execution_id text not null references strategy_execution(id) on delete cascade,
  analysis_type text not null,
  summary_json text not null,
  created_at text not null
);

create index if not exists run_analysis_snapshot_run_idx
  on run_analysis_snapshot(search_run_id, created_at);

create index if not exists run_analysis_snapshot_strategy_idx
  on run_analysis_snapshot(strategy_execution_id, created_at);
