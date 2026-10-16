"use client";

import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { AiSettingsCard } from "@/components/portail/ai-settings-card";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import type { PortalSettings, PortalTemplateItem, PortalTemplates, Stage } from "@/lib/portail";

const STAGES: Array<[Stage, string]> = [
  ["a_completer", "Pièces manquantes"],
  ["en_verification", "Toutes les pièces reçues"],
  ["complet", "Toutes les pièces acceptées"],
  ["termine", "Dossier clôturé"],
];

/** « * » en début de ligne = pièce facultative. */
const toLines = (items: PortalTemplateItem[]) => items.map((i) => `${i.required ? "" : "* "}${i.label}`).join("\n");
const fromLines = (s: string): PortalTemplateItem[] =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("*") ? { label: l.replace(/^\*\s*/, ""), required: false } : { label: l, required: true }));

export default function PortailSettingsPage() {
  const { ws, can } = useWorkspace();
  const toast = useToast();
  const settings = useApi<PortalSettings>(wsPath(ws, "/portail/settings"));
  const templates = useApi<PortalTemplates>(wsPath(ws, "/portail/templates"));
  const [form, setForm] = useState<PortalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ id?: string; name: string; lines: string } | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (!form || !templates.data) return <PageSpinner />;
  const editable = can("admin");
  const set = <K extends keyof PortalSettings>(k: K, v: PortalSettings[K]) => setForm((f) => f && { ...f, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await api(wsPath(ws, "/portail/settings"), {
        method: "PUT",
        body: {
          display_name: form.display_name || null,
          welcome_message: form.welcome_message || null,
          brand_color: form.brand_color || null,
          retention_days: form.retention_days,
          reminders: form.reminders,
          stage_labels: form.stage_labels,
        },
      });
      toast.success("Réglages enregistrés");
      await settings.mutate();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    try {
      const res = await fetch(wsPath(ws, "/portail/settings/logo"), { method: "POST", body: file, credentials: "same-origin", headers: { "content-type": file.type } });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? "Logo refusé.");
      setLogoVersion((v) => v + 1);
      await settings.mutate();
      toast.success("Logo enregistré");
    } catch (err) {
      toast.error("Logo refusé", errorMessage(err));
    }
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const items = fromLines(editing.lines);
    try {
      if (editing.id) await api(wsPath(ws, `/portail/templates/${editing.id}`), { method: "PUT", body: { name: editing.name, items } });
      else await api(wsPath(ws, "/portail/templates"), { body: { name: editing.name, items } });
      setEditing(null);
      await templates.mutate();
      toast.success("Modèle enregistré");
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    }
  }

  return (
    <>
      <Link href={`/app/${ws}/portail`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Portail
      </Link>
      <PageHeader title="Réglages du portail" description="L'apparence de l'espace de vos clients, les relances et la conservation des documents." />
      {!editable && <Alert tone="info" className="mb-4">Seuls les administrateurs peuvent modifier ces réglages.</Alert>}

      <form onSubmit={save} className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader title="Votre marque" description="Vos clients voient le nom, le logo et la couleur de votre cabinet." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom affiché">{(p) => <Input {...p} disabled={!editable} maxLength={80} value={form.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} placeholder={form.workspace_name} />}</Field>
            <Field label="Couleur">
              {(p) => (
                <div className="flex items-center gap-2">
                  <input aria-label="Choisir la couleur" type="color" disabled={!editable} value={form.brand_color ?? "#1f6f6b"} onChange={(e) => set("brand_color", e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-line bg-surface p-1" />
                  <Input {...p} disabled={!editable} value={form.brand_color ?? ""} onChange={(e) => set("brand_color", e.target.value || null)} placeholder="#1F6F6B" pattern="^#[0-9a-fA-F]{6}$" />
                </div>
              )}
            </Field>
            <Field label="Message d'accueil" hint="Affiché en haut de l'espace client." className="sm:col-span-2">
              {(p) => <Textarea {...p} disabled={!editable} rows={2} maxLength={500} value={form.welcome_message ?? ""} onChange={(e) => set("welcome_message", e.target.value)} />}
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Logo</p>
              <div className="flex items-center gap-4">
                {form.has_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${wsPath(ws, "/portail/settings/logo")}?v=${logoVersion}`} alt="Logo actuel" className="h-12 max-w-40 rounded border border-line bg-white object-contain p-1" />
                ) : (
                  <span className="text-sm text-muted">Aucun logo</span>
                )}
                {editable && (
                  <>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="size-4" /> Importer
                    </Button>
                    {form.has_logo && (
                      <Button variant="ghost" size="sm" onClick={async () => { await api(wsPath(ws, "/portail/settings/logo"), { method: "DELETE" }); await settings.mutate(); }}>
                        Retirer
                      </Button>
                    )}
                    <span className="text-xs text-muted">PNG, JPEG ou WebP, 300 Ko max.</span>
                  </>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Relances automatiques" description="Un e-mail aux clients qui n'ont pas déposé toutes les pièces obligatoires." />
          <CardBody className="space-y-4">
            <Checkbox disabled={!editable} checked={form.reminders.enabled} onChange={(e) => set("reminders", { ...form.reminders, enabled: e.target.checked })} label="Activer les relances" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Première relance après (jours)">{(p) => <Input {...p} type="number" min={1} max={30} disabled={!editable || !form.reminders.enabled} value={form.reminders.first_after_days} onChange={(e) => set("reminders", { ...form.reminders, first_after_days: Number(e.target.value) })} />}</Field>
              <Field label="Puis tous les (jours)">{(p) => <Input {...p} type="number" min={1} max={30} disabled={!editable || !form.reminders.enabled} value={form.reminders.every_days} onChange={(e) => set("reminders", { ...form.reminders, every_days: Number(e.target.value) })} />}</Field>
              <Field label="Nombre maximum">{(p) => <Input {...p} type="number" min={0} max={10} disabled={!editable || !form.reminders.enabled} value={form.reminders.max} onChange={(e) => set("reminders", { ...form.reminders, max: Number(e.target.value) })} />}</Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Étapes du dossier" description="Renommez les étapes comme vous les nommez avec vos clients." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {STAGES.map(([key, hint]) => (
              <Field key={key} label={hint}>
                {(p) => <Input {...p} disabled={!editable} maxLength={40} value={form.stage_labels[key]} onChange={(e) => set("stage_labels", { ...form.stage_labels, [key]: e.target.value })} />}
              </Field>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Conservation" description="Les documents sont supprimés définitivement après la clôture du dossier. Le client et vous êtes prévenus 7 jours avant." />
          <CardBody>
            <Field label="Durée de conservation après clôture (jours)" className="max-w-xs">
              {(p) => <Input {...p} type="number" min={7} max={3650} disabled={!editable} value={form.retention_days} onChange={(e) => set("retention_days", Number(e.target.value))} />}
            </Field>
          </CardBody>
        </Card>

        {editable && (
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>Enregistrer</Button>
          </div>
        )}
      </form>

      <div className="mt-6 max-w-3xl">
        <AiSettingsCard />
      </div>

      <Card className="mt-6 max-w-3xl">
        <CardHeader
          title="Vos modèles de dossier"
          description="Ils s'ajoutent aux modèles Kanso dans « Nouveau dossier »."
          action={editable && <Button variant="secondary" size="sm" onClick={() => setEditing({ name: "", lines: "" })}><Plus className="size-4" /> Nouveau modèle</Button>}
        />
        <ul className="divide-y divide-line">
          {templates.data.custom.length === 0 && <li className="px-5 py-6 text-sm text-muted">Aucun modèle personnalisé.</li>}
          {templates.data.custom.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-[13px] text-muted">{t.items.length} pièce{t.items.length > 1 ? "s" : ""}</p>
              </div>
              {editable && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ id: t.id, name: t.name, lines: toLines(t.items) })}>Modifier</Button>
                  <Button variant="ghost" size="sm" aria-label={`Supprimer ${t.name}`} onClick={async () => { await api(wsPath(ws, `/portail/templates/${t.id}`), { method: "DELETE" }); await templates.mutate(); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Modifier le modèle" : "Nouveau modèle"}>
        <form onSubmit={saveTemplate} className="space-y-4">
          <Field label="Nom du modèle">{(p) => <Input {...p} required autoFocus maxLength={100} value={editing?.name ?? ""} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} />}</Field>
          <Field label="Pièces, une par ligne" hint="Commencez la ligne par « * » pour une pièce facultative.">
            {(p) => <Textarea {...p} rows={8} value={editing?.lines ?? ""} onChange={(e) => setEditing((v) => v && { ...v, lines: e.target.value })} placeholder={"Pièce d'identité\nJustificatif de domicile\n* Contrat de mariage"} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
