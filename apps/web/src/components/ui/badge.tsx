import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "ink";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-line",
  accent: "bg-accent-soft text-accent-strong border-[#c7e1dd]",
  success: "bg-success-soft text-success border-[#cbe3d0]",
  warning: "bg-warning-soft text-warning border-[#f0dcae]",
  danger: "bg-danger-soft text-danger border-[#f0c9c1]",
  info: "bg-info-soft text-info border-[#c9d9ea]",
  ink: "bg-ink text-paper border-ink",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const TIER_LABEL = { hot: "Prioritaire", warm: "À suivre", cold: "Faible" } as const;
export const TIER_TONE: Record<string, Tone> = { hot: "danger", warm: "warning", cold: "neutral" };

export function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge tone={TIER_TONE[tier] ?? "neutral"} dot>
      {TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}
    </Badge>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  contacted: "Contactée",
  qualified: "Qualifiée",
  won: "Devenue client",
  lost: "Sans suite",
  spam: "Indésirable",
};
const STATUS_TONE: Record<string, Tone> = {
  new: "info",
  contacted: "accent",
  qualified: "accent",
  won: "success",
  lost: "neutral",
  spam: "neutral",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}
