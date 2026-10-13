"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi } from "@/lib/api";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

type Detail = {
  tenant: { tenant_id: string; display_name: string; status: string; profession: string | null; created_at: string; suspended_reason: string | null };
  members: Array<{ id: string; email: string; name: string; role: string; last_login_at: string | null }>;
  subscription: { plan: string; status: string; trial_ends_at: string | null; current_period_end: string | null; stripe_customer_id: string | null } | null;
  versions: Array<{ version: number; status: string; published_at: string | null; published_by: string | null }>;
  dead_letters: Array<{ id: string; provider: string; last_error: string; created_at: string }>;
  audit: Array<{ at: string; step: string; decision: string; actor: string }>;
  widget_keys: Array<{ public_key: string; allowed_origins: string[]; last_seen_at: string | null; last_seen_origin: string | null; revoked_at: string | null }>;
};

export default function AdminTenant() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, mutate } = useApi<Detail>(`/api/admin/tenants/${id}`);
  const [confirm, setConfirm] = useState<"suspend" | "impersonate" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <PageSpinner />;
  const t = data.tenant;
  const suspended = t.status === "suspended";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await mutate();
      toast.success(ok);
    } catch (e) {
      toast.error("Action impossible", errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <Link href="/admin/cabinets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Cabinets
      </Link>
      <PageHeader
        title={t.display_name}
        eyebrow={`${t.tenant_id} · ${t.profession ?? "—"} · créé le ${formatDate(t.created_at)}`}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => api(`/api/admin/tenants/${id}/extend-trial`, { body: { days: 7 } }), "Essai prolongé de 7 jours")}>
              Prolonger l&apos;essai (+7 j)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm("impersonate")}>
              Session support
            </Button>
            <Button variant={suspended ? "primary" : "danger"} size="sm" onClick={() => setConfirm("suspend")}>
              {suspended ? "Réactiver" : "Suspendre"}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Abonnement" />
          <CardBody className="space-y-1 text-sm">
            {data.subscription ? (
              <>
                <p>
                  <Badge>{data.subscription.plan}</Badge> <Badge tone="info">{data.subscription.status}</Badge>
                </p>
                {data.subscription.trial_ends_at && <p className="text-muted">Fin d&apos;essai : {formatDateTime(data.subscription.trial_ends_at)}</p>}
                {data.subscription.current_period_end && <p className="text-muted">Période jusqu&apos;au {formatDate(data.subscription.current_period_end)}</p>}
                <p className="text-muted">Stripe : {data.subscription.stripe_customer_id ?? "—"}</p>
              </>
            ) : (
              <p className="text-muted">Aucun abonnement.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Membres" />
          <ul className="divide-y divide-line text-sm">
            {data.members.map((m) => (
              <li key={m.id} className="flex justify-between px-5 py-2.5">
                <span>
                  {m.name || m.email} <span className="text-muted">({m.role})</span>
                </span>
                <span className="text-muted">{timeAgo(m.last_login_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Widget" />
          <CardBody className="space-y-2 text-sm">
            {data.widget_keys.map((k) => (
              <div key={k.public_key} className={k.revoked_at ? "opacity-50" : ""}>
                <code className="text-xs">{k.public_key}</code>
                <p className="text-muted">
                  {k.allowed_origins.join(", ") || "toutes origines"} · vu {timeAgo(k.last_seen_at)} {k.last_seen_origin && `sur ${k.last_seen_origin}`}
                </p>
              </div>
            ))}
            <p className="pt-2 text-muted">Versions : {data.versions.map((v) => `v${v.version}${v.status === "published" ? "*" : ""}`).join(", ") || "aucune"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Échecs d'intégration" />
          <CardBody className="space-y-2 text-sm">
            {data.dead_letters.length === 0 && <p className="text-muted">Aucun.</p>}
            {data.dead_letters.map((d) => (
              <p key={d.id}>
                <strong>{d.provider}</strong> — {d.last_error} <span className="text-muted">({timeAgo(d.created_at)})</span>
              </p>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Journal d'audit" />
          <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {data.audit.map((a, i) => (
              <li key={i} className="grid grid-cols-[160px_1fr_200px] gap-3 px-5 py-2">
                <span className="text-muted">{formatDateTime(a.at)}</span>
                <span>
                  {a.step} · {a.decision}
                </span>
                <span className="truncate text-right text-muted">{a.actor}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <ConfirmDialog
        open={confirm === "suspend"}
        onClose={() => setConfirm(null)}
        danger={!suspended}
        loading={busy}
        title={suspended ? "Réactiver ce cabinet ?" : "Suspendre ce cabinet ?"}
        description={suspended ? undefined : "Le widget devient indisponible et les envois sont bloqués."}
        confirmLabel={suspended ? "Réactiver" : "Suspendre"}
        onConfirm={() => run(() => api(`/api/admin/tenants/${id}/suspend`, { body: { suspended: !suspended } }), suspended ? "Cabinet réactivé" : "Cabinet suspendu")}
      />
      <ConfirmDialog
        open={confirm === "impersonate"}
        onClose={() => setConfirm(null)}
        loading={busy}
        title="Ouvrir une session support ?"
        description="Vous serez connecté en tant que propriétaire de l'espace pendant 24 h. L'action est journalisée. Votre session staff sera fermée."
        confirmLabel="Ouvrir la session"
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/api/admin/tenants/${id}/impersonate`, { method: "POST" });
            router.replace(`/app/${id}`);
          } catch (e) {
            toast.error("Impossible", errorMessage(e));
            setBusy(false);
          }
        }}
      />
    </>
  );
}
