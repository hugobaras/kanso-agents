import type { Pool } from "pg";
import { KansoError } from "@kanso/shared";
import type { InboundSession, InboundState } from "./session.js";

export type SessionTtlConfig = {
  ttlMinutes: number;
};

export function defaultSessionTtl(): SessionTtlConfig {
  const raw = process.env.KANSO_SESSION_TTL_MINUTES ?? "30";
  const ttlMinutes = Number(raw);
  return { ttlMinutes: Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 30 };
}

export class PostgresSessionStore {
  constructor(
    private readonly pool: Pool,
    private readonly ttl: SessionTtlConfig = defaultSessionTtl(),
  ) {}

  async create(session: InboundSession): Promise<void> {
    await this.pool.query(
      `insert into inbound_sessions
        (id, tenant_id, config_version, state, score_current, score_final, answers, started_at, last_activity_at)
       values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, now(), now())`,
      [
        session.id,
        session.tenantId,
        session.configVersion,
        session.state,
        session.scoreCurrent,
        session.scoreFinal,
        JSON.stringify(session.answers),
      ],
    );
  }

  async getActive(
    tenantId: string,
    sessionId: string,
  ): Promise<InboundSession | null> {
    await this.closeExpired(tenantId);
    const res = await this.pool.query<{
      id: string;
      tenant_id: string;
      config_version: number;
      state: InboundState;
      score_current: number;
      score_final: number | null;
      answers: Record<string, unknown>;
      closed_at: Date | null;
    }>(
      `select id, tenant_id, config_version, state, score_current, score_final, answers, closed_at
       from inbound_sessions
       where id = $1::uuid and tenant_id = $2`,
      [sessionId, tenantId],
    );
    const row = res.rows[0];
    if (!row || row.closed_at) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      configVersion: row.config_version,
      state: row.state,
      scoreCurrent: row.score_current,
      scoreFinal: row.score_final,
      answers: row.answers,
      messages: [],
    };
  }

  async save(session: InboundSession): Promise<void> {
    const res = await this.pool.query(
      `update inbound_sessions
       set state = $3,
           score_current = $4,
           score_final = $5,
           answers = $6::jsonb,
           last_activity_at = now(),
           closed_at = case
             when $3 like 'Closed%' then coalesce(closed_at, now())
             else closed_at
           end,
           close_reason = case
             when $3 = 'ClosedComplete' then 'complete'
             when $3 = 'ClosedAbandoned' then 'timeout'
             when $3 = 'ClosedPolicy' then 'policy'
             when $3 = 'ClosedDegraded' then 'degraded'
             else close_reason
           end
       where id = $1::uuid and tenant_id = $2`,
      [
        session.id,
        session.tenantId,
        session.state,
        session.scoreCurrent,
        session.scoreFinal,
        JSON.stringify(session.answers),
      ],
    );
    if (res.rowCount === 0) {
      throw new KansoError("Session not found", "session_not_found");
    }
  }

  async closeExpired(tenantId?: string): Promise<number> {
    const res = await this.pool.query(
      `update inbound_sessions
       set state = 'ClosedAbandoned',
           closed_at = now(),
           close_reason = 'timeout'
       where closed_at is null
         and last_activity_at < now() - ($1::text || ' minutes')::interval
         and ($2::text is null or tenant_id = $2)`,
      [String(this.ttl.ttlMinutes), tenantId ?? null],
    );
    return res.rowCount ?? 0;
  }
}
