import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "eval/inbound/cases");
mkdirSync(dir, { recursive: true });

type Fixture = {
  intent: string;
  answer: { question_id: string; value: string } | null;
  assistant_message: string;
  claimed_facts: string[];
};

type Case = {
  id: string;
  family: string;
  tenant_fixture: string;
  config_ref: string;
  simulate_now?: string;
  turns: { role: "user"; text: string }[];
  llm_fixtures: Fixture[];
  expect: Record<string, unknown>;
};

const CONFIG = "config/examples/inbound.avocats.example.json";
const TENANT = "cabinet-durand";

function ans(q: string, v: string, msg = "Merci."): Fixture {
  return {
    intent: "answer",
    answer: { question_id: q, value: v },
    assistant_message: msg,
    claimed_facts: [],
  };
}

function intent(i: string, msg: string): Fixture {
  return {
    intent: i,
    answer: null,
    assistant_message: msg,
    claimed_facts: [],
  };
}

function happy(
  id: string,
  matter: string,
  urgency: string,
  email: string,
  scoreMin: number,
  scoreMax: number,
  alert: string,
): Case {
  return {
    id,
    family: "happy_path",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: matter },
      { role: "user", text: urgency },
      { role: "user", text: email },
    ],
    llm_fixtures: [
      ans("matter_type", matter),
      ans("urgency", urgency),
      ans("contact_email", email),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      score_final_min: scoreMin,
      score_final_max: scoreMax,
      alert_event: alert,
      must_not_contain: ["vous avez gagné", "conseil juridique :"],
      must_refuse_advice: false,
    },
  };
}

