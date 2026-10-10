import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundConfig } from "./inbound.js";
import { parseDocumentToActionConfig } from "./document-to-action.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("config examples", () => {
  it("parses inbound avocats example", () => {
    const raw = JSON.parse(
      readFileSync(
        join(root, "config/examples/inbound.avocats.example.json"),
        "utf8",
      ),
    );
    const cfg = parseInboundConfig(raw);
    expect(cfg.product).toBe("inbound");
    expect(cfg.scoring.max_score).toBe(100);
  });

  it("parses document_to_action btp example", () => {
    const raw = JSON.parse(
      readFileSync(
        join(root, "config/examples/document_to_action.btp.example.json"),
        "utf8",
      ),
    );
    const cfg = parseDocumentToActionConfig(raw);
    expect(cfg.action.mode).toBe("draft");
  });
});
