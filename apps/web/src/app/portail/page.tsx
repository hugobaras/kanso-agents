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
            <Hourglass className="size-3.5" /> Bêta fermée — accès sur demande
          </p>
          <h1 className="font-display text-[42px] leading-[1.08] sm:text-[54px]">
            L&apos;espace client de votre cabinet, <span className="text-accent">sécurisé</span> et simple.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Avec Kanso Portail, vos clients déposent leurs pièces depuis leur téléphone, sans créer de compte, et suivent l'avancement de leur dossier,
            plutôt que de tout envoyer par e-mail. Pour avocats, experts-comptables et notaires.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
            La bêta est ouverte cabinet par cabinet. Documents chiffrés, analysés par un antivirus et hébergés dans l'Union européenne ; vous choisissez
            la durée de conservation.
          </p>
          <a
            href="#liste-attente"
            className="mt-8 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-strong"
          >
            Demander l&apos;accès à la bêta
          </a>
          <Link href="/connexion?suite=/app" className="ml-3 mt-8 inline-flex h-12 items-center rounded-lg border border-line-strong bg-surface px-6 text-[15px] font-medium text-ink hover:bg-sunken">
            Ouvrir mon portail
          </Link>
        </div>
        <div>
          <PortalMock />
          <p className="mt-3 text-center text-xs text-subtle">Aperçu — susceptible d&apos;évoluer pendant la bêta</p>
        </div>
      </section>

      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <p className="text-sm font-medium text-accent">Comment ça marche</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl">Du dossier ouvert au dossier complet, en quatre étapes.</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Vous ouvrez un dossier", "Choisissez un modèle (bilan, vente immobilière, ouverture de dossier…), ajustez la liste des pièces, indiquez l'e-mail du client."],
            ["Le client reçoit un lien", "Il l'ouvre sur son téléphone, saisit le code reçu par e-mail. Aucun compte à créer."],
            ["Il dépose ses pièces", "Photo ou fichier (PDF, JPEG, PNG, 20 Mo). Chiffrées, analysées par un antivirus, stockées en Europe."],
            ["Vous validez", "Acceptez ou refusez chaque pièce avec un motif. Relances automatiques, alerte quand tout est reçu."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-line bg-surface p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
              <p className="mt-4 font-semibold">{t}</p>
              <p className="mt-1.5 text-sm leading-6 text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="fonctions" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <p className="text-sm font-medium text-accent">Ce que fait Kanso Portail</p>
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
            Périmètre de la bêta : dépôt de pièces (PDF et images, 20 Mo), relances, validation pièce par pièce, messages courts, export. Signature, paiement et rendez-vous ne sont pas inclus.
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
            reçoit et qualifie les demandes de vos futurs clients. Depuis une demande qualifiée, « Créer un dossier » reprend
            les coordonnées du client : plus de ressaisie.
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
          <h2 className="font-display text-4xl">Demandez l&apos;accès à la bêta.</h2>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            Nous ouvrons Kanso Portail cabinet par cabinet. Décrivez votre usage : nous activons le module sur votre espace Kanso Assistant
            (ou en créons un) sous deux jours ouvrés. Gratuit pendant la bêta, sans engagement.
          </p>
          <p className="mt-4 text-sm text-subtle">Vous avez déjà un espace ? Le bouton « Demander l'accès » est aussi disponible dans l'onglet Portail de votre tableau de bord.</p>
        </div>
        <PublicForm
          source="portail"
          mode="waitlist"
          submitLabel="Demander l'accès"
          successTitle="Demande reçue"
          successText="Merci ! Vous recevez un e-mail de confirmation. Nous revenons vers vous sous deux jours ouvrés pour activer votre accès."
        />
      </section>

      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-24">
        <h2 className="text-center font-display text-4xl">Questions fréquentes</h2>
        <Faq
          items={[
            ["Comment obtenir l'accès ?", "Remplissez le formulaire ci-dessus. Nous activons le module sur votre espace sous deux jours ouvrés ; vous n'avez rien à installer."],
            ["Mon client doit-il créer un compte ?", "Non. Il reçoit un lien personnel valable 7 jours et un code à six chiffres par e-mail à chaque connexion."],
            ["Quels fichiers peut-il envoyer ?", "PDF, JPEG, PNG et WebP, jusqu'à 20 Mo par fichier, depuis son téléphone ou son ordinateur. Chaque fichier est analysé par un antivirus."],
            ["Combien de temps les documents sont-ils conservés ?", "Vous choisissez : 90 jours après la clôture du dossier par défaut. Vous et votre client êtes prévenus 7 jours avant la suppression, et vous pouvez tout exporter en ZIP."],
            ["Combien cela coûte-t-il ?", "La bêta est gratuite, dans la limite de 20 dossiers actifs. Les offres seront communiquées avant tout passage au payant."],
            ["Faut-il utiliser Kanso Assistant ?", "Non, Kanso Portail fonctionne seul. Avec Kanso Assistant, une demande qualifiée devient un dossier en un clic."],
            ["Mes données sont-elles protégées ?", "Elles sont chiffrées, hébergées dans l'Union européenne, et le cabinet reste responsable du traitement, avec le même cadre RGPD que Kanso Assistant. Les accès du cabinet aux pièces sont tracés."],
          ]}
        />
      </section>
    </>
  );
}
