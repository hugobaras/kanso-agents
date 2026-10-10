import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import type { DocumentSourceAdapter } from "./types.js";

export type InboxItem = {
  sourceItemId: string;
  filename?: string;
  contentType: string;
  payloadRef: string;
  receivedAt: string;
};

/**
 * Source `email_inbox` — file locale / IMAP futur.
 * Secret optionnel ; MVP = file en mémoire injectée (tests + worker).
 */
export class EmailInboxSourceAdapter implements DocumentSourceAdapter {
  private readonly queue: InboxItem[];
  private readonly acked = new Set<string>();

  constructor(initial: InboxItem[] = []) {
    this.queue = [...initial];
  }

  enqueue(item: InboxItem) {
    this.queue.push(item);
  }

  async poll(
    input: { cursor?: string },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<
    AdapterResult<{
      items: InboxItem[];
      nextCursor?: string;
    }>
  > {
    const start = input.cursor ? Number(input.cursor) : 0;
    const pending = this.queue
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => index >= start && !this.acked.has(item.sourceItemId));
    const items = pending.map((p) => p.item);
    const next =
      pending.length > 0
        ? String((pending[pending.length - 1]?.index ?? start) + 1)
        : undefined;
    return { status: "ok", data: { items, nextCursor: next } };
  }

  async ack(
    input: { sourceItemId: string },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ acked: true }>> {
    this.acked.add(input.sourceItemId);
    return { status: "ok", data: { acked: true } };
  }
}

/** upload_web : pas de poll — l’API crée le job directement. */
export class UploadWebSourceAdapter implements DocumentSourceAdapter {
  async poll(): Promise<
    AdapterResult<{
      items: InboxItem[];
      nextCursor?: string;
    }>
  > {
    return { status: "ok", data: { items: [] } };
  }

  async ack(): Promise<AdapterResult<{ acked: true }>> {
    return { status: "ok", data: { acked: true } };
  }
}
