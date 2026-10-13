import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PublicForm } from "@/components/sites/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h1 className="font-display text-5xl leading-tight">Parlons de votre cabinet.</h1>
        <p className="mt-4 text-lg leading-8 text-muted">
          Une question sur un produit, une démonstration, un besoin particulier : écrivez-nous, nous répondons sous deux jours ouvrés.
        </p>
        <ul className="mt-10 space-y-6">
          {[
            { icon: Mail, title: "Commercial", text: "Produits, démonstration, offre pour plusieurs cabinets.", email: "bonjour@kanso.fr" },
            { icon: LifeBuoy, title: "Support", text: "Aide à l'installation et à la configuration de Kanso Assistant.", email: "support@kanso.fr" },
            { icon: ShieldCheck, title: "Sécurité et données personnelles", text: "Questionnaires sécurité, DPO, exercice de vos droits.", email: "securite@kanso.fr" },
          ].map((c) => (
            <li key={c.email} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-muted">{c.text}</p>
                <a href={`mailto:${c.email}`} className="text-sm font-medium text-accent hover:underline">
                  {c.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-subtle">Kanso Solutions — shbt studio SAS. Du lundi au vendredi, 9 h – 18 h (heure de Paris).</p>
      </div>
      <PublicForm
        source="solutions"
        mode="contact"
        submitLabel="Envoyer mon message"
        successTitle="Message envoyé"
        successText="Merci ! Vous allez recevoir un accusé de réception, et nous vous répondons sous deux jours ouvrés."
      />
    </section>
  );
}
