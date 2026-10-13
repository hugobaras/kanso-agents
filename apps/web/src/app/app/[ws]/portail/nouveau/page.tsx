"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import type { PortalTemplateItem, PortalTemplates } from "@/lib/portail";

type Lead = { lead: { contact: { name?: string; email?: string } } };

function NewDossier() {
  const { ws } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const leadId = useSearchParams().get("lead");
  const templates = useApi<PortalTemplates>(wsPath(ws, "/portail/templates"));
  const lead = useApi<Lead>(leadId ? wsPath(ws, `/leads/${leadId}`) : null);

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [kind, setKind] = useState<"particulier" | "entreprise">("particulier");
  const [template, setTemplate] = useState("libre");
  const [items, setItems] = useState<PortalTemplateItem[]>([]);
  const [contacts, setContacts] = useState<Array<{ email: string; name: string }>>([{ email: "", name: "" }]);
  const [message, setMessage] = useState("");
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = lead.data?.lead.contact;
    if (c) {
      setClientName((v) => v || c.name || "");
      setContacts((cs) => (cs.length === 1 && !cs[0]!.email ? [{ email: c.email ?? "", name: c.name ?? "" }] : cs));
    }
  }, [lead.data]);

  function pick(key: string) {
    setTemplate(key);
    const sys = templates.data?.system.find((t) => t.key === key);
    const cus = templates.data?.custom.find((t) => t.id === key);
    const chosen = sys ?? cus;
    if (chosen) {
      setItems(chosen.items.map((i) => ({ ...i })));
      if (sys && sys.client_kind !== "both") setKind(sys.client_kind as "particulier" | "entreprise");
      if (!title && key !== "libre") setTitle(chosen.name);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ id: string }>(wsPath(ws, "/portail/dossiers"), {
        body: {
          title,
          client_name: clientName,
          client_kind: kind,
          items: items.filter((i) => i.label.trim()),
          contacts: contacts.filter((c) => c.email.trim()),
          message: message.trim() || null,
          lead_id: leadId || null,
          send,
        },
      });
      toast.success("Dossier ouvert", send ? "Le client a reçu son lien par e-mail." : undefined);
      router.push(`/app/${ws}/portail/${r.id}`);
    } catch (err) {
      toast.error("Création impossible", errorMessage(err));
      setBusy(false);
    }
  }

  if (!templates.data) return <PageSpinner />;

  return (
    <>
      <Link href={`/app/${ws}/portail`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Portail
      </Link>
      <PageHeader title="Nouveau dossier" description="Choisissez un modèle, ajustez la liste des pièces, puis envoyez le lien à votre client." />
      <form onSubmit={submit} className="grid max-w-3xl gap-6">
        {leadId && <Alert tone="info">Les coordonnées viennent de la demande reçue via votre assistant.</Alert>}
        <Card>
          <CardHeader title="Le dossier" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Modèle" className="sm:col-span-2">
              {(p) => (
                <Select {...p} value={template} onChange={(e) => pick(e.target.value)}>
                  <optgroup label="Modèles Kanso">
                    {templates.data!.system.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                  {templates.data!.custom.length > 0 && (
                    <optgroup label="Vos modèles">
                      {templates.data!.custom.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              )}
            </Field>
            <Field label="Intitulé du dossier">{(p) => <Input {...p} required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Bilan 2026" />}</Field>
            <Field label="Nom du client">{(p) => <Input {...p} maxLength={160} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex. SARL Dupont" />}</Field>
            <Field label="Type de client">
              {(p) => (
                <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as "particulier" | "entreprise")}>
                  <option value="particulier">Particulier</option>
                  <option value="entreprise">Entreprise</option>
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pièces à fournir" description="Facultatives : le dossier peut être complet sans elles." />
          <CardBody className="space-y-3">
            {items.length === 0 && <p className="text-sm text-muted">Aucune pièce. Ajoutez-en ci-dessous.</p>}
            {items.map((it, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-start">
                <div className="flex-1 space-y-2">
                  <Input aria-label={`Pièce ${i + 1}`} value={it.label} maxLength={160} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Nom de la pièce" />
                  <Input aria-label={`Précision ${i + 1}`} value={it.hint ?? ""} maxLength={300} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} placeholder="Précision pour le client (facultatif)" />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox checked={it.required} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} label="Obligatoire" />
                  <Button variant="ghost" size="sm" aria-label={`Retirer la pièce ${i + 1}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setItems((l) => [...l, { label: "", hint: "", required: true }])}>
              <Plus className="size-4" /> Ajouter une pièce
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Destinataires" description="Chaque adresse reçoit son propre lien personnel (5 maximum)." />
          <CardBody className="space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label={`Adresse e-mail ${i + 1}`} type="email" required={i === 0} value={c.email} onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} placeholder="client@exemple.fr" />
                <Input aria-label={`Nom ${i + 1}`} value={c.name} maxLength={120} onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Nom (facultatif)" />
                {contacts.length > 1 && (
                  <Button variant="ghost" size="sm" aria-label="Retirer" onClick={() => setContacts((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {contacts.length < 5 && (
              <Button variant="secondary" size="sm" onClick={() => setContacts((l) => [...l, { email: "", name: "" }])}>
                <Plus className="size-4" /> Ajouter une adresse
              </Button>
            )}
            <Field label="Message pour le client (facultatif)" hint="Il figure dans l'e-mail d'invitation et en haut du dossier.">
              {(p) => <Textarea {...p} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />}
            </Field>
            <Checkbox checked={send} onChange={(e) => setSend(e.target.checked)} label="Envoyer le lien par e-mail maintenant" />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" loading={busy}>
            Ouvrir le dossier
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewDossierPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <NewDossier />
    </Suspense>
  );
}
