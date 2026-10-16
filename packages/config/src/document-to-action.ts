import { z } from "zod";

export const DocumentToActionConfigSchema = z.object({
  schema_version: z.string().min(1),
  product: z.literal("document_to_action"),
  sources: z
    .array(
      z.object({
        type: z.enum(["email_inbox", "upload_web", "google_drive", "dropbox"]),
        secret_ref: z.string().optional(),
        options: z.record(z.unknown()).optional(),
      }),
    )
    .min(1),
  documents: z.object({
    accepted_types: z
      .array(z.enum(["invoice", "quote", "delivery_note"]))
      .min(1),
    fields_by_type: z.record(z.array(z.string().min(1)).min(1)),
  }),
  validation: z.object({
    rules: z
      .array(
        z.object({
          id: z.string().min(1),
          kind: z.enum([
            "totals_coherent",
            "duplicate_check",
            "iban_allowlist",
            "approval_threshold",
            "confidence_min",
          ]),
          params: z.record(z.unknown()).optional(),
        }),
      )
      .min(1),
  }),
  action: z.object({
    target: z.object({
      provider: z.string().min(1),
      secret_ref: z.string().min(1),
    }),
    mode: z.enum(["draft", "final"]),
    on_failure: z.literal("queue_anomaly"),
    /** Stop at pending_review until a human approves (default true). */
    require_review: z.boolean().optional(),
    /** Sandbox = adapters may use mocks; live = fail loudly without credentials. */
    sandbox: z.boolean().optional(),
  }),
  alerts: z.object({
    human_review: z.object({
      min_confidence: z.number().min(0).max(1),
      channels: z
        .array(
          z.object({
            type: z.enum(["email", "slack"]),
            secret_ref: z.string().min(1),
            on: z.array(
              z.enum([
                "low_confidence",
                "validation_failed",
                "duplicate_suspected",
              ]),
            ),
          }),
        )
        .default([]),
    }),
  }),
});

export type DocumentToActionConfig = z.infer<typeof DocumentToActionConfigSchema>;

export function parseDocumentToActionConfig(
  input: unknown,
): DocumentToActionConfig {
  return DocumentToActionConfigSchema.parse(input);
}
