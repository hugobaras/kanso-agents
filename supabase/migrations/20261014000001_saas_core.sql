-- Refonte SaaS (D-130…): comptes, abonnements, clés widget, leads, quotas.

create extension if not exists citext;

-- Workspaces = tenants (tenant_id reste le slug d'URL)
alter table tenants add column if not exists profession text
  check (profession in ('avocat', 'expert_comptable', 'notaire', 'autre'));
alter table tenants add column if not exists modules jsonb not null
  default '{"inbound": true, "document_to_action": false}'::jsonb;
alter table tenants add column if not exists onboarding_step int not null default 0;
alter table tenants add column if not exists onboarding_completed_at timestamptz;
alter table tenants add column if not exists deleted_at timestamptz;
alter table tenants add column if not exists suspended_reason text;

-- Users & access ---------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text,
  name text not null default '',
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  email_verified_at timestamptz,
  is_staff boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_memberships_user on memberships (user_id);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  email citext not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_invitations_tenant on invitations (tenant_id);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  impersonator_user_id uuid references users (id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_auth_sessions_user on auth_sessions (user_id);

create table if not exists auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('magic', 'verify', 'reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Billing -----------------------------------------------------------------
create table if not exists subscriptions (
  tenant_id text primary key references tenants (tenant_id) on delete cascade,
  plan text not null check (plan in ('trial', 'essentiel', 'cabinet', 'expert')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'expired')),
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists usage_counters (
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  metric text not null check (metric in ('conversations', 'documents')),
  period text not null, -- YYYY-MM (Europe/Paris)
  count int not null default 0,
  primary key (tenant_id, metric, period)
);

-- Widget / API keys, rate limiting ---------------------------------------
create table if not exists widget_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  public_key text not null unique,
  mode text not null default 'live' check (mode in ('live', 'test')),
  allowed_origins text[] not null default '{}',
  last_seen_at timestamptz,
  last_seen_origin text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_widget_keys_tenant on widget_keys (tenant_id);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  created_by uuid references users (id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Leads -------------------------------------------------------------------
alter table inbound_sessions add column if not exists origin text;
alter table inbound_sessions add column if not exists counted_at timestamptz;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  session_id uuid not null unique references inbound_sessions (id) on delete cascade,
  contact jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  score int not null default 0,
  tier text not null check (tier in ('hot', 'warm', 'cold')),
  event text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'spam')),
  assignee_user_id uuid references users (id) on delete set null,
  summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_tenant_created on leads (tenant_id, created_at desc);
create index if not exists idx_leads_tenant_status on leads (tenant_id, status);

-- Documents review --------------------------------------------------------
alter table document_jobs add column if not exists review_status text
  check (review_status in ('pending_review', 'approved', 'rejected', 'auto_approved'));
alter table document_jobs add column if not exists reviewed_by uuid references users (id) on delete set null;
alter table document_jobs add column if not exists reviewed_at timestamptz;
alter table document_jobs add column if not exists original_filename text;
alter table document_jobs add column if not exists mime_type text;
alter table document_jobs add column if not exists size_bytes int;
alter table document_jobs add column if not exists extracted_text text;
alter table document_jobs add column if not exists page_count int;
alter table document_jobs add column if not exists uploaded_by uuid references users (id) on delete set null;
create index if not exists idx_document_jobs_tenant_created on document_jobs (tenant_id, created_at desc);

-- Notifications, RGPD -----------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_tenant on notifications (tenant_id, created_at desc);

create table if not exists dpa_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  version text not null,
  ip text,
  accepted_at timestamptz not null default now()
);

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  requested_by uuid references users (id) on delete set null,
  file_ref text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table custom_integration_requests
  add column if not exists user_id uuid references users (id) on delete set null;

-- Data migration: portal_users → users + memberships ----------------------
insert into users (email, name, email_verified_at)
select distinct on (lower(email)) lower(email), '', now()
from portal_users
on conflict (email) do nothing;

insert into memberships (tenant_id, user_id, role)
select pu.tenant_id, u.id, case when pu.role = 'owner' then 'owner' else 'member' end
from portal_users pu
join users u on u.email = lower(pu.email)
on conflict do nothing;

-- Existing tenants get an active "cabinet" subscription so pilotes keep working.
insert into subscriptions (tenant_id, plan, status)
select tenant_id, 'cabinet', 'active' from tenants
on conflict do nothing;

update tenants set modules = '{"inbound": true, "document_to_action": true}'::jsonb
where tenant_id in (select tenant_id from tenant_configs where product = 'document_to_action');

-- RLS ---------------------------------------------------------------------
alter table users enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table auth_sessions enable row level security;
alter table auth_tokens enable row level security;
alter table subscriptions enable row level security;
alter table stripe_events enable row level security;
alter table usage_counters enable row level security;
alter table widget_keys enable row level security;
alter table api_keys enable row level security;
alter table rate_limits enable row level security;
alter table leads enable row level security;
alter table notifications enable row level security;
alter table dpa_acceptances enable row level security;
alter table data_requests enable row level security;

drop policy if exists leads_all_own on leads;
create policy leads_all_own on leads
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

drop policy if exists notifications_all_own on notifications;
create policy notifications_all_own on notifications
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

drop policy if exists subscriptions_select_own on subscriptions;
create policy subscriptions_select_own on subscriptions
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

drop policy if exists usage_counters_select_own on usage_counters;
create policy usage_counters_select_own on usage_counters
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

drop policy if exists widget_keys_select_own on widget_keys;
create policy widget_keys_select_own on widget_keys
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

-- users, auth_*, stripe_events, rate_limits, api_keys: service only (no grants).
