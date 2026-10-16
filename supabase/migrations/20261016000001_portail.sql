-- Kanso Portail v1 : dossiers, pièces demandées, dépôts chiffrés, accès client sans compte.

-- Réglages par cabinet -------------------------------------------------------
create table if not exists portal_settings (
  tenant_id text primary key references tenants (tenant_id) on delete cascade,
  max_active_dossiers int not null default 20,
  retention_days int not null default 90 check (retention_days between 7 and 3650),
  reminders jsonb not null default '{"enabled": true, "first_after_days": 3, "every_days": 4, "max": 4}'::jsonb,
  stage_labels jsonb not null default '{}'::jsonb,
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  display_name text,
  welcome_message text,
  logo bytea,
  logo_mime text,
  last_digest_at timestamptz not null default now(),
  next_dossier_seq int not null default 1,
  updated_at timestamptz not null default now()
);

-- Modèles propres au cabinet (les modèles système vivent dans le code).
create table if not exists portal_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  profession text,
  name text not null,
  description text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_portal_templates_tenant on portal_templates (tenant_id);

-- Dossiers ------------------------------------------------------------------
create table if not exists portal_dossiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  reference text not null,
  title text not null,
  client_name text not null default '',
  client_kind text not null default 'particulier' check (client_kind in ('particulier', 'entreprise')),
  stage text not null default 'a_completer' check (stage in ('a_completer', 'en_verification', 'complet', 'termine')),
  cabinet_message text,
  assignee_user_id uuid references users (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'assistant')),
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_notified_at timestamptz,
  closed_at timestamptz,
  purge_at timestamptz,
  purge_notified_at timestamptz,
  last_reminder_at timestamptz,
  reminder_count int not null default 0,
  unique (tenant_id, reference)
);
create index if not exists idx_portal_dossiers_tenant on portal_dossiers (tenant_id, created_at desc);
create index if not exists idx_portal_dossiers_purge on portal_dossiers (purge_at) where purge_at is not null;

-- Interlocuteurs côté client (un lien par contact et par dossier) --------------
create table if not exists portal_contacts (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references portal_dossiers (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  email citext not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  last_access_at timestamptz,
  unique (dossier_id, email)
);

create table if not exists portal_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references portal_contacts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_links_contact on portal_links (contact_id);

create table if not exists portal_login_codes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references portal_contacts (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_codes_contact on portal_login_codes (contact_id, created_at desc);

create table if not exists portal_client_sessions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references portal_contacts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Pièces demandées et dépôts -------------------------------------------------
create table if not exists portal_items (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references portal_dossiers (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  position int not null default 0,
  label text not null,
  hint text,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'received', 'accepted', 'refused')),
  refusal_reason text,
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_portal_items_dossier on portal_items (dossier_id, position);

create table if not exists portal_files (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references portal_items (id) on delete cascade,
  dossier_id uuid not null references portal_dossiers (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  uploaded_by_contact uuid references portal_contacts (id) on delete set null,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  sha256 text not null,
  storage_key text not null,
  wrapped_key bytea not null,
  key_version int not null default 1,
  scan_status text not null default 'clean' check (scan_status in ('clean', 'infected', 'error')),
  scan_detail text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_portal_files_item on portal_files (item_id) where deleted_at is null;
create index if not exists idx_portal_files_dossier on portal_files (dossier_id);

create table if not exists portal_messages (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references portal_dossiers (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  author_kind text not null check (author_kind in ('cabinet', 'client')),
  author_user_id uuid references users (id) on delete set null,
  author_contact_id uuid references portal_contacts (id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  seen_by_other_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_messages_dossier on portal_messages (dossier_id, created_at);

-- RLS : tout passe par l'API (service) ; aucun accès direct aux données clients.
alter table portal_settings enable row level security;
alter table portal_templates enable row level security;
alter table portal_dossiers enable row level security;
alter table portal_contacts enable row level security;
alter table portal_links enable row level security;
alter table portal_login_codes enable row level security;
alter table portal_client_sessions enable row level security;
alter table portal_items enable row level security;
alter table portal_files enable row level security;
alter table portal_messages enable row level security;

-- Le module est désactivé tant qu'un administrateur Kanso ne l'a pas ouvert (bêta fermée).
update tenants set modules = modules || '{"portail": false}'::jsonb where not (modules ? 'portail');
alter table tenants alter column modules set default '{"inbound": true, "document_to_action": false, "portail": false}'::jsonb;
