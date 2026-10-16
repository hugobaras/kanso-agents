-- Demandes publiques des sites vitrines (contact, devis Kanso Site, liste d'attente Kanso Portail).
create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('solutions', 'assistant', 'site', 'portail')),
  kind text not null default 'contact' check (kind in ('contact', 'devis', 'waitlist')),
  name text not null default '',
  email citext not null,
  phone text,
  profession text,
  organisation text,
  message text,
  extra jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'done', 'spam')),
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_requests_created on contact_requests (created_at desc);
create index if not exists idx_contact_requests_source on contact_requests (source, status);
alter table contact_requests enable row level security;
