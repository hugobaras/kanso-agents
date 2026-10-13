"use client";

import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string };

type ToastApi = {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
      >
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-pop"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4.5 shrink-0",
                  t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-ink" aria-label="Fermer">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
