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

export function mountChatUi(config: WidgetConfig): ChatUi {
  const style = document.createElement("style");
  style.textContent = `
    .kanso-root { all: initial; font-family: Georgia, "Times New Roman", serif; }
    .kanso-root * { box-sizing: border-box; }
    .kanso-bubble {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
      background: ${config.primaryColor}; color: #fff; font-size: 22px;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
    }
    .kanso-panel {
      position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
      width: min(380px, calc(100vw - 32px)); height: min(520px, calc(100vh - 120px));
      display: none; flex-direction: column; overflow: hidden;
      background: #f7f4ef; color: #1a1a1a;
      border: 1px solid rgba(0,0,0,.08); border-radius: 4px;
      box-shadow: 0 16px 40px rgba(0,0,0,.16);
    }
    .kanso-panel.open { display: flex; }
    .kanso-header {
      padding: 14px 16px; background: ${config.primaryColor}; color: #fff;
      font-size: 15px; letter-spacing: .02em;
    }
    .kanso-ai-badge {
      display: block; margin-top: 4px; font-size: 11px; opacity: .85;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .kanso-after-hours {
      display: none; padding: 8px 12px; font-size: 12px; line-height: 1.4;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #1a2740; color: #f5f6f8;
    }
    .kanso-after-hours.visible { display: block; }
    .kanso-root.after-hours .kanso-form { opacity: .55; pointer-events: none; }
    .kanso-root.after-hours .kanso-choices { display: none !important; }
    .kanso-messages {
      flex: 1; overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 10px;
      font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.45;
    }
    .kanso-msg { max-width: 92%; padding: 10px 12px; border-radius: 2px; white-space: pre-wrap; }
    .kanso-msg.assistant, .kanso-msg.system { align-self: flex-start; background: #fff; border: 1px solid rgba(0,0,0,.06); }
    .kanso-msg.user { align-self: flex-end; background: ${config.primaryColor}; color: #fff; }
    .kanso-msg.system { font-size: 12px; color: #444; background: #efeae2; }
    .kanso-choices {
      display: none; flex-wrap: wrap; gap: 6px; padding: 0 10px 8px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .kanso-choices.visible { display: flex; }
    .kanso-chip {
      border: 1px solid rgba(0,0,0,.15); background: #fff; color: #1a1a1a;
      border-radius: 2px; padding: 8px 10px; font: inherit; font-size: 13px;
      cursor: pointer; text-align: left;
    }
    .kanso-chip:hover { border-color: ${config.primaryColor}; color: ${config.primaryColor}; }
    .kanso-chip:disabled { opacity: .5; cursor: not-allowed; }
    .kanso-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(0,0,0,.08); background: #fff; }
    .kanso-input {
      flex: 1; border: 1px solid rgba(0,0,0,.15); border-radius: 2px; padding: 10px;
      font: inherit; outline: none;
    }
    .kanso-send {
      border: none; background: ${config.primaryColor}; color: #fff; padding: 0 14px;
      border-radius: 2px; cursor: pointer; font: inherit;
    }
    .kanso-send:disabled { opacity: .5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
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
        // Send label (natural) — backend maps to option id
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
