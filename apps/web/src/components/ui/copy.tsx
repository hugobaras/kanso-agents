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
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
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

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <div className={cn("relative rounded-lg bg-ink", className)}>
      <pre className="overflow-x-auto px-4 py-4 pr-24 font-mono text-[12.5px] leading-6 text-[#e8e4da]">
        <code>{code}</code>
      </pre>
      <CopyButton value={code} className="absolute right-3 top-3 border-white/15 bg-white/10 text-paper hover:bg-white/20" />
    </div>
  );
}
