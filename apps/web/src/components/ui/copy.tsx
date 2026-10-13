"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function CopyButton({ value, label = "Copier", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // clipboard blocked: the user can still select the text
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sunken",
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {done ? "Copié" : label}
    </button>
  );
}

export function CodeBlock({ code, label = "HTML", className }: { code: string; label?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg bg-ink", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-paper/50">{label}</span>
        <CopyButton value={code} className="border-white/15 bg-white/10 text-paper hover:bg-white/20" />
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-6 text-[#e8e4da]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
