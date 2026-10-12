import { getPool } from "@kanso/tenancy";

/**
 * D-103: without dpa_signed, only demo stubs / demo-* tenants may upload docs.
 */
export async function assertDocumentUploadAllowed(opts: {
  tenantId: string;
  content: Buffer;
  filename?: string;
}): Promise<{ allowed: true } | { allowed: false; error: string }> {
  if (opts.tenantId.startsWith("demo-")) {
    return { allowed: true };
  }

  const pool = getPool();
  let dpaSigned = false;
  try {
    const res = await pool.query<{ dpa_signed: boolean }>(
      `select coalesce(dpa_signed, false) as dpa_signed from tenants where tenant_id = $1`,
      [opts.tenantId],
    );
    dpaSigned = res.rows[0]?.dpa_signed === true;
  } catch {
    // Column missing on old DB — fail closed for non-demo
    return {
      allowed: false,
      error: "dpa_column_missing_run_migrations",
    };
  }

  if (dpaSigned) return { allowed: true };

  const name = opts.filename ?? "";
  const text = opts.content.toString("utf8");
  const stub =
    opts.content.length < 2048 ||
    /demo-facture|demo kanso|demo-kanso/i.test(text) ||
    /^demo[-_]/i.test(name);

  if (stub) return { allowed: true };

  return {
    allowed: false,
    error: "dpa_required",
  };
}
