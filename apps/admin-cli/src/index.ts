#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseInboundConfig, parseDocumentToActionConfig } from "@kanso/config";
import {
  getPool,
  PostgresSecretStore,
  publishConfig,
  requireTenantId,
  runRetentionPurge,
} from "@kanso/tenancy";

function usage() {
  console.log(`Usage:
  kanso-admin validate-config <tenant_id> <path-to-config.json>
  kanso-admin create-tenant <tenant_id> <display_name>
  kanso-admin put-secret <tenant_id> <secret_ref> <json-credentials>
  kanso-admin publish-config <tenant_id> <path-to-config.json>
  kanso-admin set-dpa <tenant_id> --signed|--unsigned
  kanso-admin add-member <tenant_id> <email> [--role owner|admin|member]
  kanso-admin make-staff <email> [--revoke]
  kanso-admin set-plan <tenant_id> <trial|essentiel|cabinet|expert> [--status active|trialing] [--trial-days N]
  kanso-admin purge-retention [--dry-run|--execute]
  kanso-admin confirm-final-action <tenant_id> --i-understand-final
`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    usage();
    process.exit(0);
  }

  if (cmd === "validate-config") {
    const [tenantId, filePath] = args;
    if (!tenantId || !filePath) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
      product?: string;
    };
    if (raw.product === "inbound") parseInboundConfig(raw);
    else if (raw.product === "document_to_action")
      parseDocumentToActionConfig(raw);
    else throw new Error("Unknown product");
    console.log(JSON.stringify({ ok: true, tenantId, product: raw.product }));
    return;
  }

  if (cmd === "create-tenant") {
    const [tenantId, displayName] = args;
    if (!tenantId || !displayName) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const pool = getPool();
    await pool.query(
      `insert into tenants (tenant_id, display_name, status)
       values ($1, $2, 'draft')
       on conflict (tenant_id) do update set display_name = excluded.display_name`,
      [tenantId, displayName],
    );
    console.log(JSON.stringify({ ok: true, tenantId, status: "draft" }));
    await pool.end();
    return;
  }

  if (cmd === "put-secret") {
    const [tenantId, secretRef, jsonCreds] = args;
    if (!tenantId || !secretRef || !jsonCreds) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const masterKey = process.env.KANSO_MASTER_KEY;
    if (!masterKey) throw new Error("KANSO_MASTER_KEY required");
    const credentials = JSON.parse(jsonCreds) as Record<string, string>;
    const pool = getPool();
    const store = new PostgresSecretStore(pool, masterKey);
    await store.put(tenantId, secretRef, credentials);
    console.log(JSON.stringify({ ok: true, tenantId, secretRef }));
    await pool.end();
    return;
  }

  if (cmd === "publish-config") {
    const [tenantId, filePath] = args;
    if (!tenantId || !filePath) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
      product?: string;
      schema_version?: string;
    };
    if (raw.product === "inbound") parseInboundConfig(raw);
    else if (raw.product === "document_to_action")
      parseDocumentToActionConfig(raw);
    else throw new Error("Unknown product");

    const pool = getPool();
    const version = await publishConfig(pool, {
      tenantId,
      product: raw.product as "inbound" | "document_to_action",
      config: { ...raw, schema_version: raw.schema_version ?? "1.0.0" },
      publishedBy: "admin-cli",
    });
    console.log(
      JSON.stringify({ ok: true, tenantId, product: raw.product, version }),
    );
    await pool.end();
    return;
  }

  if (cmd === "set-dpa") {
    const [tenantId, flag] = args;
    if (!tenantId || (flag !== "--signed" && flag !== "--unsigned")) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const signed = flag === "--signed";
    const pool = getPool();
    const res = await pool.query(
      `update tenants
       set dpa_signed = $2,
           dpa_signed_at = case when $2 then now() else null end
       where tenant_id = $1
       returning tenant_id, dpa_signed, dpa_signed_at`,
      [tenantId, signed],
    );
    if (!res.rows[0]) {
      console.error(JSON.stringify({ ok: false, error: "tenant_not_found" }));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, ...res.rows[0] }));
    await pool.end();
    return;
  }

  if (cmd === "add-member") {
    const [tenantId, email, ...rest] = args;
    if (!tenantId || !email?.includes("@")) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const roleIdx = rest.indexOf("--role");
    const role = roleIdx >= 0 ? rest[roleIdx + 1] : "owner";
    if (role !== "owner" && role !== "admin" && role !== "member") {
      console.error(JSON.stringify({ ok: false, error: "invalid_role" }));
      process.exit(1);
    }
    const pool = getPool();
    // Users created here sign in with a magic link (no password yet).
    const user = await pool.query<{ id: string }>(
      `insert into users (email, name, email_verified_at) values (lower($1), '', now())
       on conflict (email) do update set email = excluded.email returning id`,
      [email.trim()],
    );
    await pool.query(
      `insert into memberships (tenant_id, user_id, role) values ($1, $2, $3)
       on conflict (tenant_id, user_id) do update set role = excluded.role`,
      [tenantId, user.rows[0]!.id, role],
    );
    console.log(JSON.stringify({ ok: true, tenantId, email: email.toLowerCase(), role }));
    await pool.end();
    return;
  }

  if (cmd === "make-staff") {
    const [email, flag] = args;
    if (!email?.includes("@")) {
      usage();
      process.exit(1);
    }
    const pool = getPool();
    const res = await pool.query(
      `update users set is_staff = $2 where email = lower($1) returning email, is_staff`,
      [email.trim(), flag !== "--revoke"],
    );
    if (!res.rows[0]) {
      console.error(JSON.stringify({ ok: false, error: "user_not_found", hint: "Créez d'abord le compte via l'inscription." }));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, ...res.rows[0] }));
    await pool.end();
    return;
  }

  if (cmd === "set-plan") {
    const [tenantId, plan, ...rest] = args;
    if (!tenantId || !["trial", "essentiel", "cabinet", "expert"].includes(plan ?? "")) {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const statusIdx = rest.indexOf("--status");
    const status = statusIdx >= 0 ? rest[statusIdx + 1] : plan === "trial" ? "trialing" : "active";
    const daysIdx = rest.indexOf("--trial-days");
    const days = daysIdx >= 0 ? Number(rest[daysIdx + 1]) : 14;
    const pool = getPool();
    await pool.query(
      `insert into subscriptions (tenant_id, plan, status, trial_ends_at)
       values ($1, $2, $3, case when $3 = 'trialing' then now() + ($4::text || ' days')::interval else null end)
       on conflict (tenant_id) do update set plan = excluded.plan, status = excluded.status,
         trial_ends_at = excluded.trial_ends_at, updated_at = now()`,
      [tenantId, plan, status, String(days)],
    );
    await pool.query(
      `insert into audit_events (tenant_id, step, decision, summary, actor, correlation_id)
       values ($1, 'admin', 'plan_set', $2::jsonb, 'admin-cli', $3)`,
      [tenantId, JSON.stringify({ plan, status }), `cli-plan-${Date.now()}`],
    );
    console.log(JSON.stringify({ ok: true, tenantId, plan, status }));
    await pool.end();
    return;
  }

  if (cmd === "purge-retention") {
    const mode = args[0] ?? "--dry-run";
    if (mode !== "--dry-run" && mode !== "--execute") {
      usage();
      process.exit(1);
    }
    const pool = getPool();
    const result = await runRetentionPurge(pool, {
      dryRun: mode !== "--execute",
    });
    console.log(JSON.stringify({ ok: true, ...result }));
    await pool.end();
    return;
  }

  if (cmd === "confirm-final-action") {
    const [tenantId, flag] = args;
    if (!tenantId || flag !== "--i-understand-final") {
      usage();
      process.exit(1);
    }
    requireTenantId(tenantId);
    const pool = getPool();
    await pool.query(
      `insert into audit_events
         (tenant_id, at, step, decision, summary, actor, correlation_id)
       values ($1, now(), 'final_mode', 'confirmed', $2::jsonb, 'admin-cli', $3)`,
      [
        tenantId,
        JSON.stringify({
          warning:
            "Écriture comptable finale autorisée — obligation de moyens, pas de garantie métier",
        }),
        `final-${tenantId}-${Date.now()}`,
      ],
    );
    console.log(
      JSON.stringify({
        ok: true,
        tenantId,
        message:
          "Confirmation enregistrée. Exporter KANSO_ALLOW_FINAL=1 sur le worker pour activer action.mode=final.",
        env: "KANSO_ALLOW_FINAL=1",
      }),
    );
    await pool.end();
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
