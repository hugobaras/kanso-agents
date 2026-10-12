import type { WidgetConfig } from "./config.js";

export type ChoiceOption = { id: string; label: string };

export type ChatUi = {
  root: HTMLElement;
  open: () => void;
  close: () => void;
  setBusy: (busy: boolean) => void;
  setAfterHours: (blocked: boolean, bannerText?: string) => void;
  appendMessage: (role: "user" | "assistant" | "system", text: string) => void;
  setChoices: (options: ChoiceOption[] | null) => void;
  onSubmit: (handler: (text: string) => void) => void;
};

/** Aligné sur la DA portail admin (/portal) : tokens --radius / --radius-sm / pill. */
export function mountChatUi(config: WidgetConfig): ChatUi {
  const accent = config.primaryColor || "#1a2740";
  const style = document.createElement("style");
  style.textContent = `
    @import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&display=swap");
    .kanso-root {
      all: initial;
      --k-ink: #121820;
      --k-muted: #66707c;
      --k-bg: #f2f3f5;
      --k-card: #ffffff;
      --k-line: rgba(18, 24, 32, 0.09);
      --k-accent: ${accent};
      --k-accent-soft: #e8ebf0;
      --k-radius: 1.1rem;
      --k-radius-sm: 0.75rem;
      --k-radius-card: 0.9rem;
      --k-radius-pill: 999px;
      --k-shadow: 0 1px 2px rgba(18, 24, 32, 0.04), 0 12px 32px rgba(18, 24, 32, 0.06);
      font-family: "Sora", ui-sans-serif, system-ui, sans-serif;
      color: var(--k-ink);
    }
    .kanso-root *, .kanso-root *::before, .kanso-root *::after { box-sizing: border-box; }
    .kanso-bubble {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      width: 56px; height: 56px; border-radius: var(--k-radius-pill); border: none; cursor: pointer;
      background: var(--k-accent); color: #f5f6f8; font-size: 15px; font-weight: 600;
      letter-spacing: 0.02em;
      box-shadow: var(--k-shadow);
      transition: transform .12s ease, filter .15s ease;
    }
    .kanso-bubble:hover { filter: brightness(1.06); }
    .kanso-bubble:active { transform: scale(0.98); }
    .kanso-panel {
      position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
      width: min(380px, calc(100vw - 32px)); height: min(520px, calc(100vh - 120px));
      display: none; flex-direction: column; overflow: hidden;
      background: var(--k-card); color: var(--k-ink);
      border: 1px solid var(--k-line);
      border-radius: var(--k-radius);
      box-shadow: var(--k-shadow);
    }
    .kanso-panel.open { display: flex; }
    .kanso-header {
      padding: 1.05rem 1.15rem 1rem;
      background: var(--k-accent); color: #f5f6f8;
      font-size: 0.95rem; font-weight: 600; letter-spacing: -0.01em;
      border-radius: var(--k-radius) var(--k-radius) 0 0;
    }
    .kanso-ai-badge {
      display: inline-block; margin-top: 0.45rem;
      font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; opacity: .9;
      background: rgba(245, 246, 248, 0.14);
      border-radius: var(--k-radius-pill);
      padding: 0.28rem 0.65rem;
    }
    .kanso-after-hours {
      display: none; padding: 0.7rem 1.05rem; font-size: 0.75rem; line-height: 1.45;
      font-weight: 500; background: var(--k-ink); color: #f5f6f8;
    }
    .kanso-after-hours.visible { display: block; }
    .kanso-root.after-hours .kanso-form { opacity: .55; pointer-events: none; }
    .kanso-root.after-hours .kanso-choices { display: none !important; }
    .kanso-messages {
      flex: 1; overflow-y: auto; padding: 1rem 0.9rem;
      display: flex; flex-direction: column; gap: 0.7rem;
      font-size: 0.875rem; line-height: 1.45; background: var(--k-bg);
    }
    .kanso-msg {
      max-width: 92%; padding: 0.75rem 0.95rem;
      border-radius: var(--k-radius-card);
      white-space: pre-wrap;
    }
    .kanso-msg.assistant {
      align-self: flex-start; background: var(--k-card);
      border: 1px solid var(--k-line);
      border-bottom-left-radius: 0.35rem;
    }
    .kanso-msg.system {
      align-self: flex-start; font-size: 0.75rem; color: var(--k-muted);
      background: var(--k-accent-soft); border: none;
      border-radius: var(--k-radius-sm);
    }
    .kanso-msg.user {
      align-self: flex-end; background: var(--k-accent); color: #f5f6f8;
      border-bottom-right-radius: 0.35rem;
    }
    .kanso-choices {
      display: none; flex-wrap: wrap; gap: 0.45rem; padding: 0 0.9rem 0.75rem;
      background: var(--k-bg);
    }
    .kanso-choices.visible { display: flex; }
    .kanso-chip {
      border: 1px solid var(--k-line); background: var(--k-card); color: var(--k-ink);
      border-radius: var(--k-radius-pill);
      padding: 0.45rem 0.85rem; font: inherit; font-size: 0.78rem;
      font-weight: 500; cursor: pointer; text-align: left;
      transition: border-color .12s, color .12s, filter .15s, transform .12s;
    }
    .kanso-chip:hover { border-color: var(--k-accent); color: var(--k-accent); }
    .kanso-chip:active { transform: scale(0.98); }
    .kanso-chip:disabled { opacity: .5; cursor: not-allowed; }
    .kanso-form {
      display: flex; gap: 0.5rem; align-items: center;
      padding: 0.85rem 0.9rem;
      border-top: 1px solid var(--k-line); background: var(--k-card);
      border-radius: 0 0 var(--k-radius) var(--k-radius);
    }
    .kanso-input {
      flex: 1; border: 1px solid var(--k-line);
      border-radius: var(--k-radius-sm);
      padding: 0.7rem 0.9rem; font: inherit; font-size: 0.875rem; outline: none;
      background: var(--k-card); color: var(--k-ink);
      transition: border-color .15s, box-shadow .15s;
    }
    .kanso-input:focus {
      border-color: rgba(26, 39, 64, 0.4);
      box-shadow: 0 0 0 4px rgba(26, 39, 64, 0.1);
    }
    .kanso-send {
      border: none; background: var(--k-accent); color: #f5f6f8;
      padding: 0.7rem 1.15rem;
      border-radius: var(--k-radius-pill); cursor: pointer;
      font: inherit; font-size: 0.82rem; font-weight: 600;
      transition: filter .15s, transform .12s;
      white-space: nowrap;
    }
    .kanso-send:hover { filter: brightness(1.06); }
    .kanso-send:active { transform: scale(0.98); }
    .kanso-send:disabled { opacity: .5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "kanso-root";
  root.className = "kanso-root";
  root.setAttribute("data-kanso-widget", "1");

  const bubble = document.createElement("button");
  bubble.className = "kanso-bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Ouvrir l'assistant");
  bubble.textContent = "Ai";

  const panel = document.createElement("div");
  panel.className = "kanso-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", config.title);

  const header = document.createElement("div");
  header.className = "kanso-header";
  header.innerHTML = `${escapeHtml(config.title)}<span class="kanso-ai-badge">Assistant automatisé · pas un humain</span>`;

  const afterHoursBanner = document.createElement("div");
  afterHoursBanner.className = "kanso-after-hours";
  afterHoursBanner.setAttribute("role", "status");

  const messages = document.createElement("div");
  messages.className = "kanso-messages";

  const choices = document.createElement("div");
  choices.className = "kanso-choices";
  choices.setAttribute("aria-label", "Suggestions de réponse");

  const form = document.createElement("form");
  form.className = "kanso-form";
  const input = document.createElement("input");
  input.className = "kanso-input";
  input.type = "text";
  input.placeholder = "Votre message…";
  input.autocomplete = "off";
  const send = document.createElement("button");
  send.className = "kanso-send";
  send.type = "submit";
  send.textContent = "Envoyer";

  form.append(input, send);
  panel.append(header, afterHoursBanner, messages, choices, form);
  root.append(bubble, panel);
  document.body.appendChild(root);

  let submitHandler: ((text: string) => void) | null = null;
  let busy = false;
  let afterHours = false;

  bubble.addEventListener("click", () => {
    panel.classList.toggle("open");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy || afterHours) return;
    input.value = "";
    submitHandler?.(text);
  });

  function renderChoices(options: ChoiceOption[] | null) {
    choices.replaceChildren();
    if (!options?.length) {
      choices.classList.remove("visible");
      return;
    }
    choices.classList.add("visible");
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kanso-chip";
      btn.textContent = opt.label;
      btn.disabled = busy;
      btn.addEventListener("click", () => {
        if (busy) return;
        const label = opt.label?.trim();
        if (!label) return;
        submitHandler?.(label);
      });
      choices.appendChild(btn);
    }
  }

  return {
    root,
    open: () => panel.classList.add("open"),
    close: () => panel.classList.remove("open"),
    setBusy: (next) => {
      busy = next;
      send.disabled = next || afterHours;
      input.disabled = next || afterHours;
      choices.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = next || afterHours;
      });
    },
    setAfterHours: (blocked, bannerText) => {
      afterHours = blocked;
      root.classList.toggle("after-hours", blocked);
      afterHoursBanner.classList.toggle("visible", blocked);
      afterHoursBanner.textContent =
        bannerText ??
        "Hors horaires d'ouverture — conversation indisponible.";
      send.disabled = busy || blocked;
      input.disabled = busy || blocked;
      input.placeholder = blocked
        ? "Indisponible hors horaires…"
        : "Votre message…";
      if (blocked) renderChoices(null);
    },
    appendMessage: (role, text) => {
      const el = document.createElement("div");
      el.className = `kanso-msg ${role}`;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    },
    setChoices: renderChoices,
    onSubmit: (handler) => {
      submitHandler = handler;
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
