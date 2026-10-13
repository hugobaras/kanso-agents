"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatEur } from "@/lib/format";
import type { Plan } from "@/lib/types";

export function PlanCard({
  plan,
  interval,
  current,
  featured,
  action,
}: {
  plan: Plan;
  interval: "month" | "year";
  current?: boolean;
  featured?: boolean;
  action: React.ReactNode;
}) {
  const monthly = interval === "year" ? plan.yearlyPriceCents / 12 : plan.monthlyPriceCents;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface p-6",
        featured ? "border-ink shadow-pop" : "border-line shadow-card",
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-paper">
          Le plus choisi
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl">{plan.name}</h3>
        {current && <Badge tone="accent">Offre actuelle</Badge>}
      </div>
      <p className="mt-2 min-h-10 text-sm text-muted">{plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl">{formatEur(monthly)}</span>
        <span className="text-sm text-muted">HT / mois</span>
      </p>
      <p className="mt-1 h-5 text-xs text-muted">
        {interval === "year" ? `soit ${formatEur(plan.yearlyPriceCents)} HT par an — 2 mois offerts` : "sans engagement"}
      </p>
      <ul className="my-6 flex-1 space-y-2.5">
        {plan.highlights.map((h) => (
          <li key={h} className="flex gap-2.5 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            {h}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}

export function IntervalToggle({ value, onChange }: { value: "month" | "year"; onChange: (v: "month" | "year") => void }) {
  return (
    <div className="inline-flex rounded-full border border-line-strong bg-surface p-1 text-sm" role="radiogroup" aria-label="Période de facturation">
      {(
        [
          ["month", "Mensuel"],
          ["year", "Annuel · 2 mois offerts"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-full px-4 py-1.5 transition-colors", value === v ? "bg-ink text-paper" : "text-muted hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
