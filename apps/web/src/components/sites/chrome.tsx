"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { PRODUCT_BLURB, PRODUCT_ORDER, SITES, siteHref, type SiteId } from "@/lib/sites";

export type NavLink = { href: string; label: string };

export function SiteHeader({
  site,
  links,
  cta,
  login,
}: {
  site: SiteId;
  links: NavLink[];
  cta: NavLink;
  login?: NavLink;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Logo site={site} href={siteHref(site)} />
        <nav className="hidden flex-1 items-center gap-6 text-sm text-muted lg:flex" aria-label="Navigation">
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {login && (
            <Link href={login.href} className="px-3 text-sm text-muted hover:text-ink">
              {login.label}
            </Link>
          )}
          <ButtonLink href={cta.href} size="sm" variant="accent">
            {cta.label}
          </ButtonLink>
        </div>
        <button className="ml-auto rounded p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-5 py-4 lg:hidden" aria-label="Navigation mobile">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded px-2 py-2 text-sm hover:bg-sunken">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {login && (
              <ButtonLink href={login.href} variant="secondary" className="flex-1">
                {login.label}
              </ButtonLink>
            )}
            <ButtonLink href={cta.href} variant="accent" className="flex-1">
              {cta.label}
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({ site, legal }: { site: SiteId; legal?: NavLink[] }) {
  const def = SITES[site];
  const legalLinks: NavLink[] = legal ?? [
    { href: siteHref("solutions", "/mentions-legales"), label: "Mentions légales" },
    { href: siteHref("solutions", "/confidentialite"), label: "Confidentialité" },
  ];
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo site={site} href={siteHref(site)} />
          <p className="mt-4 max-w-xs text-sm text-muted">{def.tagline}</p>
          {site !== "solutions" && (
            <p className="mt-4 text-xs text-subtle">
              Un produit{" "}
              <Link href={siteHref("solutions")} className="underline underline-offset-2 hover:text-ink">
                Kanso Solutions
              </Link>
            </p>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold">Les produits Kanso</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {PRODUCT_ORDER.map((p) => (
              <li key={p}>
                <Link href={siteHref(p)} className="hover:text-ink">
                  {SITES[p].name}
                </Link>
                <span className="ml-2 text-xs text-subtle">{PRODUCT_BLURB[p as "assistant" | "site" | "portail"].status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Informations</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href={siteHref("solutions", "/contact")} className="hover:text-ink">
                Contact
              </Link>
            </li>
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-subtle">
          © {new Date().getFullYear()} Kanso Solutions — shbt studio SAS. Hébergement dans l&apos;Union européenne. Les produits Kanso ne
          fournissent aucun conseil juridique, comptable ou fiscal.
        </p>
      </div>
    </footer>
  );
}
