/**
 * RAG Inbound (P3-01 / D-034) — opt-in.
 * Citations obligatoires ; refus si aucun passage (politique à brancher côté orchestrateur).
 */

export type RagChunk = {
  id: string;
  text: string;
  source?: string;
};

export type RagHit = {
  chunkId: string;
  text: string;
  source?: string;
  score: number;
};

export interface RagRetriever {
  retrieve(opts: {
    tenantId: string;
    query: string;
    limit?: number;
  }): Promise<RagHit[]>;
}

/** Index mémoire — similarité par tokens communs (stub sans embedding provider). */
export class InMemoryRagRetriever implements RagRetriever {
  private readonly byTenant = new Map<string, RagChunk[]>();

  index(tenantId: string, chunks: RagChunk[]) {
    this.byTenant.set(tenantId, chunks);
  }

  async retrieve(opts: {
    tenantId: string;
    query: string;
    limit?: number;
  }): Promise<RagHit[]> {
    const chunks = this.byTenant.get(opts.tenantId) ?? [];
    const q = tokenize(opts.query);
    if (q.size === 0) return [];
    const scored = chunks
      .map((c) => {
        const t = tokenize(c.text);
        let overlap = 0;
        for (const w of q) if (t.has(w)) overlap += 1;
        return {
          chunkId: c.id,
          text: c.text,
          source: c.source,
          score: overlap / q.size,
        };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.limit ?? 3);
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
      .filter((w) => w.length > 2),
  );
}

export function formatRagContext(hits: RagHit[]): string {
  if (hits.length === 0) {
    return "Aucun passage RAG. Si la question porte sur la FAQ, refuse poliment sans inventer.";
  }
  return [
    "Passages autorisés (cite-les ; n'affirme rien hors de ces textes) :",
    ...hits.map(
      (h, i) =>
        `[${i + 1}] (${h.chunkId}${h.source ? ` · ${h.source}` : ""}) ${h.text}`,
    ),
  ].join("\n");
}

export function ragEnabled(): boolean {
  return process.env.KANSO_RAG_ENABLED === "1" || process.env.KANSO_RAG_ENABLED === "true";
}