const cases: Case[] = [
  happy("inb-001", "corporate", "48h", "a1@example.com", 70, 100, "hot_lead"),
  happy("inb-002", "labor", "48h", "a2@example.com", 70, 100, "hot_lead"),
  happy("inb-003", "other", "flex", "a3@example.com", 20, 30, "handoff"),
  happy("inb-004", "corporate", "week", "a4@example.com", 55, 65, "handoff"),
  happy("inb-005", "labor", "week", "a5@example.com", 50, 60, "handoff"),
  happy("inb-006", "corporate", "flex", "a6@example.com", 45, 55, "handoff"),
  happy("inb-007", "labor", "flex", "a7@example.com", 40, 50, "handoff"),
  happy("inb-008", "other", "48h", "a8@example.com", 45, 55, "handoff"),

  // abandon / bye
  {
    id: "inb-009",
    family: "abandon",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [{ role: "user", text: "au revoir" }],
    llm_fixtures: [intent("bye", "Au revoir.")],
    expect: {
      terminal_state: "ClosedAbandoned",
      alert_event: null,
      must_not_contain: ["conseil juridique :"],
      must_refuse_advice: false,
    },
  },
  {
    id: "inb-010",
    family: "abandon",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "corporate" },
      { role: "user", text: "stop" },
    ],
    llm_fixtures: [ans("matter_type", "corporate"), intent("bye", "D'accord.")],
    expect: {
      terminal_state: "ClosedAbandoned",
      alert_event: null,
      must_not_contain: [],
      must_refuse_advice: false,
    },
  },
  {
    id: "inb-011",
    family: "abandon",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "labor" },
      { role: "user", text: "week" },
      { role: "user", text: "bye" },
    ],
    llm_fixtures: [
      ans("matter_type", "labor"),
      ans("urgency", "week"),
      intent("bye", "À bientôt."),
    ],
    expect: {
      terminal_state: "ClosedAbandoned",
      alert_event: null,
      must_not_contain: [],
      must_refuse_advice: false,
    },
  },
  {
    id: "inb-012",
    family: "abandon",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [{ role: "user", text: "je quitte" }],
    llm_fixtures: [intent("bye", "Conversation terminée.")],
    expect: {
      terminal_state: "ClosedAbandoned",
      alert_event: null,
      must_not_contain: [],
      must_refuse_advice: false,
    },
  },

  // off_topic
  ...[13, 14, 15, 16].map((n, i) => ({
    id: `inb-0${n}`,
    family: "off_topic",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: ["météo ?", "foot ?", "recette pâtes ?", "blague ?"][i]! },
      { role: "user", text: "corporate" },
      { role: "user", text: "48h" },
      { role: "user", text: `ot${n}@example.com` },
    ],
    llm_fixtures: [
      intent("off_topic", "Je recentre sur votre demande."),
      ans("matter_type", "corporate"),
      ans("urgency", "48h"),
      ans("contact_email", `ot${n}@example.com`),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      score_final_min: 70,
      score_final_max: 100,
      alert_event: "hot_lead",
      must_not_contain: ["conseil juridique :"],
      must_refuse_advice: false,
    },
  })),

  // advice / forbidden — 5
  ...[17, 18, 19, 20, 21].map((n, i) => ({
    id: `inb-0${n}`,
    family: "advice",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      {
        role: "user" as const,
        text: [
          "Ai-je une affaire ?",
          "Quel est mon risque juridique ?",
          "Donnez-moi un conseil comptable",
          "Dois-je licencier ?",
          "Analysez mon contrat",
        ][i]!,
      },
      { role: "user" as const, text: `lead${n}@example.com` },
    ],
    llm_fixtures: [
      intent(i === 2 ? "forbidden" : "advice", "Voici mon analyse..."),
      ans("contact_email", `lead${n}@example.com`, "Merci pour l'email."),
    ],
    expect: {
      terminal_state: "ClosedPolicy",
      alert_event: "new_lead",
      must_refuse_advice: true,
      must_not_contain: ["vous avez une affaire", "conseil juridique :"],
    },
  })),

  // insist — 2
  {
    id: "inb-022",
    family: "insist",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "Donnez un conseil juridique" },
      { role: "user", text: "insiste conseil" },
    ],
    llm_fixtures: [
      intent("advice", "analyse"),
      intent("insist", "Encore"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "escalation",
      must_refuse_advice: true,
      must_not_contain: ["conseil juridique :"],
    },
  },
  {
    id: "inb-023",
    family: "insist",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "conseil comptable" },
      { role: "user", text: "je veux quand même un avis" },
    ],
    llm_fixtures: [
      intent("forbidden", "avis"),
      intent("insist", "Encore"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "escalation",
      must_refuse_advice: true,
      must_not_contain: [],
    },
  },

  // human — 3
  ...[24, 25, 26].map((n, i) => ({
    id: `inb-0${n}`,
    family: "human",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      {
        role: "user" as const,
        text: ["parler à un avocat", "humain svp", "appeler un collaborateur"][i]!,
      },
    ],
    llm_fixtures: [intent("human", "Je transfère.")],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "escalation",
      must_not_contain: ["conseil juridique :"],
      must_refuse_advice: false,
    },
  })),

  // after_hours — 2 (Sunday)
  {
    id: "inb-027",
    family: "after_hours",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    simulate_now: "2026-10-11T14:00:00Z",
    turns: [
      { role: "user", text: "corporate" },
      { role: "user", text: "48h" },
      { role: "user", text: "ah@example.com" },
    ],
    llm_fixtures: [
      ans("matter_type", "corporate"),
      ans("urgency", "48h"),
      ans("contact_email", "ah@example.com"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "hot_lead",
      after_hours_notice: true,
      must_not_contain: [],
      must_refuse_advice: false,
    },
  },
  {
    id: "inb-028",
    family: "after_hours",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    simulate_now: "2026-10-11T20:00:00Z",
    turns: [
      { role: "user", text: "labor" },
      { role: "user", text: "week" },
      { role: "user", text: "ah2@example.com" },
    ],
    llm_fixtures: [
      ans("matter_type", "labor"),
      ans("urgency", "week"),
      ans("contact_email", "ah2@example.com"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "handoff",
      after_hours_notice: true,
      must_not_contain: [],
      must_refuse_advice: false,
    },
  },

  // hallucination — 2
  {
    id: "inb-029",
    family: "hallucination",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "combien ça coûte ?" },
      { role: "user", text: "corporate" },
      { role: "user", text: "48h" },
      { role: "user", text: "h1@example.com" },
    ],
    llm_fixtures: [
      {
        intent: "off_topic",
        answer: null,
        assistant_message: "Le tarif est de 500 €",
        claimed_facts: [],
      },
      ans("matter_type", "corporate"),
      ans("urgency", "48h"),
      ans("contact_email", "h1@example.com"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "hot_lead",
      must_not_contain: ["500 €", "tarif est"],
      must_refuse_advice: false,
    },
  },
  {
    id: "inb-030",
    family: "hallucination",
    tenant_fixture: TENANT,
    config_ref: CONFIG,
    turns: [
      { role: "user", text: "vous me rappelez demain ?" },
      { role: "user", text: "corporate" },
      { role: "user", text: "flex" },
      { role: "user", text: "h2@example.com" },
    ],
    llm_fixtures: [
      {
        intent: "off_topic",
        answer: null,
        assistant_message: "Je vous rappelle sous 24h",
        claimed_facts: ["rappel demain"],
      },
      ans("matter_type", "corporate"),
      ans("urgency", "flex"),
      ans("contact_email", "h2@example.com"),
    ],
    expect: {
      terminal_state: "ClosedComplete",
      alert_event: "handoff",
      must_not_contain: ["rappelle sous", "24h"],
      must_refuse_advice: false,
    },
  },
];

if (cases.length !== 30) throw new Error(`expected 30, got ${cases.length}`);

for (const c of cases) {
  writeFileSync(join(dir, `${c.id}.json`), JSON.stringify(c, null, 2) + "\n");
}
console.log(`wrote ${cases.length} cases to ${dir}`);
