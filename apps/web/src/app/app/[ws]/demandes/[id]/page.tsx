"use client";

import { ArrowLeft, Bot, Copy, FolderPlus, Mail, Phone, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { STATUS_LABEL, TierBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Alert, EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

type Detail = {
  lead: {
    id: string;
    contact: { name?: string; email?: string; phone?: string };
    score: number;
    tier: string;
    event: string;
    status: string;
    summary: string | null;
    notes: string | null;
    origin: string | null;
    assignee: { id: string; name: string | null } | null;
    created_at: string;
  };
  answers: Array<{ label: string; value: string }>;
  score_breakdown: Array<{ question_id: string; label: string; points: number }>;
  thresholds: { hot: number; warm: number } | null;
  transcript: Array<{ role: "user" | "assistant" | "system"; content: string; at: string }>;
};

type Team = { members: Array<{ id: string; name: string; email: string }> };

const EVENT_LABEL: Record<string, string> = {
  hot_lead: "Qualifiée — prioritaire",
  handoff: "Qualifiée",
  new_lead: "Coordonnées laissées",
  escalation: "Demande à parler à un humain",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ws, overview, refreshOverview } = useWorkspace();
  const toast = useToast();
  const { data, error, mutate } = useApi<Detail>(wsPath(ws, `/leads/${id}`));
  const team = useApi<Team>(wsPath(ws, "/team"));
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (data) setNotes(data.lead.notes ?? "");
  }, [data]);

  if (error) return <EmptyState title="Demande introuvable" description={errorMessage(error)} />;
  if (!data) return <PageSpinner />;
  const { lead } = data;

  async function patch(body: Record<string, unknown>, success: string) {
    try {
      await api(wsPath(ws, `/leads/${id}`), { method: "PATCH", body });
      await mutate();
      void refreshOverview();
      toast.success(success);
    } catch (e) {
      toast.error("Modification impossible", errorMessage(e));
    }
  }

  const copy = (v: string) => {
    void navigator.clipboard.writeText(v);
    toast.success("Copié");
  };

  return (
    <>
      <Link href={`/app/${ws}/demandes`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Demandes
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] leading-tight">{lead.contact.name ?? lead.contact.email ?? "Visiteur"}</h1>
          <p className="mt-1 text-sm text-muted">
            {EVENT_LABEL[lead.event] ?? lead.event} · reçue le {formatDateTime(lead.created_at)}
            {lead.origin && <> · depuis {lead.origin.replace(/^https?:\/\//, "")}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overview.entitlements.modules.portail && lead.contact.email && (
            <ButtonLink href={`/app/${ws}/portail/nouveau?lead=${lead.id}`} variant="secondary" size="sm">
              <FolderPlus className="size-4" /> Créer un dossier
            </ButtonLink>
          )}
          <TierBadge tier={lead.tier} />
          <Select
            className="h-9 w-48"
            value={lead.status}
            onChange={(e) => patch({ status: e.target.value }, "Statut mis à jour")}
            aria-label="Statut"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Coordonnées" />
            <CardBody className="space-y-3 text-sm">
              {[
                { icon: User, v: lead.contact.name },
                { icon: Mail, v: lead.contact.email, href: lead.contact.email && `mailto:${lead.contact.email}` },
                { icon: Phone, v: lead.contact.phone, href: lead.contact.phone && `tel:${lead.contact.phone.replace(/\s/g, "")}` },
              ]
                .filter((r) => r.v)
                .map((r) => (
                  <div key={r.v} className="flex items-center gap-2.5">
                    <r.icon className="size-4 text-subtle" />
                    {r.href ? (
                      <a href={r.href} className="flex-1 truncate text-accent hover:underline">
                        {r.v}
                      </a>
                    ) : (
                      <span className="flex-1 truncate">{r.v}</span>
                    )}
                    <button onClick={() => copy(r.v!)} className="text-subtle hover:text-ink" aria-label="Copier">
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                ))}
              {!lead.contact.email && !lead.contact.phone && <p className="text-muted">Aucune coordonnée laissée.</p>}
              {lead.contact.email && (
                <a
                  href={`mailto:${lead.contact.email}?subject=${encodeURIComponent("Votre demande")}`}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-ink text-sm font-medium text-paper hover:bg-ink-soft"
                >
                  <Mail className="size-4" /> Répondre par e-mail
                </a>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Score" description={`${lead.score} / 100`} />
            <CardBody className="space-y-2.5">
              {data.score_breakdown.map((b) => (
                <div key={b.question_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted">{b.label.replace(/\s*\?$/, "")}</span>
                  <span className={cn("font-medium tabular-nums", b.points === 0 && "text-subtle")}>+{b.points}</span>
                </div>
              ))}
              {data.thresholds && (
                <p className="border-t border-line pt-2.5 text-xs text-subtle">
                  Prioritaire à partir de {data.thresholds.hot}, à suivre à partir de {data.thresholds.warm}.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Suivi interne" />
            <CardBody className="space-y-3">
              <label className="block text-[13px] font-medium" htmlFor="assignee">
                Responsable
              </label>
              <Select
                id="assignee"
                value={lead.assignee?.id ?? ""}
                onChange={(e) => patch({ assignee_user_id: e.target.value || null }, "Responsable mis à jour")}
              >
                <option value="">Non attribuée</option>
                {team.data?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </Select>
              <label className="block pt-1 text-[13px] font-medium" htmlFor="notes">
                Notes
              </label>
              <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible uniquement par votre équipe." />
              <Button
                size="sm"
                variant="secondary"
                loading={savingNotes}
                disabled={notes === (lead.notes ?? "")}
                onClick={async () => {
                  setSavingNotes(true);
                  await patch({ notes }, "Notes enregistrées");
                  setSavingNotes(false);
                }}
              >
                Enregistrer les notes
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Réponses du visiteur" />
            <CardBody>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {data.answers.map((a) => (
                  <div key={a.label}>
                    <dt className="text-[13px] text-muted">{a.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Conversation" description="Transcription intégrale de l'échange avec l'assistant." />
            <CardBody className="space-y-3 bg-paper/50">
              {data.transcript.map((m, i) => (
                <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      m.role === "user" ? "bg-ink text-paper" : "bg-accent-soft text-accent-strong",
                    )}
                    aria-hidden
                  >
                    {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-line rounded-lg px-3.5 py-2.5 text-sm",
                      m.role === "user" ? "bg-ink text-paper" : "border border-line bg-surface",
                    )}
                  >
                    <span className="sr-only">{m.role === "user" ? "Visiteur : " : "Assistant : "}</span>
                    {m.content}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Alert tone="info">
            La qualification est automatique et indicative : vérifiez toujours la demande avant d&apos;y donner suite.
          </Alert>
        </div>
      </div>
    </>
  );
}
