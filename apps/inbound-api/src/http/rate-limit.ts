import type { Pool } from "@kanso/tenancy";
import type { MiddlewareHandler } from "hono";
import { HttpError } from "./errors.js";
import type { AppEnv } from "./types.js";

/**
 * Fixed-window rate limiter backed by Postgres (works across API replicas),
 * with an in-process fast path that rejects obvious floods without a query.
 */
export class RateLimiter {
  private readonly local = new Map<string, { windowStart: number; count: number }>();

  constructor(private readonly pool: () => Pool) {}

  async hit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);

    const l = this.local.get(key);
    if (l && l.windowStart === windowStart && l.count >= limit) {
      return { ok: false, retryAfter };
    }

    const res = await this.pool().query<{ count: number }>(
      `insert into rate_limits (key, window_start, count) values ($1, to_timestamp($2 / 1000.0), 1)
       on conflict (key, window_start) do update set count = rate_limits.count + 1
       returning count`,
      [key, windowStart],
    );
    const count = res.rows[0]?.count ?? 1;
    this.local.set(key, { windowStart, count });
    if (this.local.size > 10_000) this.local.clear();
    return { ok: count <= limit, retryAfter };
  }

  /** Drop windows older than a day (called by the scheduler). */
  static async cleanup(pool: Pool): Promise<number> {
    const res = await pool.query(`delete from rate_limits where window_start < now() - interval '1 day'`);
    return res.rowCount ?? 0;
  }
}

export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "local";
}

export function rateLimit(
  limiter: RateLimiter,
  opts: { name: string; limit: number; windowSec: number; key?: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string },
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (process.env.KANSO_RATE_LIMIT === "0") return next();
    const k = opts.key ? opts.key(c) : clientIp(c);
    const { ok, retryAfter } = await limiter.hit(`${opts.name}:${k}`, opts.limit, opts.windowSec);
    if (!ok) {
      c.header("Retry-After", String(retryAfter));
      throw new HttpError(429, "rate_limited", "Trop de requêtes, réessayez dans un instant.");
    }
    await next();
  };
}
