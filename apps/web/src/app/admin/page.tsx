"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton, Stat } from "@/components/ui/misc";
import { useApi } from "@/lib/api";
import { formatEur } from "@/lib/format";

type Stats = {
  mrr_cents: number;
  workspaces: number;
  trialing: number;
  by_plan: Record<string, number>;
  llm_cost_eur_month: number;
  leads_month: number;
  documents_month: number;
  signups_30d: Array<{ day: string; count: number }>;
};

const PLAN: Record<string, string> = { trial: "Essai", essentiel: "Essentiel", cabinet: "Cabinet", expert: "Expert" };

export default function AdminHome() {
  const { data } = useApi<Stats>("/api/admin/stats", { refreshInterval: 60_000 });
  if (!data) return <Skeleton className="h-64" />;
  const max = Math.max(1, ...data.signups_30d.map((d) => d.count));
  const margin = data.mrr_cents / 100 - data.llm_cost_eur_month;
  return (
    <>
      <PageHeader title="Vue d'ensemble" description="Indicateurs du mois en cours." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenu mensuel récurrent" value={formatEur(data.mrr_cents)} hint={`Marge brute IA ≈ ${formatEur(Math.round(margin * 100))}`} />
        <Stat label="Espaces" value={data.workspaces} hint={`${data.trialing} en essai`} />
        <Stat label="Demandes qualifiées" value={data.leads_month} />
        <Stat label="Coût IA (mois)" value={`${data.llm_cost_eur_month.toFixed(2).replace(".", ",")} €`} hint={`${data.documents_month} documents`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Inscriptions (30 jours)" />
          <CardBody>
            <div className="flex h-36 items-end gap-1">
              {data.signups_30d.map((d) => (
                <div key={d.day} className="flex-1 rounded-t-sm bg-accent" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1 }} title={`${d.day} : ${d.count}`} />
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Répartition par offre" />
          <CardBody className="space-y-2.5">
            {Object.entries(data.by_plan).map(([p, n]) => (
              <div key={p} className="flex justify-between text-sm">
                <span className="text-muted">{PLAN[p] ?? p}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
