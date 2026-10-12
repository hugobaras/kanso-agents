-- Phase 13 D-103: DPA gate for real document uploads
alter table tenants
  add column if not exists dpa_signed boolean not null default false;

alter table tenants
  add column if not exists dpa_signed_at timestamptz;

comment on column tenants.dpa_signed is 'True only after design-partner DPA signed; gates non-demo document uploads';
