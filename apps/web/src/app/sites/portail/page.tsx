import { FileUp, Hourglass, LockKeyhole, MessagesSquare, ScrollText, ServerCog, Workflow } from "lucide-react";
import { Faq } from "@/components/marketing/faq";
import { PortalMock } from "@/components/sites/portal-mock";
import { PublicForm } from "@/components/sites/contact-form";
import { siteHref } from "@/lib/sites";
import Link from "next/link";

const FEATURES = [
  { icon: FileUp, title: "Dépôt de pièces", text: "Vos clients déposent leurs documents dans un espace sécurisé, avec la liste de ce qui manque." },
  { icon: Workflow, title: "Suivi de dossier", text: "Une vue simple de l'avancement : ce qui est fait, ce qui reste à fournir." },
  { icon: MessagesSquare, title: "Échanges centralisés", text: "Les questions et réponses restent attachées au dossier, au lieu de se perdre dans des e-mails." },
  { icon: ScrollText, title: "Historique", text: "Qui a déposé quoi, quand : une trace claire, utile pour le cabinet comme pour le client." },
];

export default function PortailPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
            <Hourglass className="size-3.5" /> En conception — liste d&apos;attente ouverte
          </p>
          <h1 className="font-display text-[42px] leading-[1.08] sm:text-[54px]">
            L&apos;espace client de votre cabinet, <span className="text-accent">sécurisé</span> et simple.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Kanso Portail permettra à vos clients de déposer leurs pièces et de suivre leur dossier au même endroit, plutôt que par e-mail.
            Pour avocats, experts-comptables et notaires.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
            Le produit est en cours de conception. Nous le construisons avec les cabinets qui s'inscrivent : leurs besoins décident de ce que
            nous développons en premier.
          </p>
          <a
            href="#liste-attente"
            className="mt-8 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-strong"
          >
            Rejoindre la liste d&apos;attente
          </a>
        </div>
        <div>
          <PortalMock />
          <p className="mt-3 text-center text-xs text-subtle">Aperçu conceptuel — non contractuel, susceptible d&apos;évoluer</p>
        </div>
      </section>

      <section id="fonctions" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <p className="text-sm font-medium text-accent">Ce qu'il fera</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl">Moins d&apos;e-mails à relancer, plus de dossiers qui avancent.</h2>
          <div className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-subtle">
            Fonctions envisagées à ce stade de la conception ; le périmètre final dépendra des retours des cabinets.
          </p>
        </div>
      </section>

      <section id="assistant" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-5 py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-accent">Avec Kanso Assistant</p>
          <h2 className="mt-2 font-display text-4xl">De la première demande au dossier suivi.</h2>
          <p className="mt-5 text-[15px] leading-7 text-muted">
            <Link href={siteHref("assistant")} className="font-medium text-accent hover:underline">
              Kanso Assistant
            </Link>{" "}
            reçoit et qualifie les demandes de vos futurs clients. L'idée de Kanso Portail : qu'une demande acceptée devienne un dossier, avec son
            espace d'échange, sans ressaisie.
          </p>
        </div>
        <ol className="space-y-5">
          {[
            ["Un visiteur vous écrit", "Kanso Assistant recueille sa demande et la classe par priorité."],
            ["Vous acceptez le dossier", "Vous décidez de donner suite."],
            ["Le client dépose ses pièces", "Dans son espace sécurisé, avec la liste de ce qui est attendu."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-xl border border-line bg-surface p-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
          {[
            { icon: LockKeyhole, title: "Accès restreint", text: "Chaque client ne voit que son propre dossier. Les accès sont contrôlés et tracés." },
            { icon: ServerCog, title: "Données en Europe", text: "Hébergement en France et dans l'Union européenne, comme tous les produits Kanso." },
            { icon: ScrollText, title: "Cadre RGPD", text: "Accord de traitement, durées de conservation, export et suppression : la même exigence que Kanso Assistant." },
          ].map((p) => (
            <div key={p.title} className="flex gap-4">
              <p.icon className="mt-1 size-5 shrink-0 text-accent" />
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="liste-attente" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-5 py-24 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-4xl">Rejoignez la liste d&apos;attente.</h2>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            Laissez votre adresse : nous vous prévenons à l'ouverture, et nous pouvons vous associer à la conception si vous le souhaitez. Aucun
            engagement, aucun paiement.
          </p>
          <p className="mt-4 text-sm text-subtle">Nous n'annonçons pas de date d'ouverture pour l'instant.</p>
        </div>
        <PublicForm
          source="portail"
          mode="waitlist"
          submitLabel="Je m'inscris"
          successTitle="Vous êtes sur la liste"
          successText="Merci ! Vous recevez un e-mail de confirmation. Nous vous écrirons lorsque Kanso Portail s'ouvrira."
        />
      </section>

      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-24">
        <h2 className="text-center font-display text-4xl">Questions fréquentes</h2>
        <Faq
          items={[
            ["Quand Kanso Portail sera-t-il disponible ?", "Le produit est en conception et nous n'annonçons pas de date. Les cabinets de la liste d'attente seront prévenus en premier."],
            ["Combien cela coûtera-t-il ?", "Les offres ne sont pas définies. Elles seront communiquées à l'ouverture, avec une priorité pour les cabinets inscrits."],
            ["Puis-je participer à la conception ?", "Oui : indiquez ce que vous attendez dans le formulaire. Nous pourrons vous proposer d'échanger sur vos usages."],
            ["Faut-il utiliser Kanso Assistant ?", "Non. Kanso Portail est conçu pour fonctionner seul, mais il s'articulera naturellement avec Kanso Assistant."],
            ["Mes données sont-elles protégées ?", "Elles seront hébergées dans l'Union européenne et soumises au même cadre RGPD que nos autres produits."],
          ]}
        />
      </section>
    </>
  );
}
