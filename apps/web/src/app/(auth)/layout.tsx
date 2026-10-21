import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { Logo } from "@/components/logo";
import { ProductProvider, type AuthProduct } from "@/lib/product";
import { siteHref, themeStyle } from "@/lib/sites";

const ASIDE = {
  assistant: {
    title: "Vos demandes entrantes arrivent triées, résumées et classées par priorité.",
    text: "Rappelez d'abord les bonnes personnes. Laissez l'assistant recueillir le reste, même le soir.",
    points: [
      "Hébergement et modèles d'IA dans l'Union européenne",
      "Aucun conseil donné à votre place : l'assistant qualifie, vous décidez",
      "Sans engagement, résiliable en un clic",
    ],
  },
  portail: {
    title: "Vos clients déposent leurs pièces, vous suivez chaque dossier au même endroit.",
    text: "Un lien sécurisé par dossier, des relances automatiques, des pièces chiffrées.",
    points: [
      "Pièces chiffrées, analysées par antivirus, hébergées dans l'Union européenne",
      "Aucun compte à créer pour vos clients",
      "Sans engagement, résiliable en un clic",
    ],
  },
} as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const product: AuthProduct = (await headers()).get("x-kanso-product") === "portail" ? "portail" : "assistant";
  const aside = ASIDE[product];
  return (
    <ProductProvider value={product}>
    <div className="grid min-h-dvh lg:grid-cols-[1fr_480px]" style={themeStyle(product)}>
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <Logo site={product} href={siteHref(product)} />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-in">{children}</div>
        </div>
        <p className="text-center text-xs text-subtle">
          Données hébergées dans l&apos;Union européenne ·{" "}
          <a className="underline-offset-2 hover:underline" href={product === "portail" ? siteHref("portail", "/legal/confidentialite-portail") : siteHref("assistant", "/legal/confidentialite")}>
            Confidentialité
          </a>
        </p>
      </main>
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" aria-hidden />
        <div className="absolute -right-10 -top-10 size-52 rounded-full border border-white/10" aria-hidden />
        <div />
        <div>
          <p className="font-display text-[28px] leading-snug">{aside.title}</p>
          <p className="mt-4 text-sm text-paper/70">{aside.text}</p>
        </div>
        <ul className="space-y-3 text-sm text-paper/80">
          {aside.points.map((t) => (
            <li key={t} className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8fc9c2]" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
    </ProductProvider>
  );
}
