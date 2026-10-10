import {
  InMemoryRagRetriever,
  ragEnabled,
  type RagRetriever,
} from "@kanso/inbound-engine";

const store = new InMemoryRagRetriever();
const seeded = new Set<string>();

function seedTenant(tenantId: string) {
  if (seeded.has(tenantId)) return;
  store.index(tenantId, [
    {
      id: "faq-honoraires",
      text: "Les honoraires sont communiqués uniquement sur devis par un collaborateur. L'assistant ne peut pas indiquer de tarif.",
      source: "faq",
    },
    {
      id: "faq-rdv",
      text: "Un rendez-vous peut être proposé selon les créneaux du cabinet ; aucun délai de rappel n'est garanti.",
      source: "faq",
    },
  ]);
  seeded.add(tenantId);
}

/** RAG opt-in (KANSO_RAG_ENABLED=1). */
export function resolveRag(tenantId: string): RagRetriever | undefined {
  if (!ragEnabled()) return undefined;
  seedTenant(tenantId);
  return store;
}
