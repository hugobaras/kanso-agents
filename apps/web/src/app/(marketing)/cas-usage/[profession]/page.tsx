import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";

type Content = {
  profession: string;
  title: string;
  lede: string;
  questions: string[];
  benefits: Array<[string, string]>;
  documents?: string;
  guardrail: string;
};

const CONTENT: Record<string, Content> = {
  avocats: {
    profession: "avocat",
    title: "L'assistant d'accueil des cabinets d'avocats",
    lede: "Les demandes arrivent avec le domaine du droit, l'urgence et le profil du client. Vous rappelez en priorité les dossiers qui correspondent à votre pratique.",
    questions: ["Domaine : famille, travail, sociétés, immobilier, pénal…", "Délai souhaité pour un premier échange", "Particulier ou entreprise", "Nom et e-mail"],
    benefits: [
      ["Pas de consultation déguisée", "L'assistant refuse toute demande d'avis juridique et le dit clairement, conformément à vos obligations déontologiques."],
      ["Les urgences repérées", "Une convocation, une garde à vue, un délai de prescription : les mots-clés que vous choisissez déclenchent une transmission immédiate."],
      ["Un accueil le soir et le week-end", "Les demandes reçues hors horaires sont recueillies et vous attendent le lendemain matin, triées."],
    ],
    guardrail: "Kanso ne fournit aucune consultation juridique. La qualification est indicative et la décision de prendre un dossier vous appartient toujours.",
  },
  "experts-comptables": {
    profession: "expert_comptable",
    title: "Accueil et factures, pour les cabinets d'expertise comptable",
    lede: "Qualifiez les prospects (création, tenue, bilan, paie) et laissez Kanso lire les factures fournisseurs pour préparer les brouillons dans Pennylane.",
    questions: ["Besoin principal : création, tenue, bilan, paie", "Taille de la structure", "Délai souhaité", "Nom et e-mail"],
    benefits: [
      ["Prospects triés par potentiel", "Une PME qui cherche un expert pour la tenue n'a pas la même priorité qu'une demande de renseignement ponctuelle."],
      ["Factures lues et contrôlées", "Totaux HT/TVA/TTC, doublons et IBAN inconnus sont signalés avant tout envoi."],
      ["Validation en un clic", "Vous corrigez si besoin, validez, et le brouillon part dans votre logiciel comptable."],
    ],
    documents: "Inclus à partir de l'offre Cabinet : 150 documents par mois.",
    guardrail: "Kanso ne fournit aucun conseil comptable ou fiscal. Les écritures restent des brouillons tant qu'un humain ne les a pas validées.",
  },
  notaires: {
    profession: "notaire",
    title: "L'accueil numérique des offices notariaux",
    lede: "Identifiez immédiatement les dossiers avancés (compromis signé, date fixée) et orientez les simples demandes de renseignement.",
    questions: ["Type d'acte : vente, succession, donation, contrat de mariage…", "Avancement du projet", "Nom et e-mail"],
    benefits: [
      ["Les dossiers mûrs en premier", "Un compromis signé avec une date de réitération remonte en tête de liste, avec toutes les informations utiles."],
      ["Moins d'appels de premier niveau", "L'assistant recueille l'essentiel et votre équipe rappelle avec le contexte."],
      ["Transmission à un clerc à la demande", "Dès qu'un visiteur souhaite parler à quelqu'un, la demande vous est transmise."],
    ],
    guardrail: "Kanso ne fournit aucun conseil juridique ou fiscal. Il recueille la demande ; l'office décide de la suite.",
  },
};

export function generateStaticParams() {
  return Object.keys(CONTENT).map((profession) => ({ profession }));
}

export async function generateMetadata({ params }: { params: Promise<{ profession: string }> }): Promise<Metadata> {
  const { profession } = await params;
  const c = CONTENT[profession];
  return c ? { title: c.title, description: c.lede } : {};
}

export default async function UseCasePage({ params }: { params: Promise<{ profession: string }> }) {
  const { profession } = await params;
  const c = CONTENT[profession];
  if (!c) notFound();
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-12 pt-16">
        <h1 className="font-display text-[44px] leading-tight">{c.title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{c.lede}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/inscription?profession=${c.profession}`} size="lg">
            Essayer avec le modèle {profession.replace("-", " ")}
          </ButtonLink>
          <ButtonLink href="/demo" size="lg" variant="secondary">
            Voir la démonstration
          </ButtonLink>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-16 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="text-sm font-semibold">Questions du modèle</p>
          <ul className="mt-4 space-y-3 text-sm">
            {c.questions.map((q) => (
              <li key={q} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> {q}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-muted">Entièrement modifiable : questions, choix, points, seuils.</p>
          {c.documents && <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-xs text-accent-strong">{c.documents}</p>}
        </div>
        <div className="space-y-6">
          {c.benefits.map(([t, d]) => (
            <div key={t}>
              <h2 className="font-display text-2xl">{t}</h2>
              <p className="mt-2 text-[15px] leading-7 text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <p className="rounded-xl border border-line bg-paper p-5 text-sm text-muted">{c.guardrail}</p>
      </section>
    </>
  );
}
