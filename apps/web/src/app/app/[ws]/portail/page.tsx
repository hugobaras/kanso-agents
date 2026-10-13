"use client";

import { FolderLock, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert, EmptyState, PageHeader, Progress, Tabs } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, errorMessage, useApi, wsPath } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { STAGE_TONE, type PortalList, type Stage } from "@/lib/portail";

type Filter = "all" | Stage;

function AccessRequest() {
  const { ws, overview } = useWorkspace();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(wsPath(ws, "/integrations/custom-requests"), {
        body: {
          platform: "Kanso Portail",
          title: "Accès à Kanso Portail (bêta)",
          description: message.trim().length >= 10 ? message : `Demande d'accès à la bêta de Kanso Portail pour ${overview.workspace.name}.`,
        },
      });
      setSent(true);
    } catch (err) {
      toast.error("Envoi impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Portail" description="Récupérez les pièces de vos clients, sans compte et depuis leur téléphone." />
      <Card className="max-w-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
            <FolderLock className="size-5" />
          </span>
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Kanso Portail est en bêta fermée</h2>
            <p className="text-sm text-muted">
              Ouvrez un dossier, listez les pièces à fournir : votre client les dépose depuis un lien personnel, chiffrées de bout en bout
              sur nos serveurs en Europe, et vous suivez l&apos;avancement. Nous activons le module cabinet par cabinet.
            </p>
            {sent ? (
              <Alert tone="success">Demande envoyée. Nous revenons vers vous sous deux jours ouvrés.</Alert>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <Field label="Un mot sur votre usage (facultatif)">{(p) => <Textarea {...p} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. bilans annuels, ouverture de dossiers clients…" />}</Field>
                <Button type="submit" loading={busy}>
                  Demander l&apos;accès
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

export default function PortailPage() {
  const { ws, can } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const qs = new URLSearchParams();
  if (filter !== "all") qs.set("stage", filter);
  if (q.trim()) qs.set("q", q.trim());
  const { data, error } = useApi<PortalList>(wsPath(ws, `/portail${qs.size ? `?${qs}` : ""}`), { keepPreviousData: true });

  if (error instanceof ApiError && error.code === "module_not_in_plan") return <AccessRequest />;
  if (!data) return <PageSpinner />;
  const labels = data.stage_labels;
  const full = data.active >= data.max_active;

  return (
    <>
      <PageHeader
        title="Portail"
        description={`${data.active} dossier${data.active > 1 ? "s" : ""} actif${data.active > 1 ? "s" : ""} sur ${data.max_active}.`}
        actions={
          <>
            {can("admin") && (
              <ButtonLink href={`/app/${ws}/portail/reglages`} variant="secondary">
                <Settings className="size-4" /> Réglages
              </ButtonLink>
            )}
            <ButtonLink href={`/app/${ws}/portail/nouveau`} aria-disabled={full}>
              <Plus className="size-4" /> Nouveau dossier
            </ButtonLink>
          </>
        }
      />
      {full && <Alert tone="warning" className="mb-4">Limite de dossiers actifs atteinte : terminez un dossier pour en ouvrir un nouveau.</Alert>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "Tous" },
            { value: "a_completer", label: labels.a_completer },
            { value: "en_verification", label: labels.en_verification },
            { value: "complet", label: labels.complet },
            { value: "termine", label: labels.termine },
          ]}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un dossier" />
        </div>
      </div>

      {data.dossiers.length === 0 ? (
        <EmptyState
          title={filter === "all" && !q ? "Aucun dossier pour l'instant" : "Aucun dossier ne correspond"}
          description="Ouvrez un dossier à partir d'un modèle : votre client reçoit un lien par e-mail."
          action={<ButtonLink href={`/app/${ws}/portail/nouveau`}>Ouvrir un dossier</ButtonLink>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.dossiers.map((d) => (
              <li key={d.id}>
                <Link href={`/app/${ws}/portail/${d.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-paper sm:flex-row sm:items-center sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.title} {d.unread_messages > 0 && <Badge tone="accent" className="ml-1">{d.unread_messages} message{d.unread_messages > 1 ? "s" : ""}</Badge>}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {d.reference} · {d.client_name || "Client non renseigné"} · mis à jour {timeAgo(d.updated_at)}
                    </p>
                  </div>
                  <div className="w-full sm:w-40">
                    <div className="mb-1 flex justify-between text-xs text-muted">
                      <span>Pièces</span>
                      <span>
                        {d.items_provided}/{d.items_total}
                      </span>
                    </div>
                    <Progress value={d.items_provided} max={Math.max(1, d.items_total)} tone="accent" />
                  </div>
                  <Badge tone={STAGE_TONE[d.stage]} dot>
                    {labels[d.stage]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
