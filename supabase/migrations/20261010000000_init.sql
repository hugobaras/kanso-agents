-- Kanso P0-01: schema multi-tenant + secrets méta
-- Appliquer via Docker local (compose) ou projet Supabase dédié "kanso" (pas shapemax).

create extension if not exists pgcrypto;

create table if not exists tenants (
  tenant_id text primary key,
  display_name text not null,
  status text not null check (status in ('draft', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists tenant_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  product text not null check (product in ('inbound', 'document_to_action')),
  version int not null,
  schema_version text not null,
  config jsonb not null,
  status text not null check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by text,
  unique (tenant_id, product, version)
);

-- ciphertext = payload chiffré côté app (KANSO_MASTER_KEY) ; jamais de secret en clair
create table if not exists tenant_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  secret_ref text not null,
  ciphertext bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, secret_ref)
);

create table if not exists inbound_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  config_version int not null,
  state text not null,
  score_current int not null default 0,
  score_final int,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text
);

create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references inbound_sessions (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists document_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  config_version int not null,
  source_type text not null,
  source_item_id text,
  storage_ref text,
  content_sha256 text,
  document_type text,
  step text not null,
  status text not null,
  fields jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  validation_results jsonb,
  duplicate_of_job_id uuid,
  remote_id text,
  attempt_count int not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  job_id uuid,
  session_id uuid,
  at timestamptz not null default now(),
  step text not null,
  decision text not null,
  summary jsonb not null default '{}'::jsonb,
  actor text not null,
  correlation_id text not null
);

create table if not exists usage_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  at timestamptz not null default now(),
  product text not null,
  provider text not null,
  model_id text not null,
  input_tokens int not null,
  output_tokens int not null,
  estimated_eur numeric(12, 6) not null default 0,
  correlation_id text not null
);

create table if not exists adapter_dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  category text not null,
  provider text not null,
  payload_ref text,
  last_error text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_tenant_configs_published
  on tenant_configs (tenant_id, product, status);
create index if not exists idx_inbound_sessions_tenant on inbound_sessions (tenant_id);
create index if not exists idx_inbound_sessions_activity on inbound_sessions (last_activity_at)
  where closed_at is null;
create index if not exists idx_document_jobs_poll on document_jobs (status, available_at);
create index if not exists idx_usage_ledger_tenant_at on usage_ledger (tenant_id, at);
create index if not exists idx_audit_events_tenant_at on audit_events (tenant_id, at);
