export type SessionStart = {
  session_id: string;
  state: string;
  assistant_message: string;
  after_hours?: boolean;
};

export type MessageReply = {
  session_id: string;
  state: string;
  assistant_message: string;
  score_final: number | null;
  alert_event: string | null;
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
  if (!res.ok) {
    throw new Error(`message failed: ${res.status}`);
  }
  return (await res.json()) as MessageReply;
}
