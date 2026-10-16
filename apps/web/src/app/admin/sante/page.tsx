"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Health = {
  heartbeats: Array<{ service: string; at: string; meta: Record<string, unknown> }>;
  document_queue: Record<string, number>;
};

export default function AdminHealth() {
  const { data } = useApi<Health>("/api/admin/health", { refreshInterval: 10_000 });
  if (!data) return <Skeleton className="h-40" />;
  return (
    <>
      <PageHeader title="Santé du service" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Services" />
          <CardBody className="space-y-2">
            {data.heartbeats.map((h) => {
              const stale = Date.now() - new Date(h.at).getTime() > 120_000;
              return (
                <div key={h.service} className="flex items-center justify-between text-sm">
                  <span>{h.service}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted">{timeAgo(h.at)}</span>
                    <Badge tone={stale ? "danger" : "success"} dot>
                      {stale ? "silencieux" : "ok"}
                    </Badge>
                  </span>
                </div>
              );
            })}
            {data.heartbeats.length === 0 && <p className="text-sm text-muted">Aucun battement reçu.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="File de documents (7 jours)" />
          <CardBody className="space-y-2">
            {Object.entries(data.document_queue).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-muted">{k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
