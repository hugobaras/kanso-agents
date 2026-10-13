"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api";
import { formatDate, formatEur, timeAgo } from "@/lib/format";

type Tenant = {
  tenant_id: string;
  display_name: string;
  status: string;
  profession: string | null;
  created_at: string;
  deleted_at: string | null;
  plan: string | null;
  sub_status: string | null;
  trial_ends_at: string | null;
  conversations_month: number;
  documents_month: number;
  members: number;
  last_activity: string | null;
  llm_eur: number;
  mrr_cents: number;
};

export default function AdminTenants() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data } = useApi<{ tenants: Tenant[] }>(`/api/admin/tenants${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  return (
    <>
      <PageHeader title="Cabinets" />
      <form
        className="relative mb-4 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input className="pl-9" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un cabinet" />
      </form>
      <Card className="overflow-x-auto">
        {!data ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                <th className="px-4 py-2.5 font-medium">Cabinet</th>
                <th className="px-4 py-2.5 font-medium">Offre</th>
                <th className="px-4 py-2.5 text-right font-medium">MRR</th>
                <th className="px-4 py-2.5 text-right font-medium">Conv. / docs</th>
                <th className="px-4 py-2.5 text-right font-medium">Coût IA</th>
                <th className="px-4 py-2.5 text-right font-medium">Activité</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr key={t.tenant_id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/admin/cabinets/${t.tenant_id}`} className="font-medium hover:underline">
                      {t.display_name}
                    </Link>
                    <p className="text-xs text-muted">
                      {t.tenant_id} · créé le {formatDate(t.created_at)} · {t.members} membre(s)
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge>{t.plan ?? "—"}</Badge>
                      {t.sub_status && t.sub_status !== "active" && <Badge tone={t.sub_status === "trialing" ? "info" : "warning"}>{t.sub_status}</Badge>}
                      {t.status === "suspended" && <Badge tone="danger">suspendu</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatEur(t.mrr_cents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.conversations_month} / {t.documents_month}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.llm_eur.toFixed(2).replace(".", ",")} €</td>
                  <td className="px-4 py-3 text-right text-muted">{timeAgo(t.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
