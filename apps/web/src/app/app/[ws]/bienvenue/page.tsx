"use client";

import { Briefcase, Calculator, Check, CheckCircle2, Landmark, Radio, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatPreview } from "@/components/assistant/chat-preview";
import { WebsiteOffer } from "@/components/website-offer";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/copy";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import type { InboundConfig } from "@/lib/types";

const STEPS = ["Modèle", "Apparence", "Alertes", "Installation", "Vérification"];
const PROFESSIONS = [
  { id: "avocat", label: "Avocat", Icon: Scale },
  { id: "expert_comptable", label: "Expert-comptable", Icon: Calculator },
  { id: "notaire", label: "Notaire", Icon: Landmark },
  { id: "autre", label: "Autre", Icon: Briefcase },
];
const SWATCHES = ["#1B2A4A", "#1F6F6B", "#0F4C3A", "#5B2A4A", "#7A3E1D", "#2D5B8A"];

type Install = { snippet: string; last_seen_at: string | null; last_seen_origin: string | null; allowed_origins: string[] };

export default function OnboardingPage() {
  const { ws, me, overview, refreshOverview, can } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const assistant = useApi<{ draft: InboundConfig }>(wsPath(ws, "/assistant"), { revalidateOnFocus: false });
  const [step, setStep] = useState(Math.min(overview.workspace.onboarding_step, STEPS.length - 1));
  const [config, setConfig] = useState<InboundConfig | null>(null);
  const [profession, setProfession] = useState(overview.workspace.profession ?? "avocat");
  const [recipient, setRecipient] = useState(me.user.email);
  const [site, setSite] = useState("");
  const [noSite, setNoSite] = useState(false);
  const [busy, setBusy] = useState(false);
  const install = useApi<Install>(step >= 3 ? wsPath(ws, "/assistant/install") : null, {
    refreshInterval: (d) => (step === 4 && !d?.last_seen_at ? 5000 : 0),
  });

  useEffect(() => {
    if (assistant.data && !config) setConfig(assistant.data.draft);
  }, [assistant.data, config]);

  if (!can("admin")) {
    return <Alert tone="info">L&apos;assistant de démarrage est réservé aux administrateurs de l&apos;espace.</Alert>;
  }
  if (!config) return <PageSpinner />;

  async function goTo(next: number) {
    setStep(next);
    await api(wsPath(ws, "/onboarding"), { method: "PATCH", body: { step: next } }).catch(() => undefined);
  }

  async function guarded(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error("Une erreur est survenue", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const saveDraft = async (c: InboundConfig) => {
    const r = await api<{ config: InboundConfig }>(wsPath(ws, "/assistant/draft"), { method: "PUT", body: { config: c } });
    setConfig(r.config);
  };

  const steps = [
    // 0 — template
    <div key="0" className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Quel est votre métier ?</h2>
        <p className="mt-1 text-sm text-muted">Nous préparons des questions adaptées. Vous pourrez tout modifier ensuite.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PROFESSIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setProfession(id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
              profession === id ? "border-accent bg-accent-soft/60" : "border-line bg-surface hover:bg-paper",
            )}
          >
            <Icon className="size-5 text-accent" /> <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
      <Card>
        <CardBody>
          <p className="mb-2 text-[13px] font-medium text-muted">Questions proposées</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {config.qualification.questions.map((q) => (
              <li key={q.id}>{q.prompt}</li>
            ))}
          </ol>
        </CardBody>
      </Card>
      <Button
        size="lg"
        loading={busy}
        onClick={() =>
          guarded(async () => {
            if (profession !== overview.workspace.profession) {
              const r = await api<{ config: InboundConfig }>(wsPath(ws, "/assistant/template"), { body: { profession } });
              setConfig(r.config);
            }
            await goTo(1);
          })
        }
      >
        Continuer
      </Button>
    </div>,

    // 1 — look
    <div key="1" className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">À votre image</h2>
        <p className="mt-1 text-sm text-muted">Nom, couleur et message d&apos;accueil affichés à vos visiteurs.</p>
      </div>
      <Field label="Nom affiché">
        {(p) => <Input {...p} value={config.identity.display_name} onChange={(e) => setConfig({ ...config, identity: { ...config.identity, display_name: e.target.value } })} />}
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium">Couleur</p>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setConfig({ ...config, identity: { ...config.identity, branding: { ...config.identity.branding, primary_color: c } } })}
              className={cn("size-8 rounded-full ring-offset-2", config.identity.branding.primary_color.toLowerCase() === c.toLowerCase() && "ring-2 ring-ink")}
              style={{ background: c }}
              aria-label={`Couleur ${c}`}
            />
          ))}
          <input
            type="color"
            value={config.identity.branding.primary_color}
            onChange={(e) => setConfig({ ...config, identity: { ...config.identity, branding: { ...config.identity.branding, primary_color: e.target.value.toUpperCase() } } })}
            className="size-8 cursor-pointer rounded-full border border-line"
            aria-label="Couleur personnalisée"
          />
        </div>
      </div>
      <Field label="Message d'accueil" optional>
        {(p) => (
          <Textarea {...p} rows={2} value={config.identity.welcome_message ?? ""} onChange={(e) => setConfig({ ...config, identity: { ...config.identity, welcome_message: e.target.value || undefined } })} />
        )}
      </Field>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => goTo(0)}>
          Retour
        </Button>
        <Button size="lg" loading={busy} onClick={() => guarded(async () => { await saveDraft(config); await goTo(2); })}>
          Continuer
        </Button>
      </div>
    </div>,

    // 2 — alerts + hours
    <div key="2" className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">Où recevoir les demandes ?</h2>
        <p className="mt-1 text-sm text-muted">Un e-mail par demande qualifiée, avec le résumé et le score.</p>
      </div>
      <Field label="Adresse de réception" hint="Vous pourrez en ajouter d'autres, ou Slack, depuis Assistant › Alertes.">
        {(p) => <Input {...p} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">En dehors de vos horaires (lun-ven, 9 h-18 h 30)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["qualify", "Continuer à recueillir les demandes"],
              ["block", "Mettre l'assistant en pause"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={cn("cursor-pointer rounded-lg border p-3 text-sm", (config.operations.after_hours_mode ?? "block") === v ? "border-accent bg-accent-soft/60" : "border-line")}>
              <input
                type="radio"
                className="sr-only"
                checked={(config.operations.after_hours_mode ?? "block") === v}
                onChange={() => setConfig({ ...config, operations: { ...config.operations, after_hours_mode: v } })}
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => goTo(1)}>
          Retour
        </Button>
        <Button
          size="lg"
          loading={busy}
          disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)}
          onClick={() =>
            guarded(async () => {
              await saveDraft(config);
              await api(wsPath(ws, "/assistant/alerts/email"), { method: "PUT", body: { recipients: [recipient.trim().toLowerCase()] } });
              await api(wsPath(ws, "/assistant/publish"), { method: "POST" });
              void refreshOverview();
              await goTo(3);
            })
          }
        >
          Publier mon assistant
        </Button>
      </div>
    </div>,

    // 3 — install
    <div key="3" className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">Installez-le sur votre site</h2>
        <p className="mt-1 text-sm text-muted">Collez ce code avant la balise &lt;/body&gt;, ou transmettez-le à votre prestataire.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avez-vous déjà un site ?">
        {(
          [
            [false, "J'ai un site internet"],
            [true, "Je n'ai pas encore de site"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={l}
            role="radio"
            aria-checked={noSite === v}
            onClick={() => setNoSite(v)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              noSite === v ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:bg-paper",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {noSite ? (
        <WebsiteOffer ws={ws} />
      ) : (
        <>
          {install.data ? <CodeBlock code={install.data.snippet} /> : <PageSpinner />}
          <Field label="Adresse de votre site" hint="Seul ce site pourra afficher votre assistant." optional>
            {(p) => <Input {...p} placeholder="https://www.mon-cabinet.fr" value={site} onChange={(e) => setSite(e.target.value)} />}
          </Field>
        </>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => goTo(2)}>
          Retour
        </Button>
        <Button
          size="lg"
          loading={busy}
          onClick={() =>
            guarded(async () => {
              if (site.trim()) {
                const raw = /^https?:\/\//.test(site.trim()) ? site.trim() : `https://${site.trim()}`;
                const u = new URL(raw);
                await api(wsPath(ws, "/assistant/install/origins"), { method: "PUT", body: { origins: [`${u.protocol}//${u.host}`] } });
              }
              await goTo(4);
            })
          }
        >
          {noSite ? "Continuer" : "C'est installé"}
        </Button>
      </div>
    </div>,

    // 4 — verify
    <div key="4" className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">Dernière vérification</h2>
        <p className="mt-1 text-sm text-muted">Ouvrez votre site dans un autre onglet : nous détectons l&apos;assistant automatiquement.</p>
      </div>
      <Card>
        <CardBody>
          {install.data?.last_seen_at ? (
            <div className="flex gap-3">
              <CheckCircle2 className="size-6 text-success" />
              <div>
                <p className="font-medium">Assistant détecté sur {install.data.last_seen_origin?.replace(/^https?:\/\//, "")}</p>
                <p className="text-sm text-muted">{timeAgo(install.data.last_seen_at)}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Radio className="size-6 animate-pulse text-accent" />
              <div>
                <p className="font-medium">{noSite ? "Votre assistant est prêt" : "En attente…"}</p>
                <p className="text-sm text-muted">
                  {noSite
                    ? "Il sera installé sur votre site dès sa mise en ligne. Vous pouvez déjà le tester depuis l'éditeur."
                    : "Vous pouvez terminer et revenir plus tard depuis la page Installation."}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <Button
        size="lg"
        loading={busy}
        onClick={() =>
          guarded(async () => {
            await api(wsPath(ws, "/onboarding"), { method: "PATCH", body: { step: 5, completed: true } });
            await refreshOverview();
            toast.success("Votre espace est prêt", "Bienvenue sur Kanso !");
            router.push(`/app/${ws}`);
          })
        }
      >
        Accéder au tableau de bord
      </Button>
    </div>,
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <ol className="mb-10 flex items-center gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < step ? "bg-accent text-white" : i === step ? "bg-ink text-paper" : "bg-sunken text-subtle",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:block", i === step ? "font-medium" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 animate-fade-in">{steps[step]}</div>
        <div className="hidden lg:block">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Aperçu</p>
          <ChatPreview ws={ws} config={config} />
        </div>
      </div>
      <div className="mt-10 text-center">
        <button
          className="text-sm text-muted hover:text-ink"
          onClick={async () => {
            await api(wsPath(ws, "/onboarding"), { method: "PATCH", body: { completed: true } }).catch(() => undefined);
            await refreshOverview();
            router.push(`/app/${ws}`);
          }}
        >
          Passer et configurer plus tard
        </button>
      </div>
    </div>
  );
}
