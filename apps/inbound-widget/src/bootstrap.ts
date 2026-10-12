import { parseScriptConfig } from "./config.js";
import { sendMessage, startSession, type ExpectedQuestion } from "./api.js";
import { mountChatUi } from "./ui.js";

function chipsFromExpected(eq: ExpectedQuestion | null | undefined) {
  if (!eq || eq.type !== "single_choice" || !eq.options?.length) return null;
  return eq.options;
}

export async function bootstrap(script: HTMLScriptElement | null = null) {
  const config = parseScriptConfig(
    script ??
      (document.currentScript as HTMLScriptElement | null) ??
      document.querySelector("script[data-kanso-widget],script[data-tenant]"),
  );
  const ui = mountChatUi(config);
  let sessionId: string | null = null;
  let closed = false;
  let starting: Promise<void> | null = null;

  async function ensureSession() {
    if (sessionId || closed) return;
    if (starting) return starting;
    starting = (async () => {
      ui.setBusy(true);
      try {
        const started = await startSession(config.apiBase, config.tenantId);
        sessionId = started.session_id;
        ui.appendMessage("system", "Vous parlez à une IA, pas à un humain.");
        if (started.after_hours) {
          ui.appendMessage(
            "system",
            "Hors horaires d'ouverture — un collaborateur vous recontactera aux heures ouvrées.",
          );
        }
        ui.appendMessage("assistant", started.assistant_message);
        ui.setChoices(chipsFromExpected(started.expected_question));
      } catch (err) {
        ui.appendMessage(
          "system",
          err instanceof Error ? err.message : "Impossible de démarrer la session",
        );
      } finally {
        ui.setBusy(false);
        starting = null;
      }
    })();
    return starting;
  }

  const openBubble = ui.root.querySelector(".kanso-bubble");
  openBubble?.addEventListener("click", () => {
    void ensureSession();
  });

  ui.onSubmit(async (text) => {
    if (closed) {
      ui.appendMessage(
        "system",
        "Conversation terminée. Rechargez la page pour recommencer.",
      );
      return;
    }
    await ensureSession();
    if (!sessionId) return;
    ui.appendMessage("user", text);
    ui.setChoices(null);
    ui.setBusy(true);
    try {
      const reply = await sendMessage(
        config.apiBase,
        config.tenantId,
        sessionId,
        text,
      );
      ui.appendMessage("assistant", reply.assistant_message);
      if (reply.state.startsWith("Closed")) {
        closed = true;
        ui.setChoices(null);
      } else {
        ui.setChoices(chipsFromExpected(reply.expected_question));
      }
    } catch (err) {
      ui.appendMessage(
        "system",
        err instanceof Error ? err.message : "Erreur d'envoi",
      );
    } finally {
      ui.setBusy(false);
    }
  });

  return { config, ui };
}

declare global {
  interface Window {
    KansoWidget?: { bootstrap: typeof bootstrap };
  }
}

window.KansoWidget = { bootstrap };

const auto = document.currentScript as HTMLScriptElement | null;
if (auto?.dataset.tenant) {
  void bootstrap(auto);
}
