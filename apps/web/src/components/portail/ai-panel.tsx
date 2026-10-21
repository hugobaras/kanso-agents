"use client";

import { FileSearch, ListChecks, MessageSquareText, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import type { AiAnswer, AiCheck, AiCitation, AiCoverage, AiEnvelope, AiStatus, AiSummary } from "@/lib/portail";

type Result = { kind: "summary"; data: AiEnvelope<AiSummary> } | { kind: "check"; data: AiEnvelope<AiCheck> } | { kind: "ask"; data: AiEnvelope<AiAnswer> };

function coverageText(c: AiCoverage): string {
  const parts = [`${c.analyzed} pièce${c.analyzed > 1 ? "s" : ""} analysée${c.analyzed > 1 ? "s" : ""} sur ${c.received} reçue${c.received > 1 ? "s" : ""}`];
  if (c.pending) parts.push(`${c.pending} en cours de lecture`);
  if (c.excluded) parts.push(`${c.excluded} exclue${c.excluded > 1 ? "s" : ""}`);
  if (c.quota) parts.push(`${c.quota} hors quota`);
  if (c.failed) parts.push(`${c.failed} illisible${c.failed > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** Panneau d'analyse IA d'un dossier : rien n'est appliqué automatiquement ni conservé. */
export function AiPanel({
  dossierId,
  excluded,
  files,
  items,
  onChanged,
}: {
  dossierId: string;
  excluded: boolean;
  files: Record<string, string>;
  items: Array<{ id: string; label: string; ai_excluded: boolean }>;
  onChanged: () => void;
}) {
  const { ws, can } = useWorkspace();
  const status = useApi<AiStatus>(wsPath(ws, "/portail/ai"));
  const base = wsPath(ws, `/portail/ai/dossiers/${dossierId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [question, setQuestion] = useState("");

  if (!status.data?.enabled) return null;

  async function exclude(path: string, value: boolean) {
    setError(null);
    try {
      await api(wsPath(ws, `/portail/dossiers/${dossierId}${path}`), { method: "PATCH", body: { ai_excluded: value } });
      setResult(null);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function run(kind: Result["kind"]) {
    setBusy(kind);
    setError(null);
    try {
      const path = kind === "ask" ? "/ask" : `/${kind}`;
      const data = await api<AiEnvelope<never>>(`${base}${path}`, { body: kind === "ask" ? { question } : {} });
      setResult({ kind, data } as Result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const cite = (c: AiCitation, i: number) => (
    <a
      key={`${c.file_id}-${c.page}-${i}`}
      href={wsPath(ws, `/portail/dossiers/${dossierId}/files/${c.file_id}`)}
      className="mr-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
      title={c.quote ?? undefined}
      download
    >
      <FileSearch className="size-3" aria-hidden />
      {files[c.file_id] ?? "pièce"}, p. {c.page}
    </a>
  );

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden /> Analyse IA
          </span>
        }
        description="Suggestions à vérifier, citées pièce par pièce. Elles ne modifient pas le dossier."
      />
      <CardBody className="space-y-4">
        {excluded ? (
          <Alert tone="info">Ce dossier est exclu de l&apos;analyse IA.</Alert>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busy === "summary"} onClick={() => run("summary")}>
                <FileSearch className="size-4" /> Résumer
              </Button>
              <Button size="sm" variant="secondary" loading={busy === "check"} onClick={() => run("check")}>
                <ListChecks className="size-4" /> Contrôler les pièces
              </Button>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim().length >= 3) void run("ask");
              }}
            >
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex. : quel est le revenu fiscal de référence ?" maxLength={500} aria-label="Question sur le dossier" />
              <Button size="sm" type="submit" loading={busy === "ask"} disabled={question.trim().length < 3}>
                <MessageSquareText className="size-4" /> Demander
              </Button>
            </form>
            {error && <Alert tone="danger">{error}</Alert>}
            {result && (
              <div className="space-y-3 rounded-md border border-line bg-paper p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {result.data.simulated && <Badge tone="warning">Mode simulation</Badge>}
                  <span>{coverageText(result.data.coverage)}</span>
                </div>
                {result.kind === "summary" && (
                  <>
                    <p>{result.data.result.overview}</p>
                    <ul className="space-y-2">
                      {result.data.result.pieces.map((p) => (
                        <li key={p.file_id}>
                          <p className="font-medium">
                            {p.item_label} — {p.type}
                          </p>
                          <p className="text-muted">
                            {[p.parties.join(", "), p.dates.join(", "), p.amounts.join(", ")].filter(Boolean).join(" · ") || "Aucune donnée repérée."}
                          </p>
                          <div>{p.citations.map(cite)}</div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {result.kind === "check" &&
                  (result.data.result.findings.length ? (
                    <ul className="space-y-2">
                      {result.data.result.findings.map((f, i) => (
                        <li key={i}>
                          <Badge tone={f.severity === "warning" ? "warning" : "neutral"}>{f.item_label}</Badge> <span>{f.message}</span>
                          <div>{f.citations.map(cite)}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Aucune anomalie repérée dans les pièces analysées.</p>
                  ))}
                {result.kind === "ask" && (
                  <>
                    <p>{result.data.result.answer}</p>
                    <div>{result.data.result.citations.map(cite)}</div>
                  </>
                )}
                <p className="text-xs text-subtle">{result.data.notice}</p>
              </div>
            )}
          </>
        )}
        {can("admin") && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">Exclusions (pièces sensibles, dossier entier)</summary>
            <div className="mt-3 space-y-2">
              <Checkbox label="Exclure tout ce dossier de l'analyse IA" checked={excluded} onChange={(e) => void exclude("", e.target.checked)} />
              {!excluded &&
                items.map((it) => (
                  <Checkbox key={it.id} label={`Exclure « ${it.label} »`} checked={it.ai_excluded} onChange={(e) => void exclude(`/items/${it.id}`, e.target.checked)} />
                ))}
              <p className="text-xs text-subtle">Exclure efface immédiatement le texte extrait des pièces concernées.</p>
            </div>
          </details>
        )}
      </CardBody>
    </Card>
  );
}
