"use client";

import { Download, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useWorkspace } from "@/components/app/workspace-context";
import { LeadStatusBadge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/ui/misc";
import { api, wsPath } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { LeadListItem } from "@/lib/types";

type Page = { leads: LeadListItem[]; next_cursor: string | null; counts: Record<string, number> };
type StatusTab = "all" | "new" | "contacted" | "qualified" | "won" | "lost";

const TAB_LABEL: Record<Exclude<StatusTab, "all">, string> = {
  new: "Nouvelles",
  contacted: "Contactées",
  qualified: "Qualifiées",
  won: "Clients",
  lost: "Sans suite",
};

export default function LeadsPage() {
  const { ws } = useWorkspace();
  const router = useRouter();
  const [status, setStatus] = useState<StatusTab>("all");
  const [tier, setTier] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (tier) params.set("tier", tier);
  if (query) params.set("q", query);

  const { data, size, setSize, isLoading } = useSWRInfinite<Page>(
    (i, prev: Page | null) => {
      if (prev && !prev.next_cursor) return null;
      const p = new URLSearchParams(params);
      if (prev?.next_cursor) p.set("cursor", prev.next_cursor);
      return wsPath(ws, `/leads?${p}`);
    },
    (p: string) => api<Page>(p),
  );
  const leads = data?.flatMap((d) => d.leads) ?? [];
  const counts = data?.[0]?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasMore = !!data?.[data.length - 1]?.next_cursor;

  return (
    <>
      <PageHeader
        title="Demandes"
        description="Chaque conversation qualifiée par votre assistant, triée par priorité."
        actions={
          <a href={wsPath(ws, `/leads/export.csv?${params}`)} className="inline-flex">
            <Button variant="secondary" size="sm" tabIndex={-1}>
              <Download className="size-4" /> Exporter (CSV)
            </Button>
          </a>
        }
      />
      <Card>
        <Tabs
          className="px-3"
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "Toutes", count: total },
            ...(Object.keys(TAB_LABEL) as Array<Exclude<StatusTab, "all">>).map((s) => ({
              value: s,
              label: TAB_LABEL[s],
              count: counts[s] ?? 0,
            })),
          ]}
        />
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(q.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              placeholder="Rechercher un nom, un e-mail, un domaine…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => setQuery(q.trim())}
              aria-label="Rechercher"
            />
          </form>
          <Select className="sm:w-48" value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Priorité">
            <option value="">Toutes priorités</option>
            <option value="hot">Prioritaires</option>
            <option value="warm">À suivre</option>
            <option value="cold">Faibles</option>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={query || tier || status !== "all" ? "Aucun résultat" : "Aucune demande pour l'instant"}
            description={
              query || tier || status !== "all"
                ? "Essayez d'élargir vos filtres."
                : "Les demandes qualifiées par votre assistant arriveront ici, avec les coordonnées et le résumé."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Demande</th>
                  <th className="px-4 py-2.5 font-medium">Priorité</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reçue</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                    onClick={() => router.push(`/app/${ws}/demandes/${l.id}`)}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/app/${ws}/demandes/${l.id}`} className="font-medium text-ink" onClick={(e) => e.stopPropagation()}>
                        {l.contact.name ?? l.contact.email ?? "Visiteur"}
                      </Link>
                      {l.contact.name && l.contact.email && <p className="text-[13px] text-muted">{l.contact.email}</p>}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted">{l.summary ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TierBadge tier={l.tier} />
                        <span className="text-xs text-subtle">{l.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={l.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] text-muted">{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setSize(size + 1)}>
              Charger plus
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
