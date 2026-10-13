import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { PublicForm } from "@/components/sites/contact-form";

export const metadata: Metadata = { title: "Demander un devis" };

export default function QuotePage() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <h1 className="font-display text-5xl leading-tight">Demandez votre devis.</h1>
        <p className="mt-4 text-lg leading-8 text-muted">
          Quelques informations suffisent pour préparer notre échange. Le devis est gratuit et sans engagement.
        </p>
        <ol className="mt-10 space-y-6">
          {[
            ["Vous nous écrivez", "Votre projet en quelques lignes : création ou refonte, échéance, ce que vous attendez."],
            ["Nous vous rappelons", "Sous deux jours ouvrés, pour comprendre votre cabinet et cadrer le projet."],
            ["Vous recevez un devis", "Il détaille le périmètre, le délai et le prix. Vous décidez ensuite, sans pression."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <ul className="mt-10 space-y-2 text-sm text-muted">
          {["Aucun paiement à ce stade", "Vos données ne servent qu'à répondre à votre demande", "Hébergement dans l'Union européenne"].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <PublicForm
        source="site"
        mode="devis"
        submitLabel="Envoyer ma demande de devis"
        successTitle="Demande envoyée"
        successText="Merci ! Vous recevez un accusé de réception par e-mail. Nous vous recontactons sous deux jours ouvrés."
      />
    </section>
  );
}
