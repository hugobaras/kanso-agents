import type { InboundConfig } from "@kanso/config";
import { HandoffMessageSchema, type LlmClient } from "@kanso/llm";
import type { InboundSession } from "./session.js";
import { containsUnsafeClaim, stripMarkdown } from "./validate-llm.js";

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
  lines.push(
    "Un collaborateur pourra vous recontacter selon ses disponibilités, sans engagement de délai.",
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
  // The closing message is a commitment towards the visitor: deterministic by
  // default (no invented civility, no implied follow-up). LLM wording is opt-in.
  if (process.env.KANSO_LLM_HANDOFF !== "1") return { message: template, source: "template" };
  try {
    const answersJson = JSON.stringify(opts.session.answers);
    const { data } = await opts.llm.completeStructured({
      system: [
        "Tu rédiges le message de clôture d'un assistant de qualification (pas un humain).",
        `Cabinet: ${opts.config.identity.display_name}`,
        "Contraintes: pas de conseil juridique, pas de prix, pas de délai de rappel promis, pas de faits inventés.",
        "N'utilise ni Monsieur ni Madame : ne suppose jamais le genre ou la civilité du visiteur.",
        "claimed_facts doit rester [].",
        "Ton: courtois, concis (2–4 phrases), confirme la transmission à l'équipe.",
        `Réponses collectées (JSON): ${answersJson}`,
      ].join("\n"),
      user: "Rédige assistant_message de handoff.",
      schema: HandoffMessageSchema,
    });
    if ((data.claimed_facts ?? []).length > 0) {
      return { message: template, source: "template" };
    }
    const msg = stripMarkdown(data.assistant_message);
    if (!msg || containsUnsafeClaim(msg)) {
      return { message: template, source: "template" };
    }
    return { message: msg, source: "llm" };
  } catch {
    return { message: template, source: "template" };
  }
}
