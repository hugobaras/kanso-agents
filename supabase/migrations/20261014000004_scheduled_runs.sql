-- Dernière exécution des tâches planifiées du worker (une ligne par tâche).
create table if not exists scheduled_runs (
  job text primary key,
  last_run_at timestamptz not null,
  last_result jsonb not null default '{}'::jsonb
);
alter table scheduled_runs enable row level security;
