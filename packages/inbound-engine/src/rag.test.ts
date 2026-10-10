import { describe, expect, it } from "vitest";
import {
  formatRagContext,
  InMemoryRagRetriever,
  ragEnabled,
} from "./rag.js";

describe("InMemoryRagRetriever", () => {
  it("ranks overlapping chunks", async () => {
    const rag = new InMemoryRagRetriever();
    rag.index("t1", [
      { id: "c1", text: "Nos honoraires sont communiqués sur devis uniquement." },
      { id: "c2", text: "Le cabinet est fermé le dimanche." },
    ]);
    const hits = await rag.retrieve({
      tenantId: "t1",
      query: "honoraires devis",
    });
    expect(hits[0]?.chunkId).toBe("c1");
    expect(formatRagContext(hits)).toMatch(/Passages autorisés/);
  });

  it("ragEnabled reads env", () => {
    const prev = process.env.KANSO_RAG_ENABLED;
    process.env.KANSO_RAG_ENABLED = "1";
    expect(ragEnabled()).toBe(true);
    delete process.env.KANSO_RAG_ENABLED;
    expect(ragEnabled()).toBe(false);
    if (prev !== undefined) process.env.KANSO_RAG_ENABLED = prev;
  });
});
