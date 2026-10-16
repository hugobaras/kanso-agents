"use client";

import { Bot, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/badge";
import { api, errorMessage, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { onColor } from "@/lib/color";
import type { InboundConfig } from "@/lib/types";

type PreviewSession = { state: string; answers: Record<string, unknown>; scoreCurrent: number; scoreFinal: number | null; messages: string[] };
type Expected = { id: string; type: string; options: Array<{ id: string; label: string }> | null } | null;
type Msg = { role: "user" | "assistant"; text: string };

/**
 * Simulates the widget against the real engine with the unsaved draft
 * (stateless /assistant/preview endpoint, nothing is stored or counted).
 */
export function ChatPreview({ ws, config }: { ws: string; config: InboundConfig }) {
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [expected, setExpected] = useState<Expected>(null);
  const [result, setResult] = useState<{ score: number; tier: string; alert: string | null } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<{ session: PreviewSession; assistant_message: string; expected_question: Expected }>(
        wsPath(ws, "/assistant/preview"),
        { body: { config: configRef.current } },
      );
      setSession(r.session);
      setMessages([{ role: "assistant", text: r.assistant_message }]);
      setExpected(r.expected_question);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [ws]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(value: string) {
    if (!session || !value.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: value }]);
    setText("");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{
        session: PreviewSession;
        assistant_message: string;
        expected_question: Expected;
        closed: boolean;
        alert_event: string | null;
        score: number;
        tier: string;
      }>(wsPath(ws, "/assistant/preview"), { body: { config: configRef.current, session, text: value } });
      setSession(r.session);
      setMessages((m) => [...m, { role: "assistant", text: r.assistant_message }]);
      setExpected(r.closed ? null : r.expected_question);
      if (r.closed || r.alert_event) setResult({ score: r.score, tier: r.tier, alert: r.alert_event });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const color = /^#[0-9a-f]{6}$/i.test(config.identity.branding.primary_color) ? config.identity.branding.primary_color : "#1b2a4a";
  const fg = onColor(color);
  const closed = session?.state.startsWith("Closed");

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: color, color: fg }}>
        {config.identity.branding.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.identity.branding.logo_url} alt="" className="size-8 rounded-full bg-white object-contain p-0.5" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
            <Bot className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{config.identity.display_name || "Votre cabinet"}</p>
          <p className="text-[11px] opacity-80">Assistant automatisé</p>
        </div>
        <button onClick={start} className="rounded p-1.5 opacity-80 hover:bg-white/10 hover:opacity-100" aria-label="Recommencer">
          <RotateCcw className="size-4" />
        </button>
      </div>
      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto bg-paper/60 px-3 py-4" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[13px] leading-5",
              m.role === "user" ? "ml-auto rounded-br-md" : "rounded-bl-md border border-line bg-surface text-ink",
            )}
            style={m.role === "user" ? { background: color, color: fg } : undefined}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="flex w-14 gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3" aria-label="L'assistant écrit">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {result && (
          <div className="mx-auto mt-3 w-full rounded-lg border border-dashed border-line-strong bg-surface p-3 text-center text-xs text-muted">
            <p className="mb-1.5 font-medium text-ink">Ce que reçoit le cabinet</p>
            <div className="flex items-center justify-center gap-2">
              <TierBadge tier={result.tier} /> <span>score {result.score}/100</span>
            </div>
          </div>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
      </div>
      {!closed && expected?.options && expected.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 pt-2.5">
          {expected.options.map((o) => (
            <button
              key={o.id}
              disabled={busy}
              onClick={() => send(o.label)}
              className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-sunken disabled:opacity-50"
              style={{ borderColor: color, color }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2 px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || closed}
          placeholder={closed ? "Conversation terminée" : "Votre message…"}
          className="h-9 flex-1 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] focus:border-accent focus:outline-none"
          aria-label="Message"
        />
        <Button type="submit" size="sm" className="size-9 rounded-full! px-0" disabled={busy || closed || !text.trim()} aria-label="Envoyer">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="border-t border-line bg-paper px-3 py-1.5 text-center text-[10px] text-subtle">
        Aperçu du brouillon — rien n&apos;est enregistré ni décompté
      </p>
    </div>
  );
}
