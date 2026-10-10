import { z } from "zod";

const secretRef = z.object({ secret_ref: z.string().min(1) });

const questionOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const question = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(["single_choice", "multi_choice", "free_text", "number", "boolean"]),
  required: z.boolean(),
  options: z.array(questionOption).optional(),
});

const weight = z.union([
  z.object({
    kind: z.literal("choice_map"),
    points: z.record(z.number()),
  }),
  z.object({
    kind: z.literal("boolean"),
    true_points: z.number(),
    false_points: z.number(),
  }),
  z.object({
    kind: z.literal("number_range"),
    ranges: z.array(
      z.object({ min: z.number(), max: z.number(), points: z.number() }),
    ),
  }),
  z.object({
    kind: z.literal("free_text"),
    points_if_non_empty: z.number(),
  }),
]);

export const InboundConfigSchema = z.object({
  schema_version: z.string().min(1),
  product: z.literal("inbound"),
  identity: z.object({
    display_name: z.string().min(1),
    locale_default: z.enum(["fr", "en"]),
    branding: z.object({
      primary_color: z.string().min(1),
      logo_url: z.string().url().nullable().optional(),
    }),
  }),
  disclosure: z.object({
    ai_notice: z.string().min(1),
    forbidden_topics: z.array(z.string()).min(1),
  }),
  qualification: z.object({
    questions: z.array(question).min(1),
  }),
  scoring: z.object({
    max_score: z.literal(100),
    thresholds: z.object({
      hot: z.number().min(0).max(100),
      warm: z.number().min(0).max(100),
      cold: z.number().min(0).max(100),
    }),
    weights: z.record(weight),
  }),
  alerts: z.object({
    channels: z
      .array(
        z.object({
          type: z.enum(["email", "slack"]),
          secret_ref: z.string().min(1),
          on: z.array(
            z.enum(["new_lead", "hot_lead", "escalation", "handoff"]),
          ),
        }),
      )
      .min(1),
  }),
  operations: z.object({
    timezone: z.string().min(1),
    languages: z.array(z.string()).min(1),
    business_hours: z.record(z.array(z.tuple([z.string(), z.string()]))),
    escalation: z.object({
      user_requests_human: z.boolean(),
      keywords: z.array(z.string()),
      message: z.string().min(1),
    }),
  }),
  integrations: z
    .object({
      calendar: z
        .object({
          provider: z.string().min(1),
          secret_ref: z.string().min(1),
        })
        .optional(),
      crm: z
        .object({
          provider: z.string().min(1),
          secret_ref: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
});

export type InboundConfig = z.infer<typeof InboundConfigSchema>;

export function parseInboundConfig(input: unknown): InboundConfig {
  return InboundConfigSchema.parse(input);
}

export { secretRef };
