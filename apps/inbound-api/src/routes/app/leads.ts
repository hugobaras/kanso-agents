import { parseInboundConfig } from "@kanso/config";
import { PostgresSessionStore } from "@kanso/inbound-engine";
import { getPool } from "@kanso/tenancy";
import { Hono } from "hono";
import { z } from "zod";
import { actorLabel, assertModule, currentWorkspace } from "../../auth/middleware.js";
import { audit } from "../../auth/service.js";
import { body } from "../../http/body.js";
import { notFound } from "../../http/errors.js";
import type { AppEnv } from "../../http/types.js";
import { labelledAnswers } from "../../services/leads.js";

const STATUSES = ["new", "contacted", "qualified", "won", "lost", "spam"] as const;
const TIERS = ["hot", "warm", "cold"] as const;

const ListQuery = z.object({
  status: z.enum(STATUSES).optional(),
  tier: z.enum(TIERS).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

type LeadRow = {
  id: string;
  session_id: string;
  contact: { name?: string; email?: string; phone?: string };
  answers: Record<string, unknown>;
  score: number;
  tier: string;
  event: string;
  status: string;
  summary: string | null;
  notes: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  created_at: Date;
  updated_at: Date;
};

function where(tenantId: string, q: z.infer<typeof ListQuery>) {
  const clauses = ["l.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    clauses.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (q.status) add("l.status = ?", q.status);
  if (q.tier) add("l.tier = ?", q.tier);
  if (q.from) add("l.created_at >= ?::date", q.from);
  if (q.to) add("l.created_at < (?::date + 1)", q.to);
  if (q.q) add("(l.contact::text ilike ? or coalesce(l.summary, '') ilike ?)", `%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
  return { sql: clauses.join(" and "), params };
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function leadsRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    assertModule(c, "inbound");
    await next();
  });

  app.get("/", async (c) => {
    const ws = currentWorkspace(c);
    const q = ListQuery.parse(c.req.query());
    const w = where(ws.tenantId, q);
    const params = [...w.params];
    let sql = `select l.*, u.name as assignee_name from leads l
               left join users u on u.id = l.assignee_user_id where ${w.sql}`;
    if (q.cursor) {
      params.push(q.cursor);
      sql += ` and l.created_at < $${params.length}`;
    }
    params.push(q.limit + 1);
    sql += ` order by l.created_at desc limit $${params.length}`;
    const pool = getPool();
    const [rows, counts] = await Promise.all([
      pool.query<LeadRow>(sql, params),
      pool.query<{ status: string; n: string }>(
        `select status, count(*)::text as n from leads where tenant_id = $1 group by status`,
        [ws.tenantId],
      ),
    ]);
    const items = rows.rows.slice(0, q.limit);
    return c.json({
      leads: items.map((l) => ({
        id: l.id,
        contact: l.contact,
        score: l.score,
        tier: l.tier,
        event: l.event,
        status: l.status,
        summary: l.summary,
        assignee: l.assignee_user_id ? { id: l.assignee_user_id, name: l.assignee_name } : null,
        created_at: l.created_at,
      })),
      next_cursor: rows.rows.length > q.limit ? items[items.length - 1]!.created_at.toISOString() : null,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)])),
    });
  });

  app.get("/export.csv", async (c) => {
    const ws = currentWorkspace(c);
    const q = ListQuery.parse({ ...c.req.query(), limit: 100 });
    const w = where(ws.tenantId, q);
    const rows = await getPool().query<LeadRow>(
      `select l.*, null as assignee_name from leads l where ${w.sql} order by l.created_at desc limit 5000`,
      w.params,
    );
    const header = ["date", "nom", "email", "telephone", "score", "niveau", "statut", "resume"];
    const lines = rows.rows.map((l) =>
      [
        l.created_at.toISOString(),
        l.contact.name,
        l.contact.email,
        l.contact.phone,
        l.score,
        l.tier,
        l.status,
        l.summary,
      ]
        .map(csvCell)
        .join(";"),
    );
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="demandes-${ws.tenantId}.csv"`);
    return c.body(`﻿${header.join(";")}\n${lines.join("\n")}\n`);
  });

  app.get("/:id", async (c) => {
    const ws = currentWorkspace(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("lead_not_found");
    const pool = getPool();
    const res = await pool.query<LeadRow & { config_version: number; origin: string | null }>(
      `select l.*, u.name as assignee_name, s.config_version, s.origin
       from leads l join inbound_sessions s on s.id = l.session_id
       left join users u on u.id = l.assignee_user_id
       where l.tenant_id = $1 and l.id = $2`,
      [ws.tenantId, id.data],
    );
    const lead = res.rows[0];
    if (!lead) throw notFound("lead_not_found");
    const cfgRow = await pool.query<{ config: unknown }>(
      `select config from tenant_configs where tenant_id = $1 and product = 'inbound' and version = $2`,
      [ws.tenantId, lead.config_version],
    );
    const config = cfgRow.rows[0] ? parseInboundConfig(cfgRow.rows[0].config) : null;
    const transcript = await new PostgresSessionStore(pool).transcript(ws.tenantId, lead.session_id);
    const breakdown = config
      ? config.qualification.questions.map((q) => {
          const w = config.scoring.weights[q.id];
          const v = lead.answers[q.id];
          let points = 0;
          if (w && v !== undefined) {
            if (w.kind === "choice_map") points = (Array.isArray(v) ? v : [v]).reduce((s: number, x) => s + (w.points[String(x)] ?? 0), 0);
            else if (w.kind === "boolean") points = v === true || v === "true" ? w.true_points : w.false_points;
            else if (w.kind === "free_text") points = String(v).trim() ? w.points_if_non_empty : 0;
            else if (w.kind === "number_range") points = w.ranges.find((r) => Number(v) >= r.min && Number(v) <= r.max)?.points ?? 0;
          }
          return { question_id: q.id, label: q.prompt, points };
        })
      : [];
    return c.json({
      lead: {
        id: lead.id,
        contact: lead.contact,
        score: lead.score,
        tier: lead.tier,
        event: lead.event,
        status: lead.status,
        summary: lead.summary,
        notes: lead.notes,
        origin: lead.origin,
        assignee: lead.assignee_user_id ? { id: lead.assignee_user_id, name: lead.assignee_name } : null,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      },
      answers: config ? labelledAnswers(config, lead.answers).map(([label, value]) => ({ label, value })) : [],
      score_breakdown: breakdown,
      thresholds: config?.scoring.thresholds ?? null,
      transcript: transcript.map((m) => ({ role: m.role, content: m.content, at: m.created_at })),
    });
  });

  app.patch("/:id", async (c) => {
    const ws = currentWorkspace(c);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw notFound("lead_not_found");
    const b = await body(
      c.req,
      z.object({
        status: z.enum(STATUSES).optional(),
        assignee_user_id: z.string().uuid().nullable().optional(),
        notes: z.string().max(5000).optional(),
      }),
    );
    const pool = getPool();
    if (b.assignee_user_id) {
      const m = await pool.query(`select 1 from memberships where tenant_id = $1 and user_id = $2`, [ws.tenantId, b.assignee_user_id]);
      if (m.rowCount === 0) throw notFound("member_not_found");
    }
    const res = await pool.query(
      `update leads set
         status = coalesce($3, status),
         assignee_user_id = case when $4::boolean then $5::uuid else assignee_user_id end,
         notes = coalesce($6, notes),
         updated_at = now()
       where tenant_id = $1 and id = $2 returning id`,
      [ws.tenantId, id.data, b.status ?? null, b.assignee_user_id !== undefined, b.assignee_user_id ?? null, b.notes ?? null],
    );
    if (res.rowCount === 0) throw notFound("lead_not_found");
    if (b.status) {
      await audit(pool, {
        tenantId: ws.tenantId,
        actor: actorLabel(c),
        step: "lead",
        decision: `status_${b.status}`,
        summary: { lead_id: id.data },
      });
    }
    return c.json({ ok: true });
  });

  return app;
}
