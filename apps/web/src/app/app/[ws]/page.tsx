"use client";

import { ArrowRight, Check, Circle, FileText, Inbox } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/components/app/workspace-context";
import { LeadStatusBadge, TierBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Skeleton, Stat } from "@/components/ui/misc";
import { useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import type { LeadListItem } from "@/lib/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

function Checklist() {
  const { ws, overview } = useWorkspace();
  const steps = [
    { done: overview.assistant.published, label: "Personnaliser et publier votre assistant", href: `/app/${ws}/assistant` },
    { done: overview.assistant.installed, label: "Installer le widget sur votre site", href: `/app/${ws}/installation` },
    { done: overview.leads_this_month.total > 0, label: "Recevoir une première demande", href: `/app/${ws}/demandes` },
    ...(overview.entitlements.modules.document_to_action
      ? [{ done: overview.documents.dpa_accepted, label: "Activer le traitement des documents", href: `/app/${ws}/documents` }]
      : []),
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card className="mb-6">
      <CardHeader
        title="Mise en route"
        description={`${done} étape${done > 1 ? "s" : ""} sur ${steps.length}`}
        action={
          <ButtonLink href={`/app/${ws}/bienvenue`} size="sm" variant="secondary">
            Assistant de démarrage
          </ButtonLink>
        }
      />
      <CardBody className="py-2">
        <Progress value={done} max={steps.length} tone="accent" className="my-2" />
        <ul className="divide-y divide-line">
          {steps.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className="group flex items-center gap-3 py-3 text-sm">
                {s.done ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
                    <Check className="size-3.5" />
                  </span>
                ) : (
                  <Circle className="size-5 text-line-strong" />
                )}
                <span className={cn("flex-1", s.done && "text-muted line-through")}>{s.label}</span>
                {!s.done && <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function ActivityChart() {
  const { ws } = useWorkspace();
  const { data } = useApi<{ days: Array<{ day: string; leads: number; hot: number }> }>(wsPath(ws, "/activity"));
  if (!data) return <Skeleton className="h-36" />;
  const max = Math.max(1, ...data.days.map((d) => d.leads));
  const total = data.days.reduce((s, d) => s + d.leads, 0);
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={`${total} demandes sur 30 jours`}>
        {data.days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="w-full rounded-t-sm bg-accent/25" style={{ height: `${((d.leads - d.hot) / max) * 100}%` }} />
            <div className="w-full bg-accent" style={{ height: `${(d.hot / max) * 100}%` }} />
            {d.leads === 0 && <div className="h-px w-full bg-line" />}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-paper group-hover:block">
              {new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {d.leads} ({d.hot} prioritaires)
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-subtle">
        <span>Il y a 30 jours</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent" /> prioritaires
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent/25" /> autres
          </span>
        </span>
        <span>Aujourd&apos;hui</span>
      </div>
    </div>
  );
}

function RecentLeads() {
  const { ws } = useWorkspace();
  const { data } = useApi<{ leads: LeadListItem[] }>(wsPath(ws, "/leads?limit=6"));
  if (!data) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (data.leads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucune demande pour l'instant"
        description="Dès qu'un visiteur échange avec votre assistant, sa demande qualifiée apparaît ici."
        action={
          <ButtonLink href={`/app/${ws}/installation`} variant="secondary" size="sm">
            Installer le widget
          </ButtonLink>
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {data.leads.map((l) => (
        <li key={l.id}>
          <Link href={`/app/${ws}/demandes/${l.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-paper">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.contact.name ?? l.contact.email ?? "Visiteur"}</p>
              <p className="truncate text-[13px] text-muted">{l.summary ?? "—"}</p>
            </div>
            <TierBadge tier={l.tier} />
            <span className="hidden sm:block">
              <LeadStatusBadge status={l.status} />
            </span>
            <span className="w-20 text-right text-xs text-subtle">{timeAgo(l.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { ws, me, overview } = useWorkspace();
  const ent = overview.entitlements;
  const firstName = me.user.name.split(" ")[0];
  return (
    <>
      <PageHeader
        eyebrow={overview.workspace.name}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description="Voici l'activité de votre assistant ce mois-ci."
      />
      <Checklist />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Demandes ce mois" value={overview.leads_this_month.total} hint={`${overview.leads_this_month.last_7_days} sur 7 jours`} />
        <Stat label="Prioritaires" value={overview.leads_this_month.hot} hint={`${overview.leads_this_month.new} à traiter`} />
        <Stat
          label="Conversations"
          value={
            <>
              {overview.usage.conversations}
              <span className="text-base text-subtle"> / {ent.quotas.conversations}</span>
            </>
          }
          hint={<Progress value={overview.usage.conversations} max={ent.quotas.conversations} />}
        />
        {ent.modules.document_to_action ? (
          <Stat
            label="Documents à vérifier"
            value={overview.documents.pending_review}
            hint={
              <Link href={`/app/${ws}/documents`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <FileText className="size-3.5" /> Ouvrir la file
              </Link>
            }
          />
        ) : (
          <Stat label="Offre" value={ent.plan_name} hint={<Link href={`/app/${ws}/facturation`} className="text-accent hover:underline">Gérer</Link>} />
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Dernières demandes"
            action={
              <Link href={`/app/${ws}/demandes`} className="text-sm text-accent hover:underline">
                Tout voir
              </Link>
            }
          />
          <RecentLeads />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Activité sur 30 jours" />
          <CardBody>
            <ActivityChart />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
