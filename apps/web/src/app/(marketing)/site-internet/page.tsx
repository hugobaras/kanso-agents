import { CheckCircle2, FileCheck2, Gauge, MessagesSquare, PenLine, Rocket, Search } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Création de site internet pour cabinets",
  description:
    "Kanso Solutions conçoit le site de votre cabinet d'avocats, d'expertise comptable ou de votre office notarial, avec l'assistant Kanso intégré. Sur devis.",
};

const MAILTO = `mailto:bonjour@kanso.fr?subject=${encodeURIComponent("Demande de devis — site internet")}&body=${encodeURIComponent(
  "Bonjour,\n\nNom du cabinet :\nProfession :\nSite actuel (le cas échéant) :\nÉchéance souhaitée :\nTéléphone :\n\nMon besoin :\n",
)}`;

export default function WebsitePage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-14 pt-16">
        <p className="text-sm font-medium text-accent">Kanso Solutions · Création et refonte de sites</p>
        <h1 className="mt-2 font-display text-[44px] leading-tight">Un site à la hauteur de votre cabinet, prêt à accueillir vos clients.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
          Vous n&apos;avez pas encore de site, ou le vôtre ne reflète plus votre pratique ? Nous le concevons pour vous : sobre,
          rapide, conforme aux règles de communication de votre profession — avec l&apos;assistant Kanso déjà installé.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/inscription" size="lg">
            Créer mon espace et demander un devis
          </ButtonLink>
          <a href={MAILTO} className="inline-flex h-12 items-center justify-center rounded-lg border border-line-strong bg-surface px-6 text-[15px] font-medium hover:bg-sunken">
            Écrire à l&apos;équipe
          </a>
        </div>
        <p className="mt-4 text-sm text-subtle">Devis gratuit et sans engagement · Prestation indépendante de l&apos;abonnement</p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: PenLine, title: "Textes adaptés", text: "Présentation de vos domaines d'intervention, honoraires et rendez-vous, rédigés dans le respect de votre déontologie." },
            { icon: MessagesSquare, title: "Assistant intégré", text: "Kanso est installé et vérifié dès la mise en ligne : vos demandes arrivent qualifiées dès le premier jour." },
            { icon: FileCheck2, title: "Conformité incluse", text: "Mentions légales, politique de confidentialité, information sur l'assistant automatisé, aucun traceur publicitaire." },
            { icon: Gauge, title: "Rapide et accessible", text: "Pages légères, lisibles sur mobile, pensées pour l'accessibilité et le référencement local." },
          ].map((b) => (
            <div key={b.title}>
              <b.icon className="size-5 text-accent" />
              <h2 className="mt-4 font-semibold">{b.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="font-display text-3xl">Comment ça se passe</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-4">
          {[
            { icon: Search, title: "1. Échange", text: "Un appel pour comprendre votre cabinet, vos clients et vos priorités." },
            { icon: FileCheck2, title: "2. Devis", text: "Une proposition claire : pages, contenus, délai et prix. Vous décidez." },
            { icon: PenLine, title: "3. Réalisation", text: "Maquette, rédaction, validation avec vous à chaque étape." },
            { icon: Rocket, title: "4. Mise en ligne", text: "Publication, assistant activé, et vous restez propriétaire de votre site." },
          ].map((s) => (
            <li key={s.title}>
              <div className="flex size-10 items-center justify-center rounded-lg bg-ink text-paper">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-4xl rounded-2xl bg-ink p-10 text-paper">
          <h2 className="font-display text-3xl">Déjà client Kanso ?</h2>
          <p className="mt-3 text-paper/75">
            Demandez votre devis en un clic depuis votre espace, page Installation. Votre assistant reste utilisable en attendant :
            il sera branché sur le nouveau site dès sa mise en ligne.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-paper/85">
            {["Sans engagement : le devis est gratuit", "Prestation facturée séparément, uniquement après acceptation", "Vous restez propriétaire du site et de son nom de domaine"].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#8fc9c2]" /> {t}
              </li>
            ))}
          </ul>
          <ButtonLink href="/connexion" className="mt-8 bg-white text-ink hover:bg-paper">
            Accéder à mon espace
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
