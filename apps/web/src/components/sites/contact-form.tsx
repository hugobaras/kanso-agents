"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { siteHref, type SiteId } from "@/lib/sites";

type Mode = "contact" | "devis" | "waitlist";

const PROFESSIONS = [
  ["avocat", "Avocat"],
  ["expert_comptable", "Expert-comptable"],
  ["notaire", "Notaire"],
  ["autre", "Autre"],
] as const;

/**
 * Formulaire public des sites vitrines : contact (Solutions), devis (Kanso Site),
 * liste d'attente (Kanso Portail). Le champ « website » est un piège à robots.
 */
export function PublicForm({
  source,
  mode,
  submitLabel,
  successTitle,
  successText,
  className,
}: {
  source: SiteId;
  mode: Mode;
  submitLabel: string;
  successTitle: string;
  successText: string;
  className?: string;
}) {
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    profession: "",
    organisation: "",
    message: "",
    project: "creation",
    current_url: "",
    timeline: "flexible",
    with_assistant: false,
    consent: false,
    website: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const devis = mode === "devis";
  const waitlist = mode === "waitlist";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!f.consent) {
      setFieldErrors({ consent: "Cochez la case pour que nous puissions vous répondre." });
      return;
    }
    setLoading(true);
    try {
      await api("/api/public/contact", {
        body: {
          source,
          kind: mode,
          name: f.name,
          email: f.email,
          phone: f.phone || undefined,
          profession: f.profession || undefined,
          organisation: f.organisation || undefined,
          message: f.message || undefined,
          extra: devis
            ? {
                project: f.project,
                timeline: f.timeline,
                current_url: f.project === "refonte" ? f.current_url || undefined : undefined,
                with_assistant: f.with_assistant || undefined,
              }
            : {},
          consent: true,
          website: f.website,
        },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={cn("rounded-xl border border-line bg-surface p-8 text-center", className)} role="status">
        <CheckCircle2 className="mx-auto size-10 text-accent" aria-hidden />
        <h3 className="mt-4 font-display text-2xl">{successTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{successText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-4 rounded-xl border border-line bg-surface p-6 sm:p-8", className)} noValidate>
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      {devis && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Votre projet</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["creation", "Créer mon site"],
                ["refonte", "Refaire mon site actuel"],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-2.5 text-sm",
                  f.project === v ? "border-accent bg-accent-soft/60" : "border-line-strong hover:bg-paper",
                )}
              >
                <input type="radio" name="project" className="sr-only" checked={f.project === v} onChange={() => set("project", v)} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className={cn("grid gap-4", !waitlist && "sm:grid-cols-2")}>
        {!waitlist && (
          <Field label="Nom" error={fieldErrors.name}>
            {(p) => <Input {...p} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />}
          </Field>
        )}
        <Field label="E-mail professionnel" error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profession" optional={waitlist}>
          {(p) => (
            <Select {...p} value={f.profession} onChange={(e) => set("profession", e.target.value)}>
              <option value="">Choisir…</option>
              {PROFESSIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cabinet / office" optional>
          {(p) => <Input {...p} autoComplete="organization" value={f.organisation} onChange={(e) => set("organisation", e.target.value)} />}
        </Field>
      </div>
      {devis && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Échéance souhaitée">
            {(p) => (
              <Select {...p} value={f.timeline} onChange={(e) => set("timeline", e.target.value)}>
                <option value="asap">Au plus vite</option>
                <option value="1_3_mois">Dans 1 à 3 mois</option>
                <option value="flexible">Pas de contrainte</option>
              </Select>
            )}
          </Field>
          <Field label="Téléphone" optional>
            {(p) => <Input {...p} type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />}
          </Field>
        </div>
      )}
      {devis && f.project === "refonte" && (
        <Field label="Adresse du site actuel">
          {(p) => <Input {...p} placeholder="https://www.mon-cabinet.fr" value={f.current_url} onChange={(e) => set("current_url", e.target.value)} />}
        </Field>
      )}
      <Field label={waitlist ? "Ce que vous attendez d'un espace client" : devis ? "Votre besoin" : "Votre message"} optional={devis || waitlist}>
        {(p) => (
          <Textarea
            {...p}
            rows={devis || waitlist ? 3 : 5}
            placeholder={devis ? "Pages souhaitées, exemples de sites que vous aimez, contraintes…" : undefined}
            value={f.message}
            onChange={(e) => set("message", e.target.value)}
          />
        )}
      </Field>
      {devis && <Checkbox checked={f.with_assistant} onChange={(e) => set("with_assistant", e.target.checked)} label="Je souhaite aussi intégrer Kanso Assistant à mon site." />}
      {/* Honeypot : invisible pour les humains. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Ne pas remplir
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
        </label>
      </div>
      <div>
        <Checkbox
          checked={f.consent}
          onChange={(e) => set("consent", e.target.checked)}
          label={
            <>
              J&apos;accepte que Kanso Solutions utilise ces informations pour répondre à ma demande, comme décrit dans la{" "}
              <Link href={siteHref("solutions", "/confidentialite")} target="_blank" className="text-accent underline-offset-2 hover:underline">
                politique de confidentialité
              </Link>
              .
            </>
          }
        />
        {fieldErrors.consent && <p className="mt-1 text-[13px] text-danger">{fieldErrors.consent}</p>}
      </div>
      <Button type="submit" size="lg" variant="accent" className="w-full" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
