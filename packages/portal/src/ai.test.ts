import { describe, expect, it } from "vitest";
import { HeuristicPortailAnalyst, NOT_FOUND, detectType, sanitizeAnswer, validCitations, type AiDoc } from "./ai.js";

const docs: AiDoc[] = [
  { file_id: "f1", item_label: "Relevé bancaire de mars", filename: "cni.pdf", pages: ["RÉPUBLIQUE FRANÇAISE\nCarte nationale d'identité\nNom : DURAND\nDate d'expiration : 01/02/2025"] },
  { file_id: "f2", item_label: "Facture", filename: "fa.pdf", pages: ["Papeterie Martin SARL\nFACTURE N° FA-1\nTotal TTC : 1 500,00 €", "Page deux\nIBAN : FR76 3000"] },
];

describe("citations", () => {
  it("drops citations to unknown files, pages or quotes", () => {
    const out = validCitations(
      [
        { file_id: "f2", page: 2, quote: "IBAN : FR76 3000" },
        { file_id: "f2", page: 9 },
        { file_id: "autre-dossier", page: 1 },
        { file_id: "f2", page: 1, quote: "texte inventé" },
      ],
      docs,
    );
    expect(out).toEqual([{ file_id: "f2", page: 2, quote: "IBAN : FR76 3000" }, { file_id: "f2", page: 1 }]);
  });

  it("never reports an answer as found without a valid citation", () => {
    expect(sanitizeAnswer({ found: true, answer: "Le client est millionnaire", citations: [{ file_id: "x", page: 1 }] }, docs)).toEqual({
      found: false,
      answer: NOT_FOUND,
      citations: [],
    });
  });
});

describe("analyste simulé", () => {
  const a = new HeuristicPortailAnalyst(new Date("2026-10-17"));

  it("detects the document type", () => {
    expect(detectType(docs[0]!.pages[0]!)).toBe("Pièce d'identité");
    expect(detectType("Relevé de compte n°12")).toBe("Relevé bancaire");
  });

  it("flags a wrong document and an expired one, with citations", async () => {
    const r = await a.check([{ label: "Attestation", required: true, has_file: false }], docs);
    const msgs = r.findings.map((f) => f.message).join(" | ");
    expect(msgs).toContain("Aucune pièce reçue");
    expect(msgs).toContain("ressemble à : pièce d'identité");
    expect(msgs).toContain("expiré le 01/02/2025");
    expect(r.findings.find((f) => f.message.includes("expiré"))?.citations).toEqual([{ file_id: "f1", page: 1 }]);
  });

  it("answers with a page citation, or says not found", async () => {
    const yes = await a.ask("Quel est le total TTC de la facture ?", docs);
    expect(yes.found).toBe(true);
    expect(yes.citations[0]).toMatchObject({ file_id: "f2", page: 1 });
    const no = await a.ask("Quel est le numéro de sécurité sociale ?", docs);
    expect(no).toEqual({ found: false, answer: NOT_FOUND, citations: [] });
  });

  it("summarises amounts and dates per piece", async () => {
    const s = await a.summarize(docs);
    expect(s.pieces[1]).toMatchObject({ type: "Facture", amounts: ["1 500,00 €"] });
  });
});
