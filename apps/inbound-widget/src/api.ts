export type ExpectedQuestion = {
  id: string;
  prompt: string;
  type: string;
  options: Array<{ id: string; label: string }> | null;
};

export type SessionStart = {
  session_id: string;
  state: string;
  assistant_message: string;
  after_hours?: boolean;
  expected_question?: ExpectedQuestion | null;
};

export type MessageReply = {
  session_id: string;
  state: string;
  assistant_message: string;
  score_current?: number;
  score_final: number | null;
  score_band?: string;
  score_thresholds?: { hot: number; warm: number; cold: number };
  answers?: Record<string, unknown>;
  intent?: string;
  alert_event: string | null;
  alert?: unknown;
  integrations?: unknown;
  expected_question?: ExpectedQuestion | null;
  tenant_display_name?: string;
};

export async function startSession(
  apiBase: string,
  tenantId: string,
): Promise<SessionStart> {
  const res = await fetch(`${apiBase}/v1/${tenantId}/sessions`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`session start failed: ${res.status}`);
  }
  return (await res.json()) as SessionStart;
}

export async function sendMessage(
  apiBase: string,
  tenantId: string,
  sessionId: string,
  text: string,
): Promise<MessageReply> {
  const res = await fetch(
    `${apiBase}/v1/${tenantId}/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as MessageReply & {
    error?: string;
    after_hours?: boolean;
  };
  if (!res.ok) {
    if (res.status === 403 && data.after_hours) {
      const err = new Error(
        data.assistant_message ?? "Hors horaires d'ouverture",
      ) as Error & { afterHours: boolean; body: typeof data };
      err.afterHours = true;
      err.body = data;
      throw err;
    }
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `message failed: ${res.status}`,
    );
  }
  return data as MessageReply;
}
