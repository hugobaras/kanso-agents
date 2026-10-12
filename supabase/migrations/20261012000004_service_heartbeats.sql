-- Phase 16: worker heartbeat readable from API /health
create table if not exists service_heartbeats (
  service text primary key,
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

comment on table service_heartbeats is 'Last seen heartbeat per service (document-worker, …)';
