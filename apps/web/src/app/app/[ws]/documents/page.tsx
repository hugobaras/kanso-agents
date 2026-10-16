"use client";

import { FileText, Settings2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { DpaCard } from "@/components/documents/dpa-card";
import { documentState, TYPE_LABEL } from "@/components/documents/meta";
import { DocumentSettingsDialog } from "@/components/documents/settings-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton, Stat, Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { DocumentItem } from "@/lib/types";

type List = {
  documents: DocumentItem[];
  next_cursor: string | null;
  counts: { pending_review: number; processing: number; done: number; this_month: number };
  dpa_accepted: boolean;
};

type Filter = "review" | "all";
type Upload = { name: string; state: "uploading" | "done" | "error"; error?: string };

export default function DocumentsPage() {
  const { ws, can, overview, refreshOverview } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("review");
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = filter === "review" ? "?review=pending_review" : "";
  const { data, mutate } = useApi<List>(wsPath(ws, `/documents${query}`), {
    refreshInterval: (d) => (d && d.counts.processing > 0 ? 2500 : 20_000),
  });

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 20);
    for (const file of list) {
      const item: Upload = { name: file.name, state: "uploading" };
      setUploads((u) => [item, ...u].slice(0, 8));
      const form = new FormData();
      form.set("file", file);
      try {
        await api(wsPath(ws, "/documents"), { form });
        setUploads((u) => u.map((x) => (x.name === file.name && x.state === "uploading" ? { ...x, state: "done" as const } : x)));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.name === file.name && x.state === "uploading" ? { ...x, state: "error" as const, error: errorMessage(e) } : x)));
        toast.error(`${file.name} refusé`, errorMessage(e));
      }
    }
    setFilter("all");
    await mutate();
    void refreshOverview();
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Documents" />
        <Skeleton className="h-64" />
      </>
    );
  }

  const quota = overview.entitlements.quotas.documents;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Factures et devis fournisseurs : Kanso extrait les informations, vous validez, le brouillon part en comptabilité."
        actions={
          can("admin") && (
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" /> Réglages
            </Button>
          )
        }
      />
      {!data.dpa_accepted ? (
        <DpaCard
          ws={ws}
          canAccept={can("owner")}
          onAccepted={() => {
            void mutate();
            void refreshOverview();
          }}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="À vérifier" value={data.counts.pending_review} />
            <Stat label="En cours d'analyse" value={data.counts.processing} />
            <Stat label="Brouillons créés" value={data.counts.done} />
            <Stat label="Ce mois-ci" value={<>{overview.usage.documents}<span className="text-base text-subtle"> / {quota}</span></>} />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
            }}
            className={cn(
              "mb-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft/60" : "border-line-strong bg-surface",
            )}
          >
            <UploadCloud className="size-8 text-accent" aria-hidden />
            <p className="mt-3 text-sm font-medium">Déposez vos factures ici</p>
            <p className="mt-1 text-[13px] text-muted">PDF, PNG ou JPEG · 10 Mo et 20 pages maximum par fichier</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()} disabled={!overview.entitlements.active}>
              Choisir des fichiers
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            {uploads.length > 0 && (
              <ul className="mt-4 w-full max-w-md space-y-1 text-left text-[13px]">
                {uploads.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded bg-paper px-3 py-1.5">
                    <span className="truncate">{u.name}</span>
                    <span className={cn(u.state === "error" ? "text-danger" : u.state === "done" ? "text-success" : "text-muted")}>
                      {u.state === "uploading" ? "Envoi…" : u.state === "done" ? "Reçu" : "Refusé"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card>
            <Tabs
              className="px-3"
              value={filter}
              onChange={setFilter}
              items={[
                { value: "review", label: "À vérifier", count: data.counts.pending_review },
                { value: "all", label: "Tous les documents" },
              ]}
            />
            {data.documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={filter === "review" ? "Rien à vérifier" : "Aucun document"}
                description={filter === "review" ? "Tous vos documents sont traités." : "Déposez une première facture pour voir Kanso à l'œuvre."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                      <th className="px-4 py-2.5 font-medium">Document</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">État</th>
                      <th className="px-4 py-2.5 text-right font-medium">Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((d) => {
                      const st = documentState(d);
                      return (
                        <tr key={d.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper" onClick={() => router.push(`/app/${ws}/documents/${d.id}`)}>
                          <td className="px-4 py-3">
                            <Link href={`/app/${ws}/documents/${d.id}`} className="font-medium" onClick={(e) => e.stopPropagation()}>
                              {d.filename}
                            </Link>
                            <p className="text-[13px] text-muted">
                              {formatBytes(d.size_bytes)}
                              {d.uploaded_by && ` · ${d.uploaded_by}`}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-muted">{d.document_type ? TYPE_LABEL[d.document_type] ?? d.document_type : "—"}</td>
                          <td className="px-4 py-3">
                            <Badge tone={st.tone} dot>
                              {st.label}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] text-muted">{formatDateTime(d.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
      <DocumentSettingsDialog ws={ws} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
