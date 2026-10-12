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
  integrations?: unknown;
};

export type DemoDocumentEvent = {
  at: string;
  kind: "document";
  tenant_id: string;
  job_id: string;
  status: string;
  step: string;
  filename?: string;
  document_type?: string | null;
  remote_id?: string | null;
  last_error?: string | null;
};

type DemoEvent = DemoTurnEvent | DemoAlertEvent | DemoDocumentEvent;

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

export function recordDemoDocument(e: Omit<DemoDocumentEvent, "at" | "kind">) {
  events.unshift({ ...e, at: new Date().toISOString(), kind: "document" });
  if (events.length > MAX) events.length = MAX;
}

export function patchDemoDocument(
  jobId: string,
  patch: Partial<Omit<DemoDocumentEvent, "at" | "kind" | "job_id" | "tenant_id">>,
) {
  const idx = events.findIndex(
    (e) => e.kind === "document" && e.job_id === jobId,
  );
  if (idx >= 0 && events[idx]?.kind === "document") {
    events[idx] = { ...events[idx], ...patch };
  }
}

export function patchLatestAlert(
  sessionId: string,
  patch: Partial<Pick<DemoAlertEvent, "integrations" | "delivered" | "mode">>,
) {
  const idx = events.findIndex(
    (e) => e.kind === "alert" && e.session_id === sessionId,
  );
  if (idx >= 0 && events[idx]?.kind === "alert") {
    events[idx] = { ...events[idx], ...patch };
  }
}

export function listDemoOps(limit = 40): DemoEvent[] {
  return events.slice(0, Math.min(limit, MAX));
}

export function clearDemoOps() {
  events.length = 0;
}
