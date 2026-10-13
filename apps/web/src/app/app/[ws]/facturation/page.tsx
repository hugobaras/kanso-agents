"use client";

import { ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { IntervalToggle, PlanCard } from "@/components/pricing";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader, Progress } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Entitlements, Plan } from "@/lib/types";

type Billing = {
  entitlements: Entitlements;
  usage: { conversations: number; documents: number; seats: number };
  plans: Plan[];
  stripe_enabled: boolean;
};

const STATUS: Record<Entitlements["status"], { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" }> = {
  trialing: { label: "Essai en cours", tone: "info" },
  active: { label: "Actif", tone: "success" },
  past_due: { label: "Paiement en retard", tone: "warning" },
  canceled: { label: "Résilié", tone: "neutral" },
  incomplete: { label: "Paiement incomplet", tone: "warning" },
  expired: { label: "Essai terminé", tone: "danger" },
};

function BillingInner() {
  const { ws, can, refreshOverview } = useWorkspace();
  const toast = useToast();
  const params = useSearchParams();
  const { data, mutate } = useApi<Billing>(wsPath(ws, "/billing"));
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast.success("Merci !", "Votre abonnement est en cours d'activation.");
      const t = setTimeout(() => {
        void mutate();
        void refreshOverview();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [params, toast, mutate, refreshOverview]);

  if (!data) return <PageSpinner />;
  const ent = data.entitlements;
  const st = STATUS[ent.status];
  const paid = ent.plan !== "trial" && ent.status !== "canceled";

  async function go(path: string, body?: unknown, key = path) {
    setBusy(key);
    try {
      const r = await api<{ url: string }>(wsPath(ws, path), { body: body ?? {} });
      window.location.href = r.url;
    } catch (e) {
      toast.error("Redirection impossible", errorMessage(e));
      setBusy(null);
    }
  }

  const meters = [
    { label: "Conversations ce mois", used: data.usage.conversations, max: ent.quotas.conversations },
    ...(ent.quotas.documents > 0 ? [{ label: "Documents ce mois", used: data.usage.documents, max: ent.quotas.documents }] : []),
    { label: "Utilisateurs", used: data.usage.seats, max: ent.seats },
  ];

  return (
    <>
      <PageHeader title="Facturation" description="Votre offre, votre consommation et vos factures." />
      {!data.stripe_enabled && (
        <Alert tone="warning" className="mb-6">
          Le paiement en ligne n&apos;est pas encore activé sur cette instance (clés Stripe absentes).
        </Alert>
      )}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Offre actuelle" action={<Badge tone={st.tone}>{st.label}</Badge>} />
          <CardBody className="space-y-2 text-sm">
            <p className="font-display text-3xl">{ent.plan_name}</p>
            {ent.status === "trialing" && ent.trial_ends_at && <p className="text-muted">Jusqu&apos;au {formatDate(ent.trial_ends_at)} ({ent.trial_days_left} j)</p>}
            {paid && ent.current_period_end && (
              <p className="text-muted">
                {ent.cancel_at_period_end ? "Se termine le" : "Prochain renouvellement le"} {formatDate(ent.current_period_end)}
              </p>
            )}
            {can("owner") && ent.has_stripe_customer && (
              <Button variant="secondary" size="sm" className="mt-3" loading={busy === "portal"} onClick={() => go("/billing/portal", {}, "portal")}>
                Factures et moyen de paiement <ExternalLink className="size-3.5" />
              </Button>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Consommation" description="Les compteurs repartent à zéro le 1er de chaque mois. Aucun dépassement n'est facturé." />
          <CardBody className="grid gap-5 sm:grid-cols-3">
            {meters.map((m) => (
              <div key={m.label}>
                <p className="text-[13px] text-muted">{m.label}</p>
                <p className="mt-1 text-lg font-medium tabular-nums">
                  {m.used} <span className="text-sm font-normal text-subtle">/ {m.max}</span>
                </p>
                <Progress value={m.used} max={m.max} className="mt-2" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="font-display text-2xl">{paid ? "Changer d'offre" : "Choisir une offre"}</h2>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {data.plans.map((p) => {
          const current = paid && p.id === ent.plan;
          return (
            <PlanCard
              key={p.id}
              plan={p}
              interval={interval}
              current={current}
              featured={p.id === "cabinet"}
              action={
                can("owner") ? (
                  <Button
                    variant={p.id === "cabinet" ? "primary" : "secondary"}
                    className="w-full"
                    disabled={current || !data.stripe_enabled}
                    loading={busy === p.id}
                    onClick={() => go("/billing/checkout", { plan: p.id, interval }, p.id)}
                  >
                    {current ? "Offre actuelle" : paid ? "Changer pour cette offre" : `Choisir ${p.name}`}
                  </Button>
                ) : (
                  <p className="text-center text-xs text-subtle">Seul le propriétaire peut modifier l&apos;offre.</p>
                )
              }
            />
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Prix hors taxes. Paiement sécurisé par Stripe. Résiliable à tout moment depuis cette page, sans frais.
      </p>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  );
}
