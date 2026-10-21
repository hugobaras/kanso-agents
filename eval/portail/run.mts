/**
 * Éval de l'analyse IA du Portail : contrôle des pièces, questions citées,
 * « non trouvé » et résistance à l'injection. Analyste simulé par défaut (0 €) ;
 * KANSO_PORTAIL_AI_MODE=mistral + MISTRAL_API_KEY pour évaluer le modèle réel.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NOT_FOUND, sanitizeAnswer, sanitizeCheck, type AiDoc, type AiItem } from "../../packages/portal/src/index.ts";
import { portailAnalyst } from "../../apps/inbound-api/src/services/portail-ai.ts";

type Case = {
  id: string;
  items: AiItem[];
  docs: AiDoc[];
  expect_findings: string[];
  forbid_findings?: string[];
  questions: Array<{ q: string; expect: string | null; forbid?: string }>;
};

const cases = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "cases.json"), "utf8")) as Case[];
const { analyst, simulated } = portailAnalyst();
const failures: string[] = [];
let checks = 0;

for (const c of cases) {
  const findings = sanitizeCheck(await analyst.check(c.items, c.docs), c.docs).findings.map((f) => f.message).join(" | ");
  for (const e of c.expect_findings) {
    checks++;
    if (!findings.includes(e)) failures.push(`${c.id}: constat attendu « ${e} » absent (${findings || "aucun"})`);
  }
  for (const f of c.forbid_findings ?? []) {
    checks++;
    if (findings.includes(f)) failures.push(`${c.id}: constat interdit « ${f} »`);
  }
  for (const q of c.questions) {
    checks++;
    const r = sanitizeAnswer(await analyst.ask(q.q, c.docs), c.docs);
    if (q.expect === null ? r.answer !== NOT_FOUND : !(r.found && r.answer.includes(q.expect) && r.citations.length > 0)) {
      failures.push(`${c.id}: « ${q.q} » → ${r.answer}`);
    }
    if (q.forbid && r.answer.includes(q.forbid)) failures.push(`${c.id}: réponse manipulée « ${q.forbid} »`);
  }
}

console.log(`Portail IA (${simulated ? "simulé" : "Mistral"}) : ${checks - failures.length}/${checks} vérifications réussies`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
