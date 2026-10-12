import { KansoError } from "@kanso/shared";
import type { LlmUsage } from "./types.js";

export type OcrResult = { text: string; pages: number; usage: LlmUsage };

export interface OcrClient {
  ocr(content: Buffer, mime: string): Promise<OcrResult>;
}

/**
 * Mistral Document AI OCR (EU endpoint). Sends the file inline as a data URL;
 * nothing is stored on Mistral's side beyond the request.
 */
export class MistralOcrClient implements OcrClient {
  private readonly baseUrl: string;
  constructor(
    private readonly apiKey: string,
    opts: { baseUrl?: string; model?: string; fetchImpl?: typeof fetch } = {},
  ) {
    if (!apiKey) throw new KansoError("MISTRAL_API_KEY missing", "mistral_api_key_missing");
    this.baseUrl = (opts.baseUrl ?? process.env.MISTRAL_BASE_URL ?? "https://api.eu.mistral.ai/v1").replace(/\/$/, "");
    this.model = opts.model ?? "mistral-ocr-latest";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  async ocr(content: Buffer, mime: string): Promise<OcrResult> {
    const dataUrl = `data:${mime};base64,${content.toString("base64")}`;
    const document =
      mime === "application/pdf"
        ? { type: "document_url", document_url: dataUrl }
        : { type: "image_url", image_url: dataUrl };
    const res = await this.fetchImpl(`${this.baseUrl}/ocr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, document, include_image_base64: false }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new KansoError(`Mistral OCR HTTP ${res.status}: ${err.slice(0, 200)}`, "mistral_ocr_http_error");
    }
    const json = (await res.json()) as {
      model?: string;
      pages?: Array<{ index: number; markdown?: string }>;
      usage_info?: { pages_processed?: number };
    };
    const pages = json.pages ?? [];
    return {
      text: pages.map((p) => p.markdown ?? "").join("\n\n"),
      pages: json.usage_info?.pages_processed ?? pages.length,
      // OCR is billed per page; we record pages as "input tokens" ×1000 for the ledger.
      usage: {
        provider: "mistral",
        modelId: json.model ?? this.model,
        inputTokens: (json.usage_info?.pages_processed ?? pages.length) * 1000,
        outputTokens: 0,
      },
    };
  }
}
