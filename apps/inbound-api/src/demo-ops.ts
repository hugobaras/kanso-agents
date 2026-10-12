/**
 * Ring buffer démo — rend visible score / alertes / tours (valeur cabinet).
 * Pas de persistance ; mémoire process staging uniquement.
 */

export type DemoTurnEvent = {
  at: string;
  kind: "turn";
  tenant_id: string;
  session_id: string;
  state: string;
  intent: string;
  score_current: number;
  score_final: number | null;
  answers: Record<string, unknown>;
  user_text?: string;
  assistant_message: string;
  alert_event: string | null;
};

export type DemoAlertEvent = {
  at: string;
  kind: "alert";
  tenant_id: string;
  session_id: string;
  event: string;
  score_final: number | null;
  answers: Record<string, unknown>;
  channels: unknown;
  mode: string;
  delivered: boolean;
  title: string;
  body: string;
};

type DemoEvent = DemoTurnEvent | DemoAlertEvent;

const MAX = 80;
const events: DemoEvent[] = [];

export function recordDemoTurn(e: Omit<DemoTurnEvent, "at" | "kind">) {
  events.unshift({ ...e, at: new Date().toISOString(), kind: "turn" });
  if (events.length > MAX) events.length = MAX;
}

export function recordDemoAlert(e: Omit<DemoAlertEvent, "at" | "kind">) {
  events.unshift({ ...e, at: new Date().toISOString(), kind: "alert" });
  if (events.length > MAX) events.length = MAX;
}

export function listDemoOps(limit = 40): DemoEvent[] {
  return events.slice(0, Math.min(limit, MAX));
}

export function clearDemoOps() {
  events.length = 0;
}
