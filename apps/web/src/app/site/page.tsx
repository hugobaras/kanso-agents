import { ArrowRight, Calculator, Gavel, Landmark, MapPin, MessagesSquare, PenLine, Scale, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Faq } from "@/components/marketing/faq";
import { BrowserMock } from "@/components/sites/browser-mock";
import { ButtonLink } from "@/components/ui/button";
import { siteHref } from "@/lib/sites";

const INCLUDED = [
  { icon: PenLine, title: "Conception sur mesure", text: "Un design propre à votre cabinet, pas un modèle réutilisé : votre identité, vos couleurs, votre ton." },
  { icon: Scale, title: "Contenus rédigés", text: "Présentation, domaines d'intervention, modalités de travail : nous rédigeons avec vous, dans le style de votre profession." },
  { icon: ShieldCheck, title: "Conformité prise en compte", text: "Mentions légales, protection des données, accessibilité, et règles de communication propres à votre métier." },
  { icon: MapPin, title: "Visible localement", text: "Structure et balisage pensés pour être trouvé par les clients de votre ville et de votre spécialité." },
  { icon: MessagesSquare, title: "Assistant intégré, en option", text: "Kanso Assistant s'installe sur votre site dès sa mise en ligne : vos visiteurs sont accueillis et leurs demandes qualifiées." },
  { icon: SearchCheck, title: "Rapide et lisible partout", text: "Pages légères, lisibles sur mobile, sobres : un site qui rassure plutôt qu'un site qui impressionne." },
];

const PROFESSIONS = [
  {
    icon: Gavel,
    name: "Avocats",
    pages: ["Domaines d'intervention", "Équipe et parcours", "Honoraires et modalités", "Actualités juridiques", "Prise de rendez-vous"],
  },
  {
    icon: Calculator,
    name: "Experts-comptables",
    pages: ["Missions (tenue, bilan, paie, création)", "Secteurs accompagnés", "Équipe", "Ressources pour les dirigeants", "Demande de devis"],
  },
  {
    icon: Landmark,
    name: "Notaires",
    pages: ["Actes et domaines", "L'office et l'équipe", "Informations pratiques", "Étapes d'un dossier", "Prise de rendez-vous"],
  },
];

const STEPS = [
  { title: "Échange", text: "Un appel pour comprendre votre cabinet, vos clients, vos attentes." },
  { title: "Devis", text: "Une proposition qui détaille le périmètre et le prix avant tout engagement." },
  { title: "Conception", text: "Maquette, rédaction, validation avec vous à chaque étape." },
  { title: "Mise en ligne", text: "Publication, vérifications, et activation de l'assistant si vous l'avez choisi." },
];

export default function SitePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1fr_1.05fr] lg:pt-24">
        <div>
          <h1 className="font-display text-[42px] leading-[1.08] sm:text-[54px]">
            Le site de votre cabinet, conçu pour inspirer <span className="text-accent">confiance</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Avant de vous appeler, vos futurs clients vous cherchent en ligne. Kanso Site conçoit un site sobre, juste et à votre image — rédigé
            pour votre profession, prêt à accueillir leurs demandes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={siteHref("site", "/devis")} size="lg" variant="accent">
              Demander un devis gratuit <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="#inclus" size="lg" variant="secondary">
              Voir ce qui est inclus
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-subtle">Devis gratuit · Sans engagement · Réponse sous deux jours ouvrés</p>
        </div>
        <div>
          <BrowserMock />
          <p className="mt-3 text-center text-xs text-subtle">Exemple de structure — illustratif</p>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {[
            ["Une première impression qui compte", "Vos clients vérifient votre site avant de prendre contact. Il doit refléter le sérieux de votre pratique."],
            ["Un langage qui vous ressemble", "Ni jargon, ni promesses déplacées : des textes clairs, adaptés aux usages de votre profession."],
            ["Un site qui travaille pour vous", "Des pages qui répondent aux questions fréquentes et mènent naturellement à une prise de rendez-vous."],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="font-display text-xl">{t}</h2>
              <p className="mt-2 text-[15px] leading-7 text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="inclus" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <p className="text-sm font-medium text-accent">Ce qui est inclus</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl">Un site complet, pensé pour un cabinet.</h2>
        <div className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((i) => (
            <div key={i.title}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <i.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{i.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="professions" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <p className="text-sm font-medium text-accent">Votre profession</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl">Les pages dont votre métier a besoin.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PROFESSIONS.map((p) => (
              <div key={p.name} className="rounded-2xl border border-line bg-paper p-7">
                <p.icon className="size-6 text-accent" />
                <h3 className="mt-4 font-display text-2xl">{p.name}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {p.pages.map((pg) => (
                    <li key={pg} className="flex gap-2.5">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" /> {pg}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-6 text-muted">
            Nous tenons compte des règles de communication propres à chaque profession. La validation finale des contenus publiés vous
            appartient, comme c'est le cas pour toute communication de votre cabinet.
          </p>
        </div>
      </section>

      <section id="demarche" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <p className="text-sm font-medium text-accent">Démarche</p>
        <h2 className="mt-2 font-display text-4xl">De l'échange à la mise en ligne.</h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative border-t-2 border-accent pt-5">
              <span className="font-display text-3xl text-accent">{i + 1}</span>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 rounded-2xl border border-line bg-surface p-8 md:flex md:items-center md:justify-between md:gap-10">
          <div>
            <h3 className="font-display text-2xl">Tarification sur devis</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Chaque cabinet est différent : nombre de pages, rédaction, fonctionnalités. Le devis détaille le périmètre et le prix avant tout
              engagement, et il est gratuit.
            </p>
          </div>
          <ButtonLink href={siteHref("site", "/devis")} variant="accent" size="lg" className="mt-6 shrink-0 md:mt-0">
            Demander un devis
          </ButtonLink>
        </div>
      </section>

      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-24">
        <h2 className="text-center font-display text-4xl">Questions fréquentes</h2>
        <Faq
          items={[
            ["Qui est propriétaire du site ?", "Vous restez propriétaire de vos contenus et de votre nom de domaine. Les conditions de livraison et de cession du site sont précisées dans le devis."],
            ["Combien de temps faut-il ?", "Cela dépend du périmètre (nombre de pages, volume de rédaction). Le délai est indiqué dans le devis, avant tout engagement."],
            ["Puis-je modifier mon site moi-même ?", "Les modalités de mise à jour (par vous ou par nous) font partie de la discussion et du devis. Une maintenance peut être proposée."],
            ["Je veux garder mon site actuel : puis-je avoir l'assistant ?", "Oui. Kanso Assistant s'installe sur n'importe quel site avec une ligne de code ; Kanso Site n'est pas nécessaire."],
            ["Mon site sera-t-il conforme aux règles de ma profession ?", "Nous tenons compte des règles de communication de votre profession et des obligations légales (mentions, données personnelles, accessibilité). La validation finale des contenus vous revient."],
            ["Où est hébergé le site ?", "Dans l'Union européenne. Les options d'hébergement sont précisées dans le devis."],
          ]}
        />
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-5xl rounded-2xl bg-accent px-8 py-14 text-center text-white">
          <h2 className="font-display text-4xl">Parlons du site de votre cabinet.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Un échange, puis un devis clair. Sans engagement.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={siteHref("site", "/devis")} size="lg" className="bg-white text-ink hover:bg-paper">
              Demander un devis gratuit
            </ButtonLink>
            <Link href={siteHref("assistant")} className="inline-flex h-12 items-center justify-center rounded-lg px-6 text-[15px] font-medium text-white hover:bg-white/10">
              Découvrir Kanso Assistant
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
