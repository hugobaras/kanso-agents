import {
  ArrowRight,
  Eye,
  FileCheck2,
  Handshake,
  LayoutTemplate,
  Lock,
  MessagesSquare,
  ServerCog,
  Sparkles,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SITES, siteHref, themeStyle, type SiteId } from "@/lib/sites";

const PRODUCTS: Array<{
  id: Exclude<SiteId, "solutions">;
  step: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  text: string;
  points: string[];
  status: string;
  cta: string;
}> = [
  {
    id: "site",
    step: "1 · Attirer",
    icon: LayoutTemplate,
    headline: "Le site de votre cabinet, conçu sur mesure.",
    text: "Une vitrine sobre et crédible, rédigée pour votre profession, avec l'assistant déjà intégré si vous le souhaitez.",
    points: [
      "Conception et rédaction sur mesure",
      "Conformité et déontologie prises en compte",
      "Devis gratuit, sans engagement",
    ],
    status: "Sur devis",
    cta: "Découvrir Kanso Site",
  },
  {
    id: "assistant",
    step: "2 · Accueillir",
    icon: MessagesSquare,
    headline: "Chaque demande reçue, qualifiée et classée.",
    text: "Un assistant qui pose les bonnes questions aux visiteurs de votre site, vous transmet des demandes triées par priorité et lit vos factures fournisseurs.",
    points: [
      "Score et priorité selon vos critères",
      "Alertes e-mail et Slack",
      "Documents lus, contrôlés, validés par vous",
    ],
    status: "Disponible · essai 14 jours",
    cta: "Découvrir Kanso Assistant",
  },
  {
    id: "portail",
    step: "3 · Suivre",
    icon: Lock,
    headline: "L'espace client sécurisé de votre cabinet.",
    text: "Vos clients déposent leurs pièces et suivent leur dossier au même endroit, au lieu de vous écrire par e-mail.",
    points: [
      "Dépôt de pièces sécurisé",
      "Suivi de dossier",
      "Échanges centralisés",
    ],
    status: "En conception",
    cta: "Découvrir Kanso Portail",
  },
];

const PRINCIPLES = [
  {
    icon: Sparkles,
    title: "La sobriété avant tout",
    text: "« Kanso » signifie simplicité. Chaque produit fait peu de choses, bien, sans jargon ni réglage inutile.",
  },
  {
    icon: UserCheck,
    title: "Vous gardez la main",
    text: "Nos outils préparent, trient et proposent. Vous validez, vous décidez, vous répondez. Aucun conseil n'est donné à votre place.",
  },
  {
    icon: ServerCog,
    title: "Des données en Europe",
    text: "Hébergement en France et dans l'Union européenne, modèles d'IA européens, accord de traitement et suppression en libre-service.",
  },
  {
    icon: Eye,
    title: "Transparent sur ce que nous promettons",
    text: "Nous nous engageons sur les moyens mis en œuvre, pas sur des résultats que personne ne peut garantir.",
  },
];

export default function SolutionsHome() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 lg:pt-28">
          <h1 className="max-w-4xl font-display text-[44px] leading-[1.06] sm:text-[62px]">
            Des outils simples pour les professions du{" "}
            <span className="text-accent">droit</span> et du{" "}
            <span className="text-accent">chiffre</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Kanso Solutions conçoit les outils numériques d'un cabinet moderne :
            un site qui inspire confiance, un assistant qui reçoit et trie les
            demandes, un espace pour échanger avec vos clients.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#produits" size="lg" variant="accent">
              Voir les produits <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink
              href={siteHref("solutions", "/contact")}
              size="lg"
              variant="secondary"
            >
              Nous contacter
            </ButtonLink>
          </div>
        </div>
        <svg
          className="pointer-events-none absolute -right-24 top-6 hidden size-[460px] text-ink/[0.04] lg:block"
          viewBox="0 0 256 256"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M208.26 55.73A108 108 0 1 1 112.97 21.05L116.37 45.23A74 74 0 1 0 194.46 68.16Z"
          />
        </svg>
      </section>

      <section
        id="produits"
        className="scroll-mt-20 border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-sm font-medium text-accent">La gamme</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl">
            Trois produits qui se complètent, de la première visite au suivi du
            dossier.
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PRODUCTS.map((p) => {
              const def = SITES[p.id];
              return (
                <article
                  key={p.id}
                  style={themeStyle(p.id)}
                  className="flex flex-col rounded-2xl border border-line bg-paper p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <p.icon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    {p.step}
                  </p>
                  <h3 className="mt-1 font-display text-2xl">{def.name}</h3>
                  <p className="mt-2 text-[15px] font-medium leading-6">
                    {p.headline}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">{p.text}</p>
                  <ul className="my-5 flex-1 space-y-2 text-sm">
                    {p.points.map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <FileCheck2
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden
                        />{" "}
                        {t}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={siteHref(p.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                  >
                    {p.cta} <ArrowRight className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="approche"
        className="scroll-mt-20 mx-auto max-w-6xl px-5 py-24"
      >
        <p className="text-sm font-medium text-accent">Notre approche</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl">
          Conçus pour des métiers où la confiance ne se négocie pas.
        </h2>
        <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <p.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-muted">
                  {p.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-2xl bg-ink p-10 text-paper md:grid-cols-[1.5fr_1fr] md:p-14">
          <div>
            <Handshake className="size-7 text-[#8fc9c2]" />
            <h2 className="mt-4 font-display text-3xl">
              Un éditeur à taille humaine.
            </h2>
            <p className="mt-3 max-w-xl text-paper/75">
              Kanso Solutions est la gamme de produits de{" "}
              <strong className="font-medium text-paper">SHBT-STUDIO</strong>,
              studio indépendant de développement logiciel. Vous parlez
              directement à ceux qui conçoivent les outils.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <ButtonLink
              href={siteHref("solutions", "/contact")}
              size="lg"
              className="bg-white text-ink hover:bg-paper"
            >
              Écrire à l'équipe
            </ButtonLink>
            <p className="text-xs text-paper/60">
              Réponse sous deux jours ouvrés
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
