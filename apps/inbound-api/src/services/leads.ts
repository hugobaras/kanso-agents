import type { InboundConfig } from "@kanso/config";
import type { InboundSession } from "@kanso/inbound-engine";
import type { Pool } from "@kanso/tenancy";

export type LeadTier = "hot" | "warm" | "cold";

export function tierFor(config: InboundConfig, score: number): LeadTier {
  if (score >= config.scoring.thresholds.hot) return "hot";
  if (score >= config.scoring.thresholds.warm) return "warm";
  return "cold";
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;

/** Pull contact details from answers (by id convention, then by value shape). */
export function extractContact(answers: Record<string, unknown>): {
  name?: string;
  email?: string;
  phone?: string;
} {
  const out: { name?: string; email?: string; phone?: string } = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const key = k.toLowerCase();
    const val = v.trim();
    if (!out.email && (key.includes("email") || key.includes("mail"))) {
      out.email = EMAIL_RE.exec(val)?.[0] ?? val;
    } else if (!out.phone && (key.includes("phone") || key.includes("tel"))) {
      out.phone = val;
    } else if (!out.name && (key.includes("name") || key.includes("nom"))) {
      out.name = val.slice(0, 120);
    }
  }
  if (!out.email) {
    for (const v of Object.values(answers)) {
      const m = typeof v === "string" ? EMAIL_RE.exec(v) : null;
      if (m) {
        out.email = m[0];
        break;
      }
    }
  }
  if (!out.phone) {
    for (const v of Object.values(answers)) {
      const m = typeof v === "string" ? PHONE_RE.exec(v) : null;
      if (m) {
        out.phone = m[0];
        break;
      }
    }
  }
  return out;
}

/** Human-readable answers ("Domaine : Droit du travail") using option labels. */
export function labelledAnswers(
  config: InboundConfig,
  answers: Record<string, unknown>,
): Array<[string, string]> {
  return config.qualification.questions
    .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
    .map((q) => {
      const raw = answers[q.id];
      const values = Array.isArray(raw) ? raw : [raw];
      const text = values
        .map((v) => q.options?.find((o) => o.id === v)?.label ?? String(v))
        .join(", ");
      return [q.prompt.replace(/\s*\?$/, ""), text] as [string, string];
    });
}

export function summarize(config: InboundConfig, answers: Record<string, unknown>): string {
  return labelledAnswers(config, answers)
    .filter(([, v]) => !EMAIL_RE.test(v))
    .slice(0, 3)
    .map(([, v]) => v)
    .join(" · ");
}

export async function upsertLead(
  pool: Pool,
  opts: {
    tenantId: string;
    session: InboundSession;
    config: InboundConfig;
    event: string;
  },
): Promise<{ id: string; tier: LeadTier; score: number; created: boolean }> {
  const score = opts.session.scoreFinal ?? opts.session.scoreCurrent;
  const tier = opts.event === "escalation" && score < opts.config.scoring.thresholds.warm ? "warm" : tierFor(opts.config, score);
  const contact = extractContact(opts.session.answers);
  const res = await pool.query<{ id: string; inserted: boolean }>(
    `insert into leads (tenant_id, session_id, contact, answers, score, tier, event, summary)
     values ($1, $2::uuid, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
     on conflict (session_id) do update set
       contact = excluded.contact, answers = excluded.answers, score = excluded.score,
       tier = excluded.tier, event = excluded.event, summary = excluded.summary, updated_at = now()
     returning id, (xmax = 0) as inserted`,
    [
      opts.tenantId,
      opts.session.id,
      JSON.stringify(contact),
      JSON.stringify(opts.session.answers),
      score,
      tier,
      opts.event,
      summarize(opts.config, opts.session.answers),
    ],
  );
  const row = res.rows[0]!;
  return { id: row.id, tier, score, created: row.inserted };
}
