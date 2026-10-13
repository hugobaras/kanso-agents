"use client";

import { CheckCircle2, Globe2, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";

type Existing = { request: { id: string; status: string; created_at: string } | null };

const INCLUDED = [
  "Site vitrine sobre et responsive, à vos couleurs",
  "Rédaction adaptée à votre profession et à sa déontologie",
  "Assistant Kanso installé et vérifié dès la mise en ligne",
  "Mentions légales et pages RGPD prêtes",
];

/**
 * "Pas encore de site ?" — offers website creation by Kanso Solutions.
 * The request goes to the sales team (quote), never billed automatically.
 */
export function WebsiteOffer({ ws, variant = "card", className }: { ws: string; variant?: "card" | "compact"; className?: string }) {
  const toast = useToast();
  const { data, mutate } = useApi<Existing>(wsPath(ws, "/integrations/website-request"));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: "creation", current_url: "", timeline: "flexible", phone: "", message: "" });
  const pending = data?.request && ["open", "in_progress"].includes(data.request.status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(wsPath(ws, "/integrations/website-request"), {
        body: {
          kind: form.kind,
          timeline: form.timeline,
          current_url: form.current_url || undefined,
          phone: form.phone || undefined,
          message: form.message || undefined,
        },
      });
      await mutate();
      setOpen(false);
      toast.success("Demande envoyée", "L'équipe Kanso Solutions revient vers vous sous deux jours ouvrés.");
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={cn("rounded-xl border border-line bg-surface", variant === "card" ? "p-6" : "p-5", className)}>
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LayoutTemplate className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Pas encore de site, ou un site à rafraîchir ?</p>
            <p className="mt-1 text-sm text-muted">
              Kanso Site conçoit le site professionnel de votre cabinet, avec l&apos;assistant déjà intégré. Sur devis, sans engagement.
            </p>
            {variant === "card" && (
              <ul className="mt-4 space-y-2">
                {INCLUDED.map((i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> {i}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              {pending ? (
                <p className="inline-flex items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
                  <Globe2 className="size-4" />
                  Demande {data!.request!.status === "in_progress" ? "en cours de traitement" : "envoyée"} — nous revenons vers vous.
                </p>
              ) : (
                <Button variant={variant === "card" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
                  Demander un devis gratuit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Votre site par Kanso Site"
        description="Quelques informations pour préparer l'échange. Un membre de l'équipe vous recontactera pour établir un devis."
      >
        <form onSubmit={submit} className="space-y-4">
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
                    form.kind === v ? "border-accent bg-accent-soft/60" : "border-line-strong hover:bg-paper",
                  )}
                >
                  <input type="radio" className="sr-only" checked={form.kind === v} onChange={() => setForm({ ...form, kind: v })} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          {form.kind === "refonte" && (
            <Field label="Adresse du site actuel">
              {(p) => <Input {...p} placeholder="https://www.mon-cabinet.fr" value={form.current_url} onChange={(e) => setForm({ ...form, current_url: e.target.value })} />}
            </Field>
          )}
          <Field label="Échéance souhaitée">
            {(p) => (
              <Select {...p} value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
                <option value="asap">Au plus vite</option>
                <option value="1_3_mois">Dans 1 à 3 mois</option>
                <option value="flexible">Pas de contrainte</option>
              </Select>
            )}
          </Field>
          <Field label="Téléphone" optional hint="Pour convenir plus facilement d'un échange.">
            {(p) => <Input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
          </Field>
          <Field label="Votre besoin" optional>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                placeholder="Domaines d'activité à présenter, pages souhaitées, exemples de sites que vous aimez…"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            )}
          </Field>
          <p className="text-xs text-muted">
            Prestation distincte de l&apos;abonnement Kanso, facturée sur devis accepté. Aucun engagement à ce stade.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={busy}>
              Envoyer ma demande
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
