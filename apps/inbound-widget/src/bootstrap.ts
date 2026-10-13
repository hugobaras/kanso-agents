import { WidgetApi, WidgetApiError, type ExpectedQuestion, type PublicConfig } from "./api.js";
import { normaliseHex } from "./color.js";
import { parseScriptConfig, type WidgetConfig } from "./config.js";
import { pickLocale, t } from "./i18n.js";
import { mountChatUi, type ChatUi } from "./ui.js";

const CHOICE_TYPES = new Set(["single_choice", "multi_choice", "boolean"]);

function chips(eq: ExpectedQuestion | null | undefined, yesNo: [string, string]) {
  if (!eq || !CHOICE_TYPES.has(eq.type)) return null;
  if (eq.type === "boolean") return [{ id: "yes", label: yesNo[0] }, { id: "no", label: yesNo[1] }];
  return eq.options?.length ? eq.options : null;
}

function storageKey(cfg: WidgetConfig): string {
  return `kanso:${cfg.key ?? cfg.tenantId}:session`;
}

function store(cfg: WidgetConfig, sessionId: string | null) {
  try {
    if (sessionId) sessionStorage.setItem(storageKey(cfg), sessionId);
    else sessionStorage.removeItem(storageKey(cfg));
  } catch {
    // storage blocked (private mode, third-party restrictions)
  }
}

function stored(cfg: WidgetConfig): string | null {
  try {
    return sessionStorage.getItem(storageKey(cfg));
  } catch {
    return null;
  }
}

function emit(name: string, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export async function bootstrap(script: HTMLScriptElement | null = null): Promise<ChatUi | null> {
  const cfg = parseScriptConfig(
    script ??
      (document.currentScript as HTMLScriptElement | null) ??
      document.querySelector<HTMLScriptElement>("script[data-key],script[data-tenant]"),
  );
  const api = new WidgetApi(cfg);

  let pub: PublicConfig;
  try {
    pub = await api.config();
  } catch (err) {
    console.warn("[Kanso] widget disabled:", err instanceof WidgetApiError ? err.code : err);
    return null;
  }
  // Unpublished / inactive workspace: render nothing on the host site.
  if (!pub.available) {
    console.info("[Kanso] assistant unavailable for this site");
    return null;
  }

  const locale = pickLocale(pub.locale);
  const s = t(locale);
  const yesNo: [string, string] = locale === "en" ? ["Yes", "No"] : ["Oui", "Non"];
  const ui = mountChatUi({
    strings: s,
    color: normaliseHex(pub.primary_color ?? cfg.primaryColor),
    name: pub.display_name ?? cfg.title ?? s.assistant,
    logoUrl: pub.logo_url ?? null,
    position: cfg.position,
    privacyUrl: pub.privacy_url ?? null,
  });
  api.ping();

  let sessionId: string | null = null;
  let closed = false;
  let busy = false;
  let started = false;

  function setBusy(on: boolean) {
    busy = on;
    ui.setTyping(on);
    if (!closed) ui.setComposer(!on);
  }

  function handleError(err: unknown) {
    if (err instanceof WidgetApiError) {
      if (err.assistantMessage) ui.addMessage("assistant", err.assistantMessage);
      else ui.addMessage("system", err.status === 0 ? s.network : s.error);
      if (err.code === "after_hours" || err.code === "quota_exceeded" || err.code === "unavailable") {
        closed = true;
        ui.showEnded();
      }
      if (err.status === 404 && err.code === "session_not_found") {
        // Expired session: next message starts a fresh one.
        sessionId = null;
        store(cfg, null);
        started = false;
      }
    } else {
      ui.addMessage("system", s.error);
    }
  }

  async function start() {
    if (started) return;
    started = true;
    closed = false;
    ui.clearMessages();
    if (pub.blocked_now && pub.after_hours_message) {
      ui.addMessage("assistant", pub.after_hours_message);
      closed = true;
      ui.showEnded();
      return;
    }
    // Resume the conversation of this tab if any.
    const previous = stored(cfg);
    if (previous) {
      try {
        const tr = await api.resume(previous);
        sessionId = tr.session_id;
        for (const m of tr.messages) ui.addMessage(m.role, m.content);
        ui.setChips(chips(tr.expected_question, yesNo));
        ui.setComposer(true);
        emit("kanso:session", { sessionId, resumed: true });
        return;
      } catch {
        store(cfg, null);
      }
    }
    setBusy(true);
    try {
      const r = await api.start();
      sessionId = r.session_id;
      store(cfg, sessionId);
      emit("kanso:session", { sessionId, resumed: false });
      setBusy(false);
      ui.addMessage("assistant", r.assistant_message);
      if (r.after_hours || r.state.startsWith("Closed")) {
        closed = true;
        ui.showEnded();
      } else {
        ui.setChips(chips(r.expected_question, yesNo));
      }
    } catch (err) {
      setBusy(false);
      started = false;
      handleError(err);
    }
  }

  ui.onOpen(() => void start());

  ui.onRestart(() => {
    store(cfg, null);
    sessionId = null;
    started = false;
    void start();
  });

  ui.onSubmit(async (text) => {
    if (busy || closed) return;
    if (!sessionId) {
      await start();
      if (!sessionId || closed) return;
    }
    ui.addMessage("user", text);
    ui.setChips(null);
    setBusy(true);
    try {
      const r = await api.send(sessionId, text);
      setBusy(false);
      ui.addMessage("assistant", r.assistant_message);
      emit("kanso:turn", { sessionId, state: r.state, closed: !!r.closed });
      if (r.closed || r.state.startsWith("Closed")) {
        closed = true;
        store(cfg, null);
        ui.showEnded();
      } else {
        ui.setChips(chips(r.expected_question, yesNo));
      }
    } catch (err) {
      setBusy(false);
      handleError(err);
    }
  });

  window.addEventListener("kanso:open", () => ui.open());
  if (cfg.open) ui.open();
  return ui;
}

declare global {
  interface Window {
    KansoWidget?: { bootstrap: typeof bootstrap; open: () => void };
  }
}

window.KansoWidget = {
  bootstrap,
  open: () => window.dispatchEvent(new CustomEvent("kanso:open")),
};

const auto = document.currentScript as HTMLScriptElement | null;
if (auto && (auto.dataset.key || auto.dataset.tenant)) {
  const run = () => void bootstrap(auto);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}
