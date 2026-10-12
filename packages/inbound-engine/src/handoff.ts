import type { InboundConfig } from "@kanso/config";
import { HandoffMessageSchema, type LlmClient } from "@kanso/llm";
import type { InboundSession } from "./session.js";

/**
 * Deterministic handoff copy (D-092 template path).
 * Means only — no deadlines, prices, or legal advice.
 */
export function buildHandoffTemplate(
  config: InboundConfig,
  session: InboundSession,
): string {
  const name = config.identity.display_name;
  const lines = [
    `Merci. J'ai transmis votre demande à l'équipe de ${name}.`,
  ];

  const bits: string[] = [];
  for (const q of config.qualification.questions) {
    const raw = session.answers[q.id];
    if (raw === undefined || raw === null || raw === "") continue;
    let display = String(raw);
    if (q.options?.length) {
      const opt = q.options.find((o) => o.id === String(raw));
      if (opt) display = opt.label;
    }
    bits.push(`${q.prompt.replace(/\?$/, "")} : ${display}`);
  }
  if (bits.length) {
    lines.push(`Récapitulatif : ${bits.join(" · ")}.`);
  }
  if (session.scoreFinal != null) {
    lines.push(`Score interne : ${session.scoreFinal}/${config.scoring.max_score}.`);
  }
  lines.push(
    "Un collaborateur vous recontactera selon leurs disponibilités (sans engagement de délai).",
  );
  return lines.join(" ");
}

/**
 * Try LLM synthesis; on any failure return template (D-092).
 */
export async function synthesizeHandoffMessage(opts: {
  llm: LlmClient;
  config: InboundConfig;
  session: InboundSession;
}): Promise<{ message: string; source: "llm" | "template" }> {
  const template = buildHandoffTemplate(opts.config, opts.session);
  try {
    const answersJson = JSON.stringify(opts.session.answers);
    const { data } = await opts.llm.completeStructured({
      system: [
        "Tu rédiges le message de clôture d'un assistant de qualification (pas un humain).",
        `Cabinet: ${opts.config.identity.display_name}`,
        "Contraintes: pas de conseil juridique, pas de prix, pas de délai de rappel promis, pas de faits inventés.",
        "claimed_facts doit rester [].",
        "Ton: courtois, concis (2–4 phrases), confirme la transmission à l'équipe.",
        `Réponses collectées (JSON): ${answersJson}`,
        `Score final: ${opts.session.scoreFinal ?? "n/a"}`,
      ].join("\n"),
      user: "Rédige assistant_message de handoff.",
      schema: HandoffMessageSchema,
    });
    if ((data.claimed_facts ?? []).length > 0) {
      return { message: template, source: "template" };
    }
    const msg = data.assistant_message.trim();
    if (!msg || /\b(\d+\s*€|tarif|je vous rappelle sous)\b/i.test(msg)) {
      return { message: template, source: "template" };
    }
    return { message: msg, source: "llm" };
  } catch {
    return { message: template, source: "template" };
  }
}
