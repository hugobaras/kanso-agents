import type { LlmClient, LlmStructuredRequest, LlmUsage } from "./types.js";

/** Wraps an LlmClient and accumulates usage for ledger flush. */
export class MeteringLlmClient implements LlmClient {
  readonly usages: LlmUsage[] = [];

  constructor(private readonly inner: LlmClient) {}

  async completeStructured<T>(
    req: LlmStructuredRequest<T>,
  ): Promise<{ data: T; usage: LlmUsage }> {
    const result = await this.inner.completeStructured(req);
    this.usages.push(result.usage);
    return result;
  }
}
