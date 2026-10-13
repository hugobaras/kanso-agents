import Link from "next/link";
import { cn } from "@/lib/cn";

/** Symbole Kanso (ensō au pinceau) — identique à public/brand/kanso-symbol.svg. */
export function LogoMark({ className, variant = "color" }: { className?: string; variant?: "color" | "light" }) {
  const light = variant === "light";
  return (
    <svg viewBox="0 0 96 96" className={cn("size-8 shrink-0", className)} aria-hidden>
      <path
        fill={light ? "#FAF8F4" : "#1B2A4A"}
        d="M38.79 11.14A38 38 0 1 0 57.21 11.14L55.49 18.05A24 24 0 1 1 41.4 21.57Z"
      />
      <circle cx="48" cy="28" r="7" fill={light ? "#3FA39D" : "#1F6F6B"} />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 text-ink", className)} aria-label="Kanso — accueil">
      <LogoMark />
      <span className="font-display text-[22px] font-semibold tracking-tight">Kanso</span>
    </Link>
  );
}
