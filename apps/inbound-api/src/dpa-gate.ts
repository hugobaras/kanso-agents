import { getPool } from "@kanso/tenancy";

/**
 * D-103: real documents require an accepted DPA (in-app acceptance or the
 * legacy `dpa_signed` flag). demo-* tenants stay open for the public demo.
 */
export async function assertDocumentUploadAllowed(opts: {
  tenantId: string;
  content: Buffer;
  filename?: string;
}): Promise<{ allowed: true } | { allowed: false; error: string }> {
  if (opts.tenantId.startsWith("demo-")) return { allowed: true };
  const res = await getPool().query<{ ok: boolean }>(
    `select (t.dpa_signed or exists (select 1 from dpa_acceptances d where d.tenant_id = t.tenant_id)) as ok
     from tenants t where t.tenant_id = $1`,
    [opts.tenantId],
  );
  return res.rows[0]?.ok ? { allowed: true } : { allowed: false, error: "dpa_required" };
}
