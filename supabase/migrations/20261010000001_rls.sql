-- Kanso P0-01: RLS tenant isolation
-- App server uses service_role (bypass RLS). Policies protect anon/authenticated.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create or replace function public.kanso_current_tenant_id()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::json ->> 'tenant_id',
      current_setting('app.tenant_id', true)
    ),
    ''
  );
$$;

alter table tenants enable row level security;
alter table tenant_configs enable row level security;
alter table tenant_secrets enable row level security;
alter table inbound_sessions enable row level security;
alter table inbound_messages enable row level security;
alter table document_jobs enable row level security;
alter table audit_events enable row level security;
alter table usage_ledger enable row level security;
alter table adapter_dead_letters enable row level security;

-- Deny-by-default for anon/authenticated except scoped tenant policies below.
-- service_role bypasses RLS in Supabase.

create policy tenants_select_own on tenants
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

create policy tenant_configs_all_own on tenant_configs
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

-- Secrets: no direct access for authenticated (admin via service_role only)
create policy tenant_secrets_deny_authenticated on tenant_secrets
  for all to authenticated
  using (false)
  with check (false);

create policy inbound_sessions_all_own on inbound_sessions
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

create policy inbound_messages_all_own on inbound_messages
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

create policy document_jobs_all_own on document_jobs
  for all to authenticated
  using (tenant_id = public.kanso_current_tenant_id())
  with check (tenant_id = public.kanso_current_tenant_id());

create policy audit_events_select_own on audit_events
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

create policy usage_ledger_select_own on usage_ledger
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

create policy adapter_dead_letters_select_own on adapter_dead_letters
  for select to authenticated
  using (tenant_id = public.kanso_current_tenant_id());

-- anon: no table access (widget talks to API, not PostgREST directly)
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on tenants to authenticated;
grant select, insert, update, delete on tenant_configs to authenticated;
grant select, insert, update, delete on inbound_sessions to authenticated;
grant select, insert, update, delete on inbound_messages to authenticated;
grant select, insert, update, delete on document_jobs to authenticated;
grant select on audit_events to authenticated;
grant select on usage_ledger to authenticated;
grant select on adapter_dead_letters to authenticated;
-- tenant_secrets: no grants to authenticated/anon
