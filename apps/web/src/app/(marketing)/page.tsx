import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileCheck2,
  FileText,
  Gauge,
  Inbox,
  Lock,
  MessagesSquare,
  Scale,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { Faq } from "@/components/marketing/faq";
import { ButtonLink } from "@/components/ui/button";
import { siteHref } from "@/lib/sites";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-36 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <ShieldCheck className="size-3.5 text-accent" /> Hébergé en France et dans l&apos;UE · IA Mistral
            </p>
            <h1 className="font-display text-[42px] leading-[1.08] text-ink sm:text-[54px]">
              Chaque demande de client, <span className="text-accent">qualifiée</span> avant même que vous ne décrochiez.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Kanso Assistant accueille les visiteurs de votre site, pose les bonnes questions, et vous transmet une demande résumée et
              priorisée. Il traite aussi vos factures fournisseurs. Pour avocats, experts-comptables et notaires.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/inscription" size="lg">
                Essayer gratuitement 14 jours <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" variant="secondary">
                Voir la démonstration
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-subtle">Sans carte bancaire · Installation en 10 minutes · Sans engagement</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {[
            {
              icon: Inbox,
              title: "Fini les formulaires « contact » vides",
              text: "Les visiteurs répondent à 3 ou 4 questions précises au lieu d'un message vague. Vous savez qui rappeler, et pourquoi.",
            },
            {
              icon: Gauge,
              title: "Les urgences d'abord",
              text: "Chaque demande reçoit un score selon vos critères : domaine, délai, type de client. Les prioritaires vous sont signalées immédiatement.",
            },
            {
              icon: Scale,
              title: "Jamais de conseil à votre place",
              text: "L'assistant le dit clairement, refuse de donner un avis juridique ou comptable, et transmet à un humain dès qu'on le demande.",
            },
          ].map((f) => (
            <div key={f.title}>
              <f.icon className="size-6 text-accent" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-[15px] leading-7 text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <p className="text-sm font-medium text-accent">Fonctionnement</p>
        <h2 className="mt-2 max-w-2xl font-display text-4xl">Opérationnel en une matinée, sans compétence technique.</h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: "1. Choisissez votre modèle",
              text: "Questions et critères de priorité préparés pour votre métier. Ajustez le vocabulaire, les horaires, la couleur.",
            },
            {
              icon: Code2,
              title: "2. Ajoutez une ligne à votre site",
              text: "Un code à coller (WordPress, Wix, site sur mesure) ou à transmettre à votre prestataire. Nous vérifions l'installation.",
            },
            {
              icon: BellRing,
              title: "3. Recevez des demandes prêtes à traiter",
              text: "Par e-mail ou Slack, avec le résumé, le score et la conversation complète. Suivez-les dans votre espace.",
            },
          ].map((s) => (
            <li key={s.title} className="relative">
              <div className="flex size-11 items-center justify-center rounded-xl bg-ink text-paper">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[#8fc9c2]">Deux modules, un seul espace</p>
            <h2 className="mt-2 font-display text-4xl">Moins de saisie, plus de temps pour vos dossiers.</h2>
            <p className="mt-5 text-[15px] leading-7 text-paper/75">
              Activez l&apos;accueil seul, ou ajoutez le traitement des documents à partir de l&apos;offre Cabinet.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <MessagesSquare className="size-6 text-[#8fc9c2]" />
              <h3 className="mt-4 font-semibold">Assistant d&apos;accueil</h3>
              <ul className="mt-3 space-y-2 text-sm text-paper/75">
                {["Questions et score sur mesure", "Disponible le soir et le week-end", "Alertes e-mail et Slack", "Synchronisation CRM"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#8fc9c2]" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <FileText className="size-6 text-[#8fc9c2]" />
              <h3 className="mt-4 font-semibold">Traitement des documents</h3>
              <ul className="mt-3 space-y-2 text-sm text-paper/75">
                {["Lecture des factures PDF et scans", "Contrôle des totaux, doublons, IBAN", "Validation humaine en un clic", "Brouillons Pennylane ou Sellsy"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#8fc9c2]" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="font-display text-4xl">Pensé pour votre profession.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { href: "/cas-usage/avocats", title: "Avocats", text: "Domaine du droit, urgence, particulier ou entreprise. Refus systématique de toute consultation." },
            { href: "/cas-usage/experts-comptables", title: "Experts-comptables", text: "Création, tenue, bilan, paie. Factures fournisseurs de vos clients traitées en lot." },
            { href: "/cas-usage/notaires", title: "Notaires", text: "Vente, succession, donation : identifiez les dossiers avec compromis signé ou date fixée." },
          ].map((p) => (
            <Link key={p.href} href={p.href} className="group rounded-xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
              <h3 className="font-display text-2xl">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-muted">{p.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                En savoir plus <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-medium text-accent">Confiance</p>
            <h2 className="mt-2 font-display text-4xl">Le secret professionnel n&apos;est pas une option.</h2>
            <Link href="/securite" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Notre approche sécurité et RGPD <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: ServerCog, title: "Données dans l'UE", text: "Hébergement OVHcloud (France) et base de données en Union européenne. Modèles Mistral via leur point d'accès européen." },
              { icon: Lock, title: "Chiffrement", text: "Connexions TLS, identifiants d'intégration chiffrés (AES-256-GCM), sessions sécurisées." },
              { icon: FileCheck2, title: "RGPD intégré", text: "Accord de traitement (art. 28) accepté en ligne, durées de conservation appliquées, export et suppression en libre-service." },
              { icon: ShieldCheck, title: "Transparence IA", text: "Mention explicite à chaque conversation, sujets interdits configurables, transcription intégrale conservée pour vous." },
            ].map((t) => (
              <div key={t.title}>
                <t.icon className="size-5 text-accent" />
                <h3 className="mt-3 font-semibold">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <div className="grid items-center gap-8 rounded-2xl border border-line bg-surface p-8 md:grid-cols-[1.4fr_1fr] md:p-10">
          <div>
            <p className="text-sm font-medium text-accent">Kanso Site</p>
            <h2 className="mt-2 font-display text-3xl">Pas encore de site internet ?</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted">
              Kanso Site conçoit le site de votre cabinet — sobre, rapide, rédigé pour votre profession — avec Kanso Assistant déjà intégré
              et les pages RGPD prêtes. Refonte d&apos;un site existant également possible.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <ButtonLink href={siteHref("site")} size="lg" variant="accent">
              Découvrir Kanso Site
            </ButtonLink>
            <p className="text-xs text-subtle">Sur devis, sans engagement</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24">
        <h2 className="text-center font-display text-4xl">Questions fréquentes</h2>
        <Faq />
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-5xl rounded-2xl bg-accent px-8 py-14 text-center text-white">
          <h2 className="font-display text-4xl">Essayez Kanso sur votre site dès aujourd&apos;hui.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">14 jours complets, sans carte bancaire. Si ce n&apos;est pas pour vous, rien à résilier.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/inscription" size="lg" className="bg-white text-ink hover:bg-paper">
              Créer mon espace
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="ghost" className="text-white hover:bg-white/10">
              Parler à l&apos;équipe
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
