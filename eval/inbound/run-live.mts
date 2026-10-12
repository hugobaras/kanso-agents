/**
 * Sous-ensemble live Inbound (P12-03 / D-097) — hors CI.
 * Usage: set -a && source .env.local && set +a && pnpm eval:inbound:live
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseInboundConfig } from "../../packages/config/src/index.ts";
import {
  createLlmClient,
  FallbackLlmClient,
  RetryLlmClient,
} from "../../packages/llm/src/index.ts";
import {
  createSession,
  InboundHeuristicLlmClient,
  newSessionId,
  orchestrateTurn,
  startQualification,
} from "../../packages/inbound-engine/src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const reportsDir = join(root, "eval/inbound/reports");

const config = parseInboundConfig(
  JSON.parse(
    readFileSync(
      join(root, "config/examples/inbound.avocats.example.json"),
      "utf8",
    ),
  ),
);

type LiveCase = {
  id: string;
  family: string;
  turns: string[];
  expect: {
    terminal_prefix?: string;
    must_refuse_advice?: boolean;
    alert_event?: string | null;
    score_final_min?: number;
  };
};

const cases: LiveCase[] = [
  {
    id: "live-001-advice",
    family: "advice",
    turns: ["Quel est mon droit exact sur ce licenciement ?"],
    expect: { must_refuse_advice: true },
  },
  {
    id: "live-002-happy-hot",
    family: "happy_path",
    turns: ["Droit social", "Sous 48 h", "live-eval@example.com"],
    expect: {
      terminal_prefix: "Closed",
      alert_event: "hot_lead",
      score_final_min: 60,
    },
  },
  {
    id: "live-003-offtopic",
    family: "off_topic",
    turns: ["Quelle est la capitale de la France ?"],
    expect: {},
  },
  {
    id: "live-004-bye",
    family: "bye",
    turns: ["au revoir"],
    expect: { terminal_prefix: "Closed" },
  },
  {
    id: "live-005-human",
    family: "escalation",
    turns: ["Je veux parler à un avocat"],
    expect: { alert_event: "escalation" },
  },
];

function makeLlm() {
  const heuristic = new InboundHeuristicLlmClient(config);
  if (!process.env.MISTRAL_API_KEY) {
    console.warn("MISTRAL_API_KEY missing — live suite runs on heuristic only");
    return heuristic;
  }
  return new FallbackLlmClient(
    new RetryLlmClient(createLlmClient(), { maxAttempts: 2, baseDelayMs: 400 }),
    heuristic,
  );
}

const llm = makeLlm();
const results: Array<{
  id: string;
  family: string;
  pass: boolean;
  failures: string[];
  observed: Record<string, unknown>;
}> = [];

for (const c of cases) {
  let session = createSession(newSessionId(), "live-eval", 1);
  session = startQualification(session, config).session;
  const assistantMessages: string[] = [];
  let lastAlert: string | null = null;
  const failures: string[] = [];

  for (const text of c.turns) {
    if (session.state.startsWith("Closed")) break;
    const turn = await orchestrateTurn({
      session,
      config,
      userText: text,
      llm,
    });
    session = turn.session;
    assistantMessages.push(turn.assistantMessage);
    if (turn.alertEvent) lastAlert = turn.alertEvent;
  }

  const blob = assistantMessages.join("\n");
  if (c.expect.terminal_prefix && !session.state.startsWith(c.expect.terminal_prefix)) {
    failures.push(`state ${session.state} not ${c.expect.terminal_prefix}*`);
  }
  if (c.expect.must_refuse_advice && !/ne peux pas fournir de conseil/i.test(blob)) {
    failures.push("missing advice refuse");
  }
  if ("alert_event" in c.expect && (c.expect.alert_event ?? null) !== lastAlert) {
    failures.push(`alert got ${lastAlert} want ${c.expect.alert_event}`);
  }
  if (
    c.expect.score_final_min !== undefined &&
    (session.scoreFinal ?? -1) < c.expect.score_final_min
  ) {
    failures.push(`score ${session.scoreFinal} < ${c.expect.score_final_min}`);
  }

  results.push({
    id: c.id,
    family: c.family,
    pass: failures.length === 0,
    failures,
    observed: {
      terminal_state: session.state,
      score_final: session.scoreFinal,
      alert_event: lastAlert,
      assistant_tail: assistantMessages.at(-1)?.slice(0, 160),
    },
  });
}

const failed = results.filter((r) => !r.pass);
const report = {
  at: new Date().toISOString(),
  mode: process.env.MISTRAL_API_KEY ? "live+fallback" : "heuristic",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};

mkdirSync(reportsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = join(reportsDir, `${stamp}-live.json`);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      passed: report.passed,
      failed: report.failed,
      report: out,
      failures: failed.map((f) => ({ id: f.id, failures: f.failures })),
    },
    null,
    2,
  ),
);
process.exit(failed.length === 0 ? 0 : 1);
