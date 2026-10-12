-- Phase 14: client portal (magic link + connectors + custom requests)

create table if not exists portal_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'ops')),
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists idx_portal_users_email
  on portal_users (lower(email));

create table if not exists portal_magic_tokens (
  id uuid primary key default gen_random_uuid(),
  portal_user_id uuid not null references portal_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists portal_sessions (
  id uuid primary key default gen_random_uuid(),
  portal_user_id uuid not null references portal_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_portal_sessions_hash
  on portal_sessions (token_hash)
  where revoked_at is null;

create table if not exists custom_integration_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  portal_user_id uuid references portal_users (id) on delete set null,
  platform text not null,
  title text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_requests_tenant
  on custom_integration_requests (tenant_id, created_at desc);

comment on table portal_users is 'Client portal accounts (magic link); not widget anon';
comment on table custom_integration_requests is 'P14 sur-mesure connector requests for ops';
