-- Phase 10: harden kanso_current_tenant_id search_path (Supabase security advisor).
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
