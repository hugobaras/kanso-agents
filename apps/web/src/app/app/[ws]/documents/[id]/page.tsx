"use client";

import { ArrowLeft, Check, CircleAlert, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { ANOMALY_LABEL, documentState, FIELD_LABEL, TYPE_LABEL } from "@/components/documents/meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/form";
import { Alert, EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { DocumentItem } from "@/lib/types";

type Detail = {
  document: DocumentItem;
  fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  expected_fields: string[];
  min_confidence: number;
  validation: {
    status?: string;
    reason?: string | null;
    message?: string | null;
    checks?: Array<{ id: string; kind: string; ok: boolean; message?: string }>;
  } | null;
  extracted_text: string | null;
  page_count: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  history: Array<{ at: string; step: string; decision: string; actor: string }>;
};

const CHECK_LABEL: Record<string, string> = {
  confidence_min: "Fiabilité de lecture",
  totals_coherent: "Cohérence des totaux",
  iban_allowlist: "IBAN connu",
  duplicate_check: "Absence de doublon",
  approval_threshold: "Seuil de montant",
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ws, refreshOverview, overview } = useWorkspace();
  const toast = useToast();
  const { data, error, mutate } = useApi<Detail>(wsPath(ws, `/documents/${id}`), {
    refreshInterval: (d) => (d && ["pending", "running"].includes(d.document.status) ? 2000 : 0),
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"approve" | "reject" | "retry" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!data) return;
    const keys = [...new Set([...data.expected_fields, ...Object.keys(data.fields)])];
    setFields(Object.fromEntries(keys.map((k) => [k, data.fields[k] === undefined || data.fields[k] === null ? "" : String(data.fields[k])])));
  }, [data]);

  if (error) return <EmptyState title="Document introuvable" description={errorMessage(error)} />;
  if (!data) return <PageSpinner />;
  const doc = data.document;
  const st = documentState(doc);
  const reviewable = doc.review_status === "pending_review";
  const processing = doc.status === "pending" || doc.status === "running";

  const changed = Object.fromEntries(
    Object.entries(fields)
      .filter(([k, v]) => String(data.fields[k] ?? "") !== v)
      .map(([k, v]) => {
        const numeric = ["total_ht", "vat_amount", "total_ttc", "line_items_count"].includes(k);
        const n = Number(v.replace(/\s/g, "").replace(",", "."));
        return [k, v === "" ? null : numeric && Number.isFinite(n) ? n : v];
      }),
  );

  async function act(kind: "approve" | "reject" | "retry") {
    setBusy(kind);
    try {
      await api(wsPath(ws, `/documents/${id}/${kind}`), {
        body: kind === "approve" ? { fields: Object.keys(changed).length ? changed : undefined } : kind === "reject" ? { reason: reason || undefined } : {},
      });
      await mutate();
      void refreshOverview();
      if (kind === "approve") {
        toast.success("Document validé", "Le brouillon est en cours d'envoi vers votre logiciel comptable.");
        router.push(`/app/${ws}/documents`);
      } else if (kind === "reject") {
        setRejectOpen(false);
        toast.success("Document rejeté");
      } else toast.success("Nouvelle analyse lancée");
    } catch (e) {
      toast.error("Action impossible", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const fileUrl = wsPath(ws, `/documents/${id}/file`);
  const isPdf = doc.mime_type === "application/pdf";

  return (
    <>
      <Link href={`/app/${ws}/documents`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Documents
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-[26px]">{doc.filename}</h1>
          <p className="mt-1 text-sm text-muted">
            {doc.document_type ? TYPE_LABEL[doc.document_type] : "Type inconnu"}
            {data.page_count ? ` · ${data.page_count} page${data.page_count > 1 ? "s" : ""}` : ""} · reçu le {formatDateTime(doc.created_at)}
          </p>
        </div>
        <Badge tone={st.tone} dot className="self-start text-sm sm:self-auto">
          {st.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          {isPdf ? (
            <iframe src={`${fileUrl}#view=FitH`} title={`Aperçu de ${doc.filename}`} className="h-[72vh] w-full bg-sunken" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={`Aperçu de ${doc.filename}`} className="max-h-[72vh] w-full object-contain bg-sunken" />
          )}
        </Card>

        <div className="space-y-6">
          {processing && <Alert tone="info" title="Analyse en cours">Extraction du texte et des montants… cette page se met à jour toute seule.</Alert>}
          {reviewable && data.validation?.message && (
            <Alert tone={doc.step === "anomaly" ? "warning" : "info"} title={ANOMALY_LABEL[data.validation.reason ?? ""] ?? "À vérifier"}>
              {data.validation.message}
            </Alert>
          )}
          {doc.status === "failed" && doc.review_status !== "rejected" && (
            <Alert tone="danger" title="Traitement échoué" action={<Button size="sm" variant="secondary" loading={busy === "retry"} onClick={() => act("retry")}><RotateCw className="size-4" /> Relancer</Button>}>
              {doc.anomaly ?? "Erreur inconnue."}
            </Alert>
          )}
          {doc.remote_id && (
            <Alert tone="success" title="Brouillon créé">
              Référence {doc.remote_id}
              {data.reviewed_by && ` · validé par ${data.reviewed_by} le ${formatDateTime(data.reviewed_at)}`}
            </Alert>
          )}

          <Card>
            <CardHeader
              title="Informations extraites"
              description={reviewable ? "Corrigez si nécessaire avant de valider." : undefined}
            />
            <CardBody className="space-y-3">
              {Object.keys(fields).map((k) => {
                const conf = data.field_confidence[k];
                const low = conf !== undefined && conf < data.min_confidence;
                return (
                  <div key={k} className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label htmlFor={`f-${k}`} className="text-[13px] text-muted">
                      {FIELD_LABEL[k] ?? k}
                    </label>
                    <div className="relative">
                      <Input
                        id={`f-${k}`}
                        className={cn("h-9 pr-16", low && "border-warning bg-warning-soft/40")}
                        value={fields[k] ?? ""}
                        disabled={!reviewable}
                        onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
                      />
                      {conf !== undefined && (
                        <span
                          className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular-nums", low ? "text-warning" : "text-subtle")}
                          title="Fiabilité de lecture"
                        >
                          {Math.round(conf * 100)} %
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardBody>
            {reviewable && (
              <CardFooter>
                <Button variant="ghost" onClick={() => setRejectOpen(true)}>
                  <X className="size-4" /> Rejeter
                </Button>
                <Button onClick={() => act("approve")} loading={busy === "approve"} disabled={!overview.entitlements.active}>
                  <Check className="size-4" /> Valider{Object.keys(changed).length ? " avec corrections" : ""}
                </Button>
              </CardFooter>
            )}
          </Card>

          {data.validation?.checks && data.validation.checks.length > 0 && (
            <Card>
              <CardHeader title="Contrôles" />
              <CardBody className="space-y-2">
                {data.validation.checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 text-sm">
                    {c.ok ? <Check className="mt-0.5 size-4 text-success" /> : <CircleAlert className="mt-0.5 size-4 text-warning" />}
                    <div>
                      <p>{CHECK_LABEL[c.kind] ?? c.kind}</p>
                      {!c.ok && c.message && <p className="text-[13px] text-muted">{c.message}</p>}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Historique"
              action={
                data.extracted_text && (
                  <Button size="sm" variant="ghost" onClick={() => setShowText(true)}>
                    Texte lu
                  </Button>
                )
              }
            />
            <CardBody>
              <ol className="space-y-2 text-[13px]">
                {data.history.map((h, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink/90">
                      {h.step} · {h.decision}
                    </span>
                    <span className="whitespace-nowrap text-subtle">{formatDateTime(h.at)}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rejeter ce document ?"
        description="Il ne sera pas envoyé en comptabilité."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" loading={busy === "reject"} onClick={() => act("reject")}>
              Rejeter
            </Button>
          </>
        }
      >
        <Textarea placeholder="Motif (facultatif)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif" />
      </Dialog>
      <Dialog open={showText} onClose={() => setShowText(false)} title="Texte lu dans le document" size="lg">
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-paper p-4 font-mono text-xs">{data.extracted_text}</pre>
      </Dialog>
    </>
  );
}
