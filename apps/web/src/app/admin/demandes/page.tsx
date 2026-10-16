"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, useApi } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Req = { id: string; tenant_id: string; display_name: string; platform: string; title: string; description: string; status: string; created_at: string };

type Contact = {
  id: string;
  source: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  profession: string | null;
  organisation: string | null;
  message: string | null;
  extra: { project?: string; current_url?: string; timeline?: string; with_assistant?: boolean };
  status: string;
  created_at: string;
};

const SOURCE: Record<string, string> = { solutions: "Kanso Solutions", assistant: "Kanso Assistant", site: "Kanso Site", portail: "Kanso Portail" };
const KIND: Record<string, string> = { contact: "Contact", devis: "Devis", waitlist: "Liste d'attente" };

function Contacts() {
  const toast = useToast();
  const { data, mutate } = useApi<{ contacts: Contact[] }>("/api/admin/contacts");
  if (!data) return <Skeleton className="h-40" />;
  if (data.contacts.length === 0) return <EmptyState title="Aucun message des sites vitrines" />;
  return (
    <div className="space-y-3">
      {data.contacts.map((c) => (
        <Card key={c.id} id={c.id} className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Badge tone={c.kind === "devis" ? "accent" : c.kind === "waitlist" ? "info" : "neutral"}>{KIND[c.kind]}</Badge>
                <Badge>{SOURCE[c.source]}</Badge>
                {c.name || c.email}
              </p>
              <p className="mt-1 text-xs text-muted">
                <a href={`mailto:${c.email}`} className="hover:underline">
                  {c.email}
                </a>
                {c.phone && ` · ${c.phone}`}
                {c.profession && ` · ${c.profession}`}
                {c.organisation && ` · ${c.organisation}`} · {formatDate(c.created_at)}
              </p>
              {(c.extra.project || c.extra.timeline || c.extra.current_url || c.extra.with_assistant) && (
                <p className="mt-2 text-sm text-ink/90">
                  {c.extra.project && `Projet : ${c.extra.project === "refonte" ? "refonte" : "création"}. `}
                  {c.extra.timeline && `Échéance : ${c.extra.timeline}. `}
                  {c.extra.current_url && `Site actuel : ${c.extra.current_url}. `}
                  {c.extra.with_assistant && "Souhaite Kanso Assistant."}
                </p>
              )}
              {c.message && <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{c.message}</p>}
            </div>
            <Select
              className="h-9 w-40 shrink-0"
              value={c.status}
              aria-label="Statut"
              onChange={async (e) => {
                await api(`/api/admin/contacts/${c.id}`, { method: "PATCH", body: { status: e.target.value } });
                await mutate();
                toast.success("Statut mis à jour");
              }}
            >
              <option value="new">Nouveau</option>
              <option value="contacted">Contacté</option>
              <option value="done">Traité</option>
              <option value="spam">Indésirable</option>
            </Select>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdminRequests() {
  const toast = useToast();
  const { data, mutate } = useApi<{ requests: Req[] }>("/api/admin/requests");
  if (!data) return <Skeleton className="h-64" />;
  return (
    <>
      <PageHeader title="Demandes clients" description="Messages des sites vitrines, devis Kanso Site, liste d'attente Kanso Portail et demandes depuis les espaces clients." />
      <h2 className="mb-3 text-sm font-semibold text-muted">Sites vitrines</h2>
      <Contacts />
      <h2 className="mb-3 mt-10 text-sm font-semibold text-muted">Depuis les espaces Kanso Assistant</h2>
      {data.requests.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <div className="space-y-3">
          {data.requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {r.platform === "site_web" ? <Badge tone="accent">Site web — devis</Badge> : r.platform} {r.title}
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
