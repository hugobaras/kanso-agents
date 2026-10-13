"use client";

import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Connector = {
  id: string;
  name: string;
  category: "crm" | "calendar" | "accounting";
  description: string;
  fields: Array<{ key: string; label: string; secret: boolean; placeholder?: string }>;
  connected: boolean;
  active: boolean;
  allowed: boolean;
  failures: number;
};
type Data = {
  connectors: Connector[];
  custom_requests: Array<{ id: string; platform: string; title: string; status: string; created_at: string }>;
  custom_allowed: boolean;
};

const CATEGORY: Record<Connector["category"], string> = {
  crm: "CRM — chaque demande qualifiée crée ou met à jour un contact",
  calendar: "Agenda — disponibilités pour proposer un rendez-vous",
  accounting: "Comptabilité — destination des brouillons de documents",
};

const REQUEST_STATUS: Record<string, string> = { open: "Reçue", in_progress: "En cours", done: "Livrée", declined: "Déclinée" };

export default function IntegrationsPage() {
  const { ws, can } = useWorkspace();
  const toast = useToast();
  const { data, mutate } = useApi<Data>(wsPath(ws, "/integrations"));
  const [editing, setEditing] = useState<Connector | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [disconnect, setDisconnect] = useState<Connector | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [req, setReq] = useState({ platform: "", title: "", description: "" });

  if (!data) return <PageSpinner />;

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(wsPath(ws, `/integrations/${editing.id}`), { method: "PUT", body: { credentials: values } });
      const t = await api<{ ok: boolean; message: string }>(wsPath(ws, `/integrations/${editing.id}/test`), { method: "POST" });
      await mutate();
      setEditing(null);
      if (t.ok) toast.success(`${editing.name} connecté`, t.message);
      else toast.error(`${editing.name} enregistré mais injoignable`, t.message);
    } catch (e) {
      toast.error("Connexion impossible", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(wsPath(ws, "/integrations/custom-requests"), { body: req });
      toast.success("Demande envoyée", "L'équipe Kanso revient vers vous sous 2 jours ouvrés.");
      setReq({ platform: "", title: "", description: "" });
      setRequestOpen(false);
      await mutate();
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const groups = (["crm", "calendar", "accounting"] as const).map((cat) => ({ cat, items: data.connectors.filter((c) => c.category === cat) }));

  return (
    <>
      <PageHeader
        title="Intégrations"
        description="Connectez Kanso aux outils de votre cabinet. Les identifiants sont chiffrés et ne sont jamais réaffichés."
        actions={
          <Button variant="secondary" onClick={() => setRequestOpen(true)}>
            <Sparkles className="size-4" /> Demander une intégration
          </Button>
        }
      />
      <div className="space-y-8">
        {groups.map(({ cat, items }) => (
          <section key={cat}>
            <h2 className="mb-3 text-sm text-muted">{CATEGORY[cat]}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((c) => (
                <Card key={c.id} className="flex flex-col">
                  <CardBody className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-paper font-display text-lg">{c.name[0]}</span>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.connected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <CheckCircle2 className="size-3.5" /> Connecté
                            </span>
                          ) : (
                            <span className="text-xs text-subtle">Non connecté</span>
                          )}
                        </div>
                      </div>
                      {!c.allowed && (
                        <Badge tone="neutral">
                          <Lock className="size-3" /> Offre supérieure
                        </Badge>
                      )}
                      {c.failures > 0 && <Badge tone="warning">{c.failures} échec(s)</Badge>}
                    </div>
                    <p className="mt-3 text-[13px] text-muted">{c.description}</p>
                  </CardBody>
                  <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
                    {!c.allowed ? (
                      <Link href={`/app/${ws}/facturation`} className="text-sm font-medium text-accent hover:underline">
                        Voir les offres
                      </Link>
                    ) : can("admin") ? (
                      <>
                        {c.connected && (
                          <Button variant="ghost" size="sm" onClick={() => setDisconnect(c)}>
                            Déconnecter
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={c.connected ? "secondary" : "primary"}
                          onClick={() => {
                            setValues({});
                            setEditing(c);
                          }}
                        >
                          {c.connected ? "Mettre à jour" : "Connecter"}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-subtle">Réservé aux administrateurs</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {data.custom_requests.length > 0 && (
          <Card>
            <CardHeader title="Vos demandes d'intégration" />
            <ul className="divide-y divide-line">
              {data.custom_requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{r.platform}</span> — {r.title}
                    <span className="ml-2 text-xs text-subtle">{formatDate(r.created_at)}</span>
                  </span>
                  <Badge tone={r.status === "done" ? "success" : r.status === "in_progress" ? "info" : "neutral"}>{REQUEST_STATUS[r.status] ?? r.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Connecter ${editing?.name ?? ""}`}
        description="Les identifiants sont chiffrés (AES-256) et stockés dans l'Union européenne."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button loading={busy} onClick={save} disabled={!editing?.fields.every((f) => values[f.key]?.trim())}>
              Enregistrer et tester
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editing?.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {(p) => (
                <Input
                  {...p}
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!disconnect}
        onClose={() => setDisconnect(null)}
        danger
        title={`Déconnecter ${disconnect?.name} ?`}
        description="Les identifiants sont supprimés. Plus aucune donnée ne sera envoyée vers cet outil."
        confirmLabel="Déconnecter"
        onConfirm={async () => {
          if (!disconnect) return;
          await api(wsPath(ws, `/integrations/${disconnect.id}`), { method: "DELETE" });
          await mutate();
          toast.success(`${disconnect.name} déconnecté`);
          setDisconnect(null);
        }}
      />

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} title="Demander une intégration" description="Teams, WhatsApp, logiciel métier… Décrivez votre besoin, nous étudions chaque demande.">
        <form onSubmit={sendRequest} className="space-y-4">
          <Field label="Outil concerné">{(p) => <Input {...p} required placeholder="ex. Secib, Microsoft Teams" value={req.platform} onChange={(e) => setReq({ ...req, platform: e.target.value })} />}</Field>
          <Field label="Objet">{(p) => <Input {...p} required placeholder="ex. Créer un dossier pour chaque demande" value={req.title} onChange={(e) => setReq({ ...req, title: e.target.value })} />}</Field>
          <Field label="Description">{(p) => <Textarea {...p} required rows={4} value={req.description} onChange={(e) => setReq({ ...req, description: e.target.value })} />}</Field>
          {!data.custom_allowed && <p className="text-[13px] text-muted">Les développements sur mesure font l&apos;objet d&apos;un devis, sauf avec l&apos;offre Expert.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={busy}>
              Envoyer
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
