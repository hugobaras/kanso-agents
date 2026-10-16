-- Kanso Portail — analyse IA des pièces (opt-in, avenant DPA versionné).
alter table portal_settings
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists ai_terms_version text,
  add column if not exists ai_accepted_by uuid references users (id) on delete set null,
  add column if not exists ai_accepted_at timestamptz;

-- Exclusions décidées par le cabinet (ex. pièces médicales).
alter table portal_dossiers add column if not exists ai_excluded boolean not null default false;
alter table portal_items add column if not exists ai_excluded boolean not null default false;

-- Texte extrait d'une pièce, chiffré comme les fichiers (AES-256-GCM, clé par cabinet).
create table if not exists portal_file_texts (
  file_id uuid primary key references portal_files (id) on delete cascade,
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  dossier_id uuid not null references portal_dossiers (id) on delete cascade,
  status text not null check (status in ('done', 'failed', 'quota')),
  method text,
  pages int not null default 0,
  blob bytea,
  wrapped_key bytea,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_file_texts_dossier on portal_file_texts (dossier_id);
alter table portal_file_texts enable row level security;

-- Quota de pages analysées par l'IA.
alter table usage_counters drop constraint if exists usage_counters_metric_check;
alter table usage_counters add constraint usage_counters_metric_check check (metric in ('conversations', 'documents', 'ai_pages'));
