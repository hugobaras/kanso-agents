import { Database, Eye, FileLock2, KeyRound, ServerCog, ShieldCheck, Timer, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sécurité et RGPD",
  description: "Hébergement dans l'Union européenne, chiffrement, accord de traitement, durées de conservation : comment Kanso protège les données de vos clients.",
};

const BLOCKS = [
  {
    icon: ServerCog,
    title: "Hébergement européen",
    text: "Application hébergée chez OVHcloud en France ; base de données et stockage dans l'Union européenne. Aucun transfert hors UE sans garantie appropriée.",
  },
  {
    icon: Eye,
    title: "IA européenne et encadrée",
    text: "Les conversations et documents sont analysés par les modèles de Mistral AI via leur point d'accès européen. Le modèle ne prend aucune décision : il propose, votre configuration et votre équipe décident.",
  },
  {
    icon: KeyRound,
    title: "Chiffrement",
    text: "TLS sur toutes les connexions. Identifiants de vos outils (CRM, comptabilité, Slack) chiffrés en AES-256-GCM, jamais réaffichés. Mots de passe hachés (scrypt).",
  },
  {
    icon: UserCheck,
    title: "Accès maîtrisés",
    text: "Rôles propriétaire, administrateur et membre. Isolation stricte entre cabinets. Accès support uniquement à votre demande, limité dans le temps et journalisé.",
  },
  {
    icon: Timer,
    title: "Conservation limitée",
    text: "Conversations et documents supprimés automatiquement après 90 jours, journal d'audit après 365 jours. Export complet et suppression de l'espace en libre-service.",
  },
  {
    icon: FileLock2,
    title: "Contrat de sous-traitance",
    text: "Accord de traitement des données (article 28 du RGPD) accepté en ligne, versionné et horodaté. Liste des sous-traitants publique.",
  },
  {
    icon: Database,
    title: "Traçabilité",
    text: "Chaque publication, validation de document ou changement de droits est inscrit au journal d'audit de votre espace.",
  },
  {
    icon: ShieldCheck,
    title: "Transparence envers vos visiteurs",
    text: "Mention « assistant automatisé » affichée à chaque conversation, lien vers votre politique de confidentialité, aucun cookie publicitaire.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-12 pt-16 text-center">
        <p className="text-sm font-medium text-accent">Sécurité et RGPD</p>
        <h1 className="mt-2 font-display text-5xl">Conçu pour le secret professionnel.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Vos visiteurs vous confient des situations sensibles. Kanso est construit pour que ces informations restent en Europe,
          chiffrées, accessibles à votre seule équipe, et effacées quand elles ne servent plus.
        </p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {BLOCKS.map((b) => (
          <div key={b.title} className="rounded-xl border border-line bg-surface p-6">
            <b.icon className="size-5 text-accent" />
            <h2 className="mt-4 font-semibold">{b.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{b.text}</p>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="rounded-2xl border border-line bg-surface p-8">
          <h2 className="font-display text-2xl">Documents de référence</h2>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["/legal/dpa", "Accord de traitement des données (DPA)"],
              ["/legal/sous-traitants", "Liste des sous-traitants"],
              ["/legal/confidentialite", "Politique de confidentialité"],
              ["/legal/confidentialite-widget", "Information des visiteurs (widget)"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="text-accent hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Une question de votre DPO ou un questionnaire sécurité à remplir ? Écrivez à{" "}
            <a href="mailto:securite@kanso.fr" className="text-accent hover:underline">
              securite@kanso.fr
            </a>
            .
          </p>
          <ButtonLink href="/inscription" className="mt-6">
            Commencer l&apos;essai gratuit
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
