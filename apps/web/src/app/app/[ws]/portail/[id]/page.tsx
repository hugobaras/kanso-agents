"use client";

import { ArrowLeft, Check, Download, FileText, Mail, Plus, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { AiPanel } from "@/components/portail/ai-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert, EmptyState, Progress } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatBytes, formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { ITEM_STATUS_LABEL, ITEM_STATUS_TONE, STAGE_TONE, type PortalDossierDetail } from "@/lib/portail";

export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const { ws, can } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const { data, error, mutate } = useApi<PortalDossierDetail>(wsPath(ws, `/portail/dossiers/${id}`));
  const base = wsPath(ws, `/portail/dossiers/${id}`);

  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [newItem, setNewItem] = useState<{ label: string; required: boolean } | null>(null);
  const [newContact, setNewContact] = useState<{ email: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="Dossier introuvable" action={<Link href={`/app/${ws}/portail`} className="text-accent hover:underline">Retour au portail</Link>} />;
  }
  if (!data) return <PageSpinner />;
  const { dossier: d, stage_labels: labels } = data;
  const closed = d.stage === "termine";

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await mutate();
    } catch (e) {
      toast.error("Action impossible", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href={`/app/${ws}/portail`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Portail
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] leading-tight">{d.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {d.reference} · {d.client_name || "Client non renseigné"} · ouvert le {formatDate(d.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STAGE_TONE[d.stage]} dot>
            {labels[d.stage]}
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => (window.location.href = `${base}/export`)} disabled={data.progress.provided === 0}>
            <Download className="size-4" /> Exporter (ZIP)
          </Button>
          {closed ? (
            <Button variant="secondary" size="sm" loading={busy} onClick={() => run(() => api(`${base}/reopen`, { method: "POST" }), "Dossier rouvert")}>
              Rouvrir
            </Button>
          ) : (
            <Button size="sm" loading={busy} onClick={() => run(() => api(`${base}/close`, { method: "POST" }), "Dossier terminé")}>
              Terminer le dossier
            </Button>
          )}
        </div>
      </div>

      {closed && d.purge_at && (
        <Alert tone="info" className="mb-4">
          Les documents seront supprimés définitivement le {formatDate(d.purge_at)}. Exportez-les avant si besoin.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Pièces"
              description={`${data.progress.provided} sur ${data.progress.total} fournies`}
              action={
                !closed && (
                  <Button variant="secondary" size="sm" onClick={() => setNewItem({ label: "", required: true })}>
                    <Plus className="size-4" /> Ajouter
                  </Button>
                )
              }
            />
            <div className="px-5 pt-4">
              <Progress value={data.progress.provided} max={Math.max(1, data.progress.total)} tone="accent" />
            </div>
            <ul className="divide-y divide-line">
              {data.items.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Aucune pièce demandée.</li>}
              {data.items.map((it) => (
                <li key={it.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {it.label} {!it.required && <span className="font-normal text-muted">(facultative)</span>}
                      </p>
                      {it.hint && <p className="text-[13px] text-muted">{it.hint}</p>}
                      {it.status === "refused" && it.refusal_reason && <p className="mt-1 text-[13px] text-danger">Refusée : {it.refusal_reason}</p>}
                    </div>
                    <Badge tone={ITEM_STATUS_TONE[it.status]}>{ITEM_STATUS_LABEL[it.status]}</Badge>
                  </div>
                  {it.files.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {it.files.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm">
                          <FileText className="size-4 shrink-0 text-subtle" />
                          <a href={`${base}/files/${f.id}`} className="min-w-0 flex-1 truncate text-accent hover:underline" download>
                            {f.filename}
                          </a>
                          <span className="shrink-0 text-xs text-muted">
                            {formatBytes(f.size_bytes)} · {timeAgo(f.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!closed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {it.files.length > 0 && it.status !== "accepted" && (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api(`${base}/items/${it.id}/accept`, { method: "POST" }), "Pièce acceptée")}>
                          <Check className="size-4" /> Accepter
                        </Button>
                      )}
                      {it.files.length > 0 && it.status !== "refused" && (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setReason(""); setRefusing(it.id); }}>
                          <X className="size-4" /> Refuser
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`${base}/items/${it.id}`, { method: "DELETE" }), "Pièce retirée")} aria-label={`Retirer ${it.label}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <AiPanel
            dossierId={d.id}
            excluded={d.ai_excluded}
            files={Object.fromEntries(data.items.flatMap((i) => i.files.map((f) => [f.id, f.filename])))}
            items={data.items}
            onChanged={() => void mutate()}
          />

          <Card>
            <CardHeader title="Messages" description="Court échange rattaché au dossier. Le client est prévenu par e-mail." />
            <CardBody className="space-y-3">
              {data.messages.length === 0 && <p className="text-sm text-muted">Aucun message.</p>}
              {data.messages.map((m) => (
                <div key={m.id} className={m.author_kind === "cabinet" ? "ml-8 rounded-lg bg-accent-soft px-3.5 py-2.5" : "mr-8 rounded-lg bg-sunken px-3.5 py-2.5"}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {m.author_kind === "cabinet" ? "Cabinet" : "Client"} · {formatDateTime(m.created_at)}
                  </p>
                </div>
              ))}
              <form
                className="flex gap-2 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!msg.trim()) return;
                  void run(async () => {
                    await api(`${base}/messages`, { body: { body: msg.trim() } });
                    setMsg("");
                  });
                }}
              >
                <Input aria-label="Votre message" value={msg} maxLength={1000} onChange={(e) => setMsg(e.target.value)} placeholder="Écrire au client…" />
                <Button type="submit" disabled={!msg.trim()} loading={busy}>
                  <Send className="size-4" /> Envoyer
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Client"
              action={
                data.contacts.length < 5 && (
                  <Button variant="ghost" size="sm" onClick={() => setNewContact({ email: "", name: "" })} aria-label="Ajouter une adresse">
                    <Plus className="size-4" />
                  </Button>
                )
              }
            />
            <ul className="divide-y divide-line">
              {data.contacts.map((c) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <p className="truncate font-medium">{c.name || c.email}</p>
                  {c.name && <p className="truncate text-[13px] text-muted">{c.email}</p>}
                  <p className="text-xs text-subtle">{c.last_access_at ? `Dernier accès ${timeAgo(c.last_access_at)}` : "Pas encore ouvert"}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api(`${base}/contacts/${c.id}/resend`, { method: "POST" }), "Nouveau lien envoyé")}>
                      <Mail className="size-4" /> Renvoyer le lien
                    </Button>
                    {data.contacts.length > 1 && (
                      <Button size="sm" variant="ghost" disabled={busy} aria-label={`Retirer ${c.email}`} onClick={() => run(() => api(`${base}/contacts/${c.id}`, { method: "DELETE" }), "Adresse retirée")}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {can("admin") && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Supprimer définitivement
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!refusing} onClose={() => setRefusing(null)} title="Refuser cette pièce" description="Le client reçoit un e-mail et peut déposer un nouveau document.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const itemId = refusing;
            setRefusing(null);
            void run(() => api(`${base}/items/${itemId}/refuse`, { body: { reason: reason.trim() } }), "Pièce refusée");
          }}
        >
          <Field label="Motif (visible par le client)">{(p) => <Textarea {...p} rows={3} maxLength={400} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. document illisible, page manquante…" />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRefusing(null)}>Annuler</Button>
            <Button type="submit">Refuser</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!newItem} onClose={() => setNewItem(null)} title="Ajouter une pièce">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const it = newItem!;
            setNewItem(null);
            void run(() => api(`${base}/items`, { body: it }), "Pièce ajoutée");
          }}
        >
          <Field label="Nom de la pièce">{(p) => <Input {...p} required autoFocus maxLength={160} value={newItem?.label ?? ""} onChange={(e) => setNewItem((v) => v && { ...v, label: e.target.value })} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewItem(null)}>Annuler</Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!newContact} onClose={() => setNewContact(null)} title="Ajouter une adresse" description="Cette personne reçoit son propre lien personnel.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const c = newContact!;
            setNewContact(null);
            void run(() => api(`${base}/contacts`, { body: c }), "Lien envoyé");
          }}
        >
          <Field label="Adresse e-mail">{(p) => <Input {...p} type="email" required autoFocus value={newContact?.email ?? ""} onChange={(e) => setNewContact((v) => v && { ...v, email: e.target.value })} />}</Field>
          <Field label="Nom (facultatif)">{(p) => <Input {...p} maxLength={120} value={newContact?.name ?? ""} onChange={(e) => setNewContact((v) => v && { ...v, name: e.target.value })} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewContact(null)}>Annuler</Button>
            <Button type="submit">Envoyer le lien</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title="Supprimer ce dossier ?"
        description="Les documents et messages seront effacés définitivement, sans possibilité de récupération."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          try {
            await api(base, { method: "DELETE" });
            router.replace(`/app/${ws}/portail`);
          } catch (e) {
            toast.error("Suppression impossible", errorMessage(e));
            setConfirmDelete(false);
          }
        }}
      />
    </>
  );
}
