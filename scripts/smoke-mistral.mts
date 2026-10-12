/**
 * Smoke LLM live — exige MISTRAL_API_KEY.
 * Usage:
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/smoke-mistral.mts
 */
import {
  createLlmClient,
  InboundLlmOutputSchema,
} from "../packages/llm/src/index.ts";

if (!process.env.MISTRAL_API_KEY) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "MISTRAL_API_KEY missing",
      hint: "export MISTRAL_API_KEY=… puis relancer",
    }),
  );
  process.exit(2);
}

const llm = createLlmClient();

const result = await llm.completeStructured({
  system:
    "Réponds uniquement en JSON valide Inbound. intent=answer, answer.question_id=matter_type, answer.value=corporate, assistant_message court, claimed_facts=[].",
  user: "droit des sociétés",
  schema: InboundLlmOutputSchema,
});

console.log(
  JSON.stringify({
    ok: true,
    provider: result.usage.provider,
    model: result.usage.modelId,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    data: result.data,
  }),
);
