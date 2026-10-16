import { onColor, readableOnWhite } from "./color.js";
import type { Strings } from "./i18n.js";

export type UiOptions = {
  strings: Strings;
  color: string;
  name: string;
  logoUrl: string | null;
  position: "right" | "left";
  privacyUrl: string | null;
};

export type ChatUi = {
  open(): void;
  close(): void;
  isOpen(): boolean;
  addMessage(role: "user" | "assistant" | "system", text: string): void;
  clearMessages(): void;
  setTyping(on: boolean): void;
  setChips(options: Array<{ id: string; label: string }> | null): void;
  setComposer(enabled: boolean, placeholder?: string): void;
  showEnded(): void;
  onSubmit(cb: (text: string) => void): void;
  onOpen(cb: () => void): void;
  onRestart(cb: () => void): void;
  destroy(): void;
};

const ICON_CHAT =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICON_RESTART =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
const ICON_SEND =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';

function css(o: UiOptions): string {
  const fg = onColor(o.color);
  const accentText = readableOnWhite(o.color);
  const side = o.position === "left" ? "left" : "right";
  return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.root {
  --k-accent: ${o.color}; --k-on-accent: ${fg}; --k-accent-text: ${accentText};
  --k-ink: #1B2A4A; --k-muted: #5B6576; --k-line: #E7E2D8; --k-paper: #FAF8F4; --k-surface: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px; line-height: 1.45; color: var(--k-ink);
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; cursor: pointer; }
.launcher {
  position: fixed; bottom: 20px; ${side}: 20px; z-index: 2147483000;
  width: 58px; height: 58px; border-radius: 50%; border: 0;
  background: var(--k-accent); color: var(--k-on-accent);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 30px rgba(27,42,74,.22), 0 2px 6px rgba(27,42,74,.12);
  transition: transform .18s ease, box-shadow .18s ease;
}
.launcher:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(27,42,74,.26); }
.launcher:focus-visible, .icon-btn:focus-visible, .chip:focus-visible, .send:focus-visible, textarea:focus-visible, a:focus-visible {
  outline: 2px solid var(--k-accent-text); outline-offset: 2px;
}
.launcher[aria-expanded="true"] { transform: scale(.92); }
.panel {
  position: fixed; bottom: 92px; ${side}: 20px; z-index: 2147483001;
  width: 380px; max-width: calc(100vw - 32px); height: min(620px, calc(100vh - 120px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--k-surface); border: 1px solid var(--k-line); border-radius: 16px;
  box-shadow: 0 24px 60px rgba(27,42,74,.22), 0 4px 12px rgba(27,42,74,.08);
  opacity: 0; transform: translateY(12px) scale(.98); pointer-events: none; visibility: hidden;
  transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s;
}
.panel.open { opacity: 1; transform: none; pointer-events: auto; visibility: visible; transition: opacity .2s ease, transform .2s ease; }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 12px 14px 16px; background: var(--k-accent); color: var(--k-on-accent); }
.avatar { width: 34px; height: 34px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.18); font-weight: 600; font-size: 13px; overflow: hidden; }
.avatar img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.title { flex: 1; min-width: 0; }
.title strong { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title span { font-size: 12px; opacity: .82; }
.icon-btn { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: inherit;
  display: flex; align-items: center; justify-content: center; opacity: .85; }
.icon-btn:hover { background: rgba(255,255,255,.14); opacity: 1; }
.log { flex: 1; overflow-y: auto; padding: 16px 14px; background: var(--k-paper); display: flex; flex-direction: column; gap: 8px; scroll-behavior: smooth; }
.msg { max-width: 86%; padding: 9px 13px; border-radius: 16px; white-space: pre-line; word-wrap: break-word; font-size: 13.5px; }
.msg.assistant { align-self: flex-start; background: var(--k-surface); border: 1px solid var(--k-line); border-bottom-left-radius: 5px; }
.msg.user { align-self: flex-end; background: var(--k-accent); color: var(--k-on-accent); border-bottom-right-radius: 5px; }
.msg.system { align-self: center; max-width: 92%; background: transparent; color: var(--k-muted); font-size: 12px; text-align: center; padding: 4px 8px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.typing { align-self: flex-start; display: inline-flex; gap: 4px; padding: 12px 14px; background: var(--k-surface); border: 1px solid var(--k-line); border-radius: 16px; border-bottom-left-radius: 5px; }
.typing i { width: 6px; height: 6px; border-radius: 50%; background: #8A93A3; animation: k-bounce 1s infinite ease-in-out; }
.typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
@keyframes k-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-4px); opacity: 1; } }
.chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px 0; background: var(--k-surface); }
.chips:empty { display: none; }
.chip { border: 1px solid var(--k-accent-text); color: var(--k-accent-text); background: var(--k-surface); border-radius: 999px; padding: 6px 12px; font-size: 13px; }
.chip:hover { background: var(--k-paper); }
.composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; background: var(--k-surface); border-top: 1px solid var(--k-line); }
.chips:not(:empty) + .composer { border-top: 0; }
textarea { flex: 1; resize: none; min-height: 40px; max-height: 120px; padding: 10px 12px; border-radius: 12px; border: 1px solid #D6CFC1;
  font: inherit; font-size: 14px; color: var(--k-ink); background: var(--k-surface); }
