import { z } from "zod";

export type {
  LlmClient,
  LlmStructuredRequest,
  LlmUsage,
} from "./types.js";
export { MockLlmClient } from "./mock.js";
export { MeteringLlmClient } from "./metering.js";
export { estimateUsageEur } from "./pricing.js";
export { MistralLlmClient, INBOUND_RESPONSE_JSON_SCHEMA } from "./mistral.js";
export { createLlmClient, type CreateLlmClientOptions } from "./factory.js";

export const InboundLlmOutputSchema = z.object({
  intent: z.enum([
    "answer",
    "off_topic",
    "advice",
    "forbidden",
    "human",
    "bye",
    "insist",
    "other",
  ]),
  answer: z
    .object({
      question_id: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    })
    .nullable(),
  assistant_message: z.string(),
  claimed_facts: z.array(z.string()).default([]),
});

export type InboundLlmOutput = z.infer<typeof InboundLlmOutputSchema>;

export const ExtractLlmOutputSchema = z.object({
  document_type: z.enum(["invoice", "quote", "delivery_note"]),
  fields: z.record(z.unknown()),
  field_confidence: z.record(z.number().min(0).max(1)),
});

export type ExtractLlmOutput = z.infer<typeof ExtractLlmOutputSchema>;
