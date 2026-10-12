import type { LlmClient, LlmStructuredRequest, LlmUsage } from "./types.js";

/**
 * Try primary LLM; on failure use secondary (e.g. heuristic for staging when rate-limited).
 */
export class FallbackLlmClient implements LlmClient {
  constructor(
    private readonly primary: LlmClient,
    private readonly secondary: LlmClient,
    private readonly onPrimaryError?: (err: unknown) => void,
  ) {}

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    try {
      return await this.primary.completeStructured(req);
    } catch (err) {
      this.onPrimaryError?.(err);
      const result = await this.secondary.completeStructured(req);
      return {
        ...result,
        usage: {
          ...result.usage,
          provider: `${result.usage.provider}+fallback`,
        },
      };
    }
  }
}
