"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

const LINKS = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/cas-usage/avocats", label: "Avocats" },
  { href: "/cas-usage/experts-comptables", label: "Experts-comptables" },
  { href: "/cas-usage/notaires", label: "Notaires" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/securite", label: "Sécurité" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Logo />
        <nav className="hidden flex-1 items-center gap-6 text-sm text-muted lg:flex" aria-label="Navigation">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link href="/connexion" className="px-3 text-sm text-muted hover:text-ink">
            Connexion
          </Link>
          <ButtonLink href="/inscription" size="sm">
            Essai gratuit
          </ButtonLink>
        </div>
        <button className="ml-auto rounded p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-5 py-4 lg:hidden">
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded px-2 py-2 text-sm hover:bg-sunken">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <ButtonLink href="/connexion" variant="secondary" className="flex-1">
              Connexion
            </ButtonLink>
            <ButtonLink href="/inscription" className="flex-1">
              Essai gratuit
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-3 text-sm text-muted">L&apos;assistant d&apos;accueil et de traitement documentaire des professions libérales.</p>
          <p className="mt-4 text-xs text-subtle">Hébergé dans l&apos;Union européenne · IA Mistral (France)</p>
        </div>
        {[
          {
            title: "Produit",
            links: [
              ["/#fonctionnement", "Fonctionnement"],
              ["/tarifs", "Tarifs"],
              ["/demo", "Démonstration"],
              ["/securite", "Sécurité & RGPD"],
            ],
          },
          {
            title: "Métiers",
            links: [
              ["/cas-usage/avocats", "Avocats"],
              ["/cas-usage/experts-comptables", "Experts-comptables"],
              ["/cas-usage/notaires", "Notaires"],
              ["/contact", "Contact"],
            ],
          },
          {
            title: "Légal",
            links: [
              ["/legal/mentions-legales", "Mentions légales"],
              ["/legal/cgu", "Conditions d'utilisation"],
              ["/legal/cgv", "Conditions de vente"],
              ["/legal/confidentialite", "Confidentialité"],
              ["/legal/dpa", "Accord de traitement (DPA)"],
              ["/legal/sous-traitants", "Sous-traitants"],
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href!} className="hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-subtle">
          © {new Date().getFullYear()} Kanso Solutions — shbt studio SAS. Kanso est un outil d&apos;aide : il ne fournit aucun conseil
          juridique, comptable ou fiscal.
        </p>
      </div>
    </footer>
  );
}