textarea:focus { border-color: var(--k-accent-text); outline: none; }
textarea:disabled { background: var(--k-paper); color: var(--k-muted); }
.send { width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: var(--k-accent); color: var(--k-on-accent);
  display: flex; align-items: center; justify-content: center; }
.send:disabled { opacity: .45; cursor: default; }
.ended { padding: 12px; background: var(--k-surface); border-top: 1px solid var(--k-line); text-align: center; }
.ended button { border: 1px solid var(--k-line); background: var(--k-paper); color: var(--k-ink); border-radius: 10px; padding: 9px 14px; font-size: 13px; }
.foot { display: flex; justify-content: space-between; gap: 8px; padding: 7px 14px 9px; font-size: 11px; color: var(--k-muted); background: var(--k-surface); }
.foot a { color: var(--k-muted); text-decoration: underline; text-underline-offset: 2px; }
@media (max-width: 640px) {
  .panel { inset: 0; bottom: 0; ${side}: 0; width: 100vw; max-width: 100vw; height: 100dvh; border-radius: 0; border: 0; }
  .launcher[aria-expanded="true"] { display: none; }
  textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .launcher, .panel { transition: none; } .typing i { animation: none; } .log { scroll-behavior: auto; }
}
`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function mountChatUi(o: UiOptions): ChatUi {
  const s = o.strings;
  document.getElementById("kanso-widget-host")?.remove();
  const host = el("div", undefined, { id: "kanso-widget-host" });
  const shadow = host.attachShadow({ mode: "closed" });
  const style = el("style");
  style.textContent = css(o);
  const root = el("div", "root");

  const launcher = el("button", "launcher", { type: "button", "aria-label": s.open, "aria-expanded": "false", "aria-controls": "kanso-panel" });
  launcher.innerHTML = ICON_CHAT; // static SVG

  const panel = el("section", "panel", { id: "kanso-panel", role: "dialog", "aria-label": `${s.chatLabel} — ${o.name}` });
  const head = el("div", "head");
  const avatar = el("div", "avatar", { "aria-hidden": "true" });
  if (o.logoUrl && /^https:\/\//.test(o.logoUrl)) {
    const img = el("img", undefined, { alt: "", referrerpolicy: "no-referrer" });
    img.src = o.logoUrl;
    avatar.append(img);
  } else {
    avatar.textContent = o.name
      .split(/\s+/)
      .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "K";
  }
  const title = el("div", "title");
  const strong = el("strong");
  strong.textContent = o.name;
  const sub = el("span");
  sub.textContent = s.bot;
  title.append(strong, sub);
  const restartBtn = el("button", "icon-btn", { type: "button", "aria-label": s.restart, title: s.restart });
  restartBtn.innerHTML = ICON_RESTART;
  const closeBtn = el("button", "icon-btn", { type: "button", "aria-label": s.close, title: s.close });
  closeBtn.innerHTML = ICON_CLOSE;
  head.append(avatar, title, restartBtn, closeBtn);

  const log = el("div", "log", { role: "log", "aria-live": "polite", "aria-relevant": "additions", tabindex: "0" });
  const typing = el("div", "typing", { role: "status", "aria-label": s.typing });
  typing.innerHTML = "<i></i><i></i><i></i>";
  const chips = el("div", "chips", { role: "group" });
  const composer = el("form", "composer");
  const textarea = el("textarea", undefined, { rows: "1", "aria-label": s.placeholder, placeholder: s.placeholder, maxlength: "2000" });
  const send = el("button", "send", { type: "submit", "aria-label": s.send });
  send.innerHTML = ICON_SEND;
  composer.append(textarea, send);
  const ended = el("div", "ended");
  const endedBtn = el("button", undefined, { type: "button" });
  endedBtn.textContent = s.newConversation;
  ended.append(endedBtn);
  ended.hidden = true;

  const foot = el("div", "foot");
  const privacy = el("a", undefined, { target: "_blank", rel: "noopener noreferrer" });
  privacy.textContent = s.privacy;
  if (o.privacyUrl) privacy.href = o.privacyUrl;
  const powered = el("span");
  powered.textContent = s.poweredBy;
  foot.append(o.privacyUrl ? privacy : el("span"), powered);

  panel.append(head, log, chips, composer, ended, foot);
  root.append(launcher, panel);
  shadow.append(style, root);
  document.body.append(host);

  let submitCb: (t: string) => void = () => undefined;
  let openCb: () => void = () => undefined;
  let restartCb: () => void = () => undefined;
  let open = false;
  let typingShown = false;

  const isFullscreen = () => window.matchMedia("(max-width: 640px)").matches;

  function scroll() {
    log.scrollTop = log.scrollHeight;
  }

  function setOpen(next: boolean) {
    open = next;
    panel.classList.toggle("open", next);
    launcher.setAttribute("aria-expanded", String(next));
    launcher.setAttribute("aria-label", next ? s.close : s.open);
    if (next) {
      openCb();
      setTimeout(() => {
        if (!textarea.disabled) textarea.focus();
        else closeBtn.focus();
        scroll();
      }, 50);
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));
  restartBtn.addEventListener("click", () => restartCb());
  endedBtn.addEventListener("click", () => restartCb());

  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    // Full-screen on mobile behaves as a modal: keep focus inside.
    if (e.key === "Tab" && isFullscreen()) {
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), a[href], [tabindex='0']")).filter(
        (n) => n.offsetParent !== null,
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = shadow.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });

  function autosize() {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }
  textarea.addEventListener("input", () => {
    autosize();
    send.disabled = !textarea.value.trim() || textarea.disabled;
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });
  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = textarea.value.trim();
    if (!v || textarea.disabled) return;
    textarea.value = "";
    autosize();
    send.disabled = true;
    submitCb(v);
  });
  send.disabled = true;

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    addMessage(role, text) {
      const m = el("div", `msg ${role}`);
      if (role !== "system") {
        const who = el("span", "sr");
        who.textContent = `${role === "user" ? s.you : s.assistant} : `;
        m.append(who);
      }
      m.append(document.createTextNode(text)); // never innerHTML for content
      if (typingShown) log.insertBefore(m, typing);
      else log.append(m);
      scroll();
    },
    clearMessages() {
      log.replaceChildren();
      typingShown = false;
    },
    setTyping(on) {
      typingShown = on;
      if (on) log.append(typing);
      else typing.remove();
      scroll();
    },
    setChips(options) {
      chips.replaceChildren();
      for (const opt of options ?? []) {
        const b = el("button", "chip", { type: "button" });
        b.textContent = opt.label;
        b.addEventListener("click", () => {
          if (textarea.disabled) return;
          chips.replaceChildren();
          submitCb(opt.label);
        });
        chips.append(b);
      }
    },
    setComposer(enabled, placeholder) {
      textarea.disabled = !enabled;
      textarea.placeholder = placeholder ?? s.placeholder;
      send.disabled = !enabled || !textarea.value.trim();
      composer.hidden = false;
      ended.hidden = true;
    },
    showEnded() {
      chips.replaceChildren();
      composer.hidden = true;
      ended.hidden = false;
    },
    onSubmit(cb) {
      submitCb = cb;
    },
    onOpen(cb) {
      openCb = cb;
    },
    onRestart(cb) {
      restartCb = cb;
    },
    destroy() {
      host.remove();
    },
  };
}
