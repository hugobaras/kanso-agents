import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_480px]">
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <Logo site="assistant" href="/" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-in">{children}</div>
        </div>
        <p className="text-center text-xs text-subtle">
          Données hébergées dans l&apos;Union européenne ·{" "}
          <a className="underline-offset-2 hover:underline" href="/legal/confidentialite">
            Confidentialité
          </a>
        </p>
      </main>
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" aria-hidden />
        <div className="absolute -right-10 -top-10 size-52 rounded-full border border-white/10" aria-hidden />
        <div />
        <div>
          <p className="font-display text-[28px] leading-snug">
            Vos demandes entrantes arrivent triées, résumées et classées par priorité.
          </p>
          <p className="mt-4 text-sm text-paper/70">
            Rappelez d&apos;abord les bonnes personnes. Laissez l&apos;assistant recueillir le reste, même le soir.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-paper/80">
          {[
            "Hébergement et modèles d'IA dans l'Union européenne",
            "Aucun conseil donné à votre place : l'assistant qualifie, vous décidez",
            "Sans engagement, résiliable en un clic",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8fc9c2]" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
