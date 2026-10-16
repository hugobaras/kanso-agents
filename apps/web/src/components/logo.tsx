import Link from "next/link";
import { cn } from "@/lib/cn";
import { SITES, type SiteId } from "@/lib/sites";

/** Symbole Kanso (ensō au pinceau) — identique à public/brand/kanso-symbol.svg. Le point prend la couleur du produit. */
export function LogoMark({
  className,
  variant = "color",
  site = "solutions",
}: {
  className?: string;
  variant?: "color" | "light";
  site?: SiteId;
}) {
  const light = variant === "light";
  const dot = light ? "#3FA39D" : SITES[site].accent.base;
  return (
    <svg viewBox="0 0 256 256" className={cn("size-8 shrink-0", className)} aria-hidden>
      <path
        fill={light ? "#FAF8F4" : "#1B2A4A"}
        d="M208.26 55.73A108 108 0 1 1 112.97 21.05L116.37 45.23A74 74 0 1 0 194.46 68.16Z"
      />
      <circle cx="159.5" cy="41.5" r="15" fill={dot} />
    </svg>
  );
}

/** Logo « Kanso » + nom du produit en petites capitales. */
export function Logo({
  href = "/",
  className,
  site = "assistant",
  light,
}: {
  href?: string;
  className?: string;
  site?: SiteId;
  light?: boolean;
}) {
  const def = SITES[site];
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", light ? "text-paper" : "text-ink", className)}
      aria-label={`${def.name} — accueil`}
    >
      <LogoMark site={site} variant={light ? "light" : "color"} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[22px] font-semibold tracking-tight">Kanso</span>
        <span
          className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: light ? "#8FC9C2" : def.accent.base }}
        >
          {def.label}
        </span>
      </span>
    </Link>
  );
}
