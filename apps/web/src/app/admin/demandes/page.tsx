"use client";

import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, useApi } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Req = { id: string; tenant_id: string; display_name: string; platform: string; title: string; description: string; status: string; created_at: string };

export default function AdminRequests() {
  const toast = useToast();
  const { data, mutate } = useApi<{ requests: Req[] }>("/api/admin/requests");
  if (!data) return <Skeleton className="h-64" />;
  return (
    <>
      <PageHeader title="Demandes d'intégration sur mesure" />
      {data.requests.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <div className="space-y-3">
          {data.requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">
                    {r.platform} — {r.title}
                  </p>
                  <p className="text-xs text-muted">
                    {r.display_name} ({r.tenant_id}) · {formatDate(r.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{r.description}</p>
                </div>
                <Select
                  className="h-9 w-40"
                  value={r.status}
                  aria-label="Statut"
                  onChange={async (e) => {
                    await api(`/api/admin/requests/${r.id}`, { method: "PATCH", body: { status: e.target.value } });
                    await mutate();
                    toast.success("Statut mis à jour");
                  }}
                >
                  <option value="open">Reçue</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Livrée</option>
                  <option value="declined">Déclinée</option>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
