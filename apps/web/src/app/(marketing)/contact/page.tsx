import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="font-display text-5xl">Parlons de votre cabinet.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Une démonstration personnalisée, une question sur l&apos;installation ou sur la protection des données : nous répondons sous
        un jour ouvré.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[
          { icon: Mail, title: "Commercial", text: "Démonstration, offre multi-cabinets, intégration sur mesure.", email: "bonjour@kanso.fr" },
          { icon: LifeBuoy, title: "Support", text: "Aide à l'installation et à la configuration.", email: "support@kanso.fr" },
          { icon: ShieldCheck, title: "Sécurité & RGPD", text: "Questionnaires sécurité, DPO, exercice des droits.", email: "securite@kanso.fr" },
        ].map((c) => (
          <a key={c.email} href={`mailto:${c.email}`} className="rounded-xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
            <c.icon className="size-5 text-accent" />
            <h2 className="mt-4 font-semibold">{c.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{c.text}</p>
            <p className="mt-4 text-sm font-medium text-accent">{c.email}</p>
          </a>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">Kanso Solutions — shbt studio SAS. Horaires du support : du lundi au vendredi, 9 h – 18 h (heure de Paris).</p>
    </section>
  );
}
