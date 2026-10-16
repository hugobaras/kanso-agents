-- Brouillon éditable par produit (éditeur d'assistant) ; tenant_configs reste l'historique publié.
create table if not exists config_drafts (
  tenant_id text not null references tenants (tenant_id) on delete cascade,
  product text not null check (product in ('inbound', 'document_to_action')),
  config jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, product)
);
alter table config_drafts enable row level security;
