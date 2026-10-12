import type { z } from "zod";
import { KansoError } from "@kanso/shared";
import type { LlmClient, LlmStructuredRequest, LlmUsage } from "./types.js";

export type MistralLlmClientOptions = {
  apiKey: string;
  /** Default base: EU regional endpoint (docs.mistral.ai regional inference). */
  baseUrl?: string;
  /**
   * Model id or alias. Prefer aliases like mistral-small-latest;
   * re-validate with GET {baseUrl}/models on the EU endpoint before prod.
   */
  model?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_EU_BASE = "https://api.eu.mistral.ai/v1";
/**
 * Phase 11 (D-095): prefer ministral-8b — lower rate-limit pressure than small on demo quotas.
 * Override with KANSO_MISTRAL_MODEL.
 */
const DEFAULT_MODEL = "ministral-8b-latest";

/**
 * Minimal JSON Schema for inbound structured turns.
 * Kept hand-written to avoid coupling to a zod→json-schema converter.
 */
export const INBOUND_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: [
        "answer",
        "off_topic",
        "advice",
        "forbidden",
        "human",
        "bye",
        "insist",
        "other",
      ],
    },
    answer: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            question_id: { type: "string" },
            value: {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "array", items: { type: "string" } },
              ],
            },
          },
          required: ["question_id", "value"],
        },
        { type: "null" },
      ],
    },
    assistant_message: { type: "string" },
    claimed_facts: { type: "array", items: { type: "string" } },
  },
  required: ["intent", "answer", "assistant_message", "claimed_facts"],
} as const;

export class MistralLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MistralLlmClientOptions) {
    if (!opts.apiKey) {
      throw new KansoError("MISTRAL_API_KEY missing", "mistral_api_key_missing");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_EU_BASE).replace(/\/$/, "");
    this.model = opts.model ?? process.env.KANSO_MISTRAL_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const schemaName = "kanso_structured";
    // Prefer json_schema when possible; fall back handled by parse errors upstream.
    const body = {
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: zodLikeToLooseObjectSchema(req.schema),
        },
      },
    };

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new KansoError(
        `Mistral HTTP ${res.status}: ${errText.slice(0, 300)}`,
        "mistral_http_error",
      );
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new KansoError("Empty Mistral content", "mistral_empty");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new KansoError("Mistral content is not JSON", "mistral_bad_json");
    }
    const data = req.schema.parse(parsed);
    return {
      data,
      usage: {
        provider: "mistral",
        modelId: json.model ?? this.model,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/**
 * Map known Kanso zod schemas to JSON Schema objects for Mistral.
 * Unknown schemas → generic object (json_object path via loose schema).
 */
const HANDOFF_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistant_message: { type: "string" },
    claimed_facts: { type: "array", items: { type: "string" } },
  },
  required: ["assistant_message", "claimed_facts"],
} as const;

function zodLikeToLooseObjectSchema(schema: z.ZodType<unknown>): object {
  const typeName = (schema as { _def?: { typeName?: string } })._def?.typeName;
  // Heuristic: inbound schema is an object with intent enum — use dedicated schema.
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  if (shape && "intent" in shape && "assistant_message" in shape) {
    return INBOUND_RESPONSE_JSON_SCHEMA;
  }
  if (shape && "assistant_message" in shape && !("intent" in shape)) {
    return HANDOFF_RESPONSE_JSON_SCHEMA;
  }
  if (typeName === "ZodObject" || shape) {
    return {
      type: "object",
      additionalProperties: true,
    };
  }
  return INBOUND_RESPONSE_JSON_SCHEMA;
}
