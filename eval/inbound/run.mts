import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseInboundConfig } from "../../packages/config/src/index.ts";
import { MockLlmClient } from "../../packages/llm/src/index.ts";
import {
  AFTER_HOURS_NOTICE,
  createSession,
  newSessionId,
  orchestrateTurn,
  startQualification,
} from "../../packages/inbound-engine/src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const casesDir = join(root, "eval/inbound/cases");
const reportsDir = join(root, "eval/inbound/reports");

type EvalCase = {
  id: string;
  family: string;
  tenant_fixture: string;
  config_ref: string;
  simulate_now?: string;
  turns: { role: string; text: string }[];
  llm_fixtures: unknown[];
  expect: {
    terminal_state: string;
    score_final_min?: number;
    score_final_max?: number;
    alert_event?: string | null;
    must_not_contain?: string[];
    must_refuse_advice?: boolean;
    after_hours_notice?: boolean;
  };
};

type CaseResult = {
  id: string;
  family: string;
  pass: boolean;
  failures: string[];
  observed: {
    terminal_state: string;
    score_final: number | null;
    alert_event: string | null;
    assistant_messages: string[];
  };
};

async function runCase(c: EvalCase): Promise<CaseResult> {
  const config = parseInboundConfig(
    JSON.parse(readFileSync(join(root, c.config_ref), "utf8")),
  );
  const now = c.simulate_now ? new Date(c.simulate_now) : new Date();
  let session = createSession(newSessionId(), c.tenant_fixture, 1);
  const started = startQualification(session, config, { now });
  session = started.session;
  const assistantMessages = [started.assistantMessage];
  let lastAlert: string | null = null;
  const llm = new MockLlmClient(c.llm_fixtures);

  for (const turn of c.turns) {
    if (session.state.startsWith("Closed")) break;
    const result = await orchestrateTurn({
      session,
      config,
      userText: turn.text,
      llm,
    });
    session = result.session;
    assistantMessages.push(result.assistantMessage);
    if (result.alertEvent) lastAlert = result.alertEvent;
  }

  const failures: string[] = [];
  if (session.state !== c.expect.terminal_state) {
    failures.push(
      `terminal_state: got ${session.state}, want ${c.expect.terminal_state}`,
    );
  }
  if (c.expect.score_final_min !== undefined) {
    const s = session.scoreFinal ?? -1;
    if (s < c.expect.score_final_min) {
      failures.push(`score_final ${s} < min ${c.expect.score_final_min}`);
    }
  }
  if (c.expect.score_final_max !== undefined) {
    const s = session.scoreFinal ?? 999;
    if (s > c.expect.score_final_max) {
      failures.push(`score_final ${s} > max ${c.expect.score_final_max}`);
    }
  }
  if ("alert_event" in c.expect) {
    const want = c.expect.alert_event ?? null;
    if (lastAlert !== want) {
      failures.push(`alert_event: got ${lastAlert}, want ${want}`);
    }
  }
  const blob = assistantMessages.join("\n");
  for (const banned of c.expect.must_not_contain ?? []) {
    if (banned && blob.toLowerCase().includes(banned.toLowerCase())) {
      failures.push(`must_not_contain hit: ${banned}`);
    }
  }
  if (c.expect.must_refuse_advice) {
    if (!/ne peux pas fournir de conseil/i.test(blob)) {
      failures.push("must_refuse_advice: missing refuse wording");
    }
  }
  if (c.expect.after_hours_notice) {
    if (!assistantMessages.some((m) => m.includes(AFTER_HOURS_NOTICE))) {
      failures.push("after_hours_notice missing");
    }
  }

  return {
    id: c.id,
    family: c.family,
    pass: failures.length === 0,
    failures,
    observed: {
      terminal_state: session.state,
      score_final: session.scoreFinal,
      alert_event: lastAlert,
      assistant_messages: assistantMessages,
    },
  };
}

const files = readdirSync(casesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();
const results: CaseResult[] = [];
for (const file of files) {
  const c = JSON.parse(readFileSync(join(casesDir, file), "utf8")) as EvalCase;
  results.push(await runCase(c));
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
const adviceCases = results.filter((r) => r.family === "advice");
const advicePass = adviceCases.filter((r) => r.pass).length;
const halluHits = results.filter(
  (r) =>
    r.family === "hallucination" &&
    r.failures.some((f) => f.startsWith("must_not_contain")),
).length;

const report = {
  at: new Date().toISOString(),
  mode: "mock",
  total: results.length,
  passed,
  failed: failed.length,
  metrics: {
    terminal_state_accuracy: results.length
      ? passed / results.length
      : 0,
    policy_refuse_recall: adviceCases.length
      ? advicePass / adviceCases.length
      : 1,
    hallucination_violations: halluHits,
  },
  results,
};

mkdirSync(reportsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = join(reportsDir, `${stamp}-mock.json`);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      passed,
      failed: failed.length,
      metrics: report.metrics,
      report: out,
      failures: failed.map((f) => ({ id: f.id, failures: f.failures })),
    },
    null,
    2,
  ),
);

process.exit(failed.length === 0 ? 0 : 1);
