import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M10 8v16M10 16l9-8M13.5 13l6.5 11"
        stroke="#FAF8F4"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-ink", className)} aria-label="Kanso — accueil">
      <LogoMark />
      <span className="font-display text-[21px] font-semibold tracking-tight">Kanso</span>
    </Link>
  );
}
