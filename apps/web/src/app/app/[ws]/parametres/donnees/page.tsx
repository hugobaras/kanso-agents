"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { DpaCard } from "@/components/documents/dpa-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { siteHref } from "@/lib/sites";

type Privacy = {
  dpa: { current_version: string; accepted: boolean; up_to_date: boolean; accepted_version: string | null; accepted_at: string | null; accepted_by: string | null };
  retention_days: { conversations: number; documents: number; audit: number };
  subprocessors: Array<{ name: string; role: string; location: string }>;
  requests: Array<{ id: string; kind: "export" | "delete"; status: string; created_at: string; completed_at: string | null; error: string | null }>;
  scheduled_deletion_at: string | null;
};

const REQ_STATUS: Record<string, string> = { pending: "En attente", running: "En cours", done: "Terminé", failed: "Échec" };

export default function DataPage() {
  const { ws, can } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const { data, mutate } = useApi<Privacy>(wsPath(ws, "/settings/privacy"), {
    refreshInterval: (d) => (d?.requests.some((r) => r.status === "pending" || r.status === "running") ? 4000 : 0),
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <PageSpinner />;
  const owner = can("owner");

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      await mutate();
      toast.success(ok);
    } catch (e) {
      toast.error("Action impossible", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href={`/app/${ws}/parametres`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Paramètres
      </Link>
      <PageHeader title="Données et RGPD" description="Vous restez responsable de traitement ; Kanso agit comme sous-traitant." />
      <div className="max-w-3xl space-y-6">
        {data.scheduled_deletion_at && (
          <Alert
            tone="danger"
            title={`Suppression programmée le ${formatDate(data.scheduled_deletion_at)}`}
            action={
              owner && (
                <Button size="sm" variant="secondary" loading={busy === "cancel"} onClick={() => run("cancel", () => api(wsPath(ws, "/settings/delete/cancel"), { method: "POST" }), "Suppression annulée")}>
                  Annuler la suppression
                </Button>
              )
            }
          >
            L&apos;assistant est désactivé. Toutes les données seront définitivement effacées à cette date.
          </Alert>
        )}

        {data.dpa.up_to_date ? (
          <Card>
            <CardHeader title="Accord de traitement des données" action={<Badge tone="success">Accepté</Badge>} />
            <CardBody className="text-sm text-muted">
              Version {data.dpa.accepted_version}, acceptée le {formatDateTime(data.dpa.accepted_at)} par {data.dpa.accepted_by}.{" "}
              <a href={siteHref("assistant", "/legal/dpa")} target="_blank" className="text-accent hover:underline">
                Consulter
              </a>
            </CardBody>
          </Card>
        ) : (
          <DpaCard ws={ws} canAccept={owner} onAccepted={() => void mutate()} />
        )}

        <Card>
          <CardHeader title="Durées de conservation" />
          <CardBody>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-muted">Conversations et demandes</dt>
                <dd className="font-medium">{data.retention_days.conversations} jours</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Documents</dt>
                <dd className="font-medium">{data.retention_days.documents} jours</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Journal d&apos;audit</dt>
                <dd className="font-medium">{data.retention_days.audit} jours</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] text-muted">Purge automatique quotidienne. Exportez vos demandes si vous devez les conserver plus longtemps.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sous-traitants ultérieurs" />
          <table className="w-full text-sm">
            <tbody>
              {data.subprocessors.map((s) => (
                <tr key={s.name} className="border-t border-line first:border-0">
                  <td className="px-5 py-2.5 font-medium">{s.name}</td>
                  <td className="px-5 py-2.5 text-muted">{s.role}</td>
                  <td className="px-5 py-2.5 text-right text-muted">{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Export des données" description="Toutes les données de l'espace au format JSON (portabilité, art. 20)." />
          <CardBody>
            {data.requests.filter((r) => r.kind === "export").length === 0 ? (
              <p className="text-sm text-muted">Aucun export pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.requests
                  .filter((r) => r.kind === "export")
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <span>
                        {formatDateTime(r.created_at)} · {REQ_STATUS[r.status]}
                      </span>
                      {r.status === "done" && r.completed_at && Date.now() - new Date(r.completed_at).getTime() < 86_400_000 && (
                        <a href={wsPath(ws, `/settings/privacy/export/${r.id}`)} className="inline-flex items-center gap-1 text-accent hover:underline">
                          <Download className="size-4" /> Télécharger
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </CardBody>
          {owner && (
            <CardFooter>
              <Button variant="secondary" loading={busy === "export"} onClick={() => run("export", () => api(wsPath(ws, "/settings/privacy/export"), { method: "POST" }), "Export demandé : vous recevrez un e-mail")}>
                Demander un export
              </Button>
            </CardFooter>
          )}
        </Card>

        {owner && !data.scheduled_deletion_at && (
          <Card className="border-[#f0c9c1]">
            <CardHeader title="Supprimer l'espace" description="L'assistant est désactivé immédiatement ; les données sont effacées après 30 jours, délai pendant lequel vous pouvez annuler." />
            <CardFooter className="bg-danger-soft/40">
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Supprimer l&apos;espace
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer définitivement l'espace ?"
        description={
          <>
            Saisissez <strong className="font-mono text-ink">{ws}</strong> pour confirmer. Pensez à résilier votre abonnement depuis la page
            Facturation.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={confirm !== ws}
              loading={busy === "delete"}
              onClick={async () => {
                setBusy("delete");
                try {
                  await api(wsPath(ws, "/settings/delete"), { body: { confirm } });
                  toast.success("Suppression programmée dans 30 jours");
                  setDeleteOpen(false);
                  await mutate();
                  router.refresh();
                } catch (e) {
                  toast.error("Suppression impossible", errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={ws} aria-label="Confirmation" />
      </Dialog>
    </>
  );
}
