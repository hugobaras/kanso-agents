import type { z } from "zod";

export type LlmUsage = {
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmStructuredRequest<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
};

export interface LlmClient {
  completeStructured<T>(req: LlmStructuredRequest<T>): Promise<{
    data: T;
    usage: LlmUsage;
  }>;
}
