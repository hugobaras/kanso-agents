"use client";

import { MailPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert, PageHeader, Progress } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDate, initials, timeAgo } from "@/lib/format";
import type { Role } from "@/lib/types";

type Team = {
  members: Array<{ id: string; email: string; name: string; role: Role; created_at: string; last_login_at: string | null }>;
  invitations: Array<{ id: string; email: string; role: Role; created_at: string; expires_at: string }>;
  seats: { used: number; limit: number };
  me: string;
};

const ROLE_LABEL: Record<Role, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Membre" };
const ROLE_HINT: Record<Role, string> = {
  owner: "Tous les droits, dont facturation et suppression de l'espace.",
  admin: "Configure l'assistant, les alertes, l'équipe et les intégrations.",
  member: "Consulte et traite les demandes et les documents.",
};

export default function TeamPage() {
  const { ws, can } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const { data, mutate } = useApi<Team>(wsPath(ws, "/team"));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Team["members"][number] | null>(null);

  if (!data) return <PageSpinner />;
  const full = data.seats.used >= data.seats.limit;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(wsPath(ws, "/team/invitations"), { body: { email, role } });
      toast.success("Invitation envoyée", email);
      setEmail("");
      setInviteOpen(false);
      await mutate();
    } catch (err) {
      toast.error("Invitation impossible", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, r: Role) {
    try {
      await api(wsPath(ws, `/team/members/${userId}`), { method: "PATCH", body: { role: r } });
      await mutate();
      toast.success("Rôle mis à jour");
    } catch (e) {
      toast.error("Modification impossible", errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Invitez vos associés et collaborateurs à traiter les demandes."
        actions={
          can("admin") && (
            <Button onClick={() => setInviteOpen(true)} disabled={full}>
              <MailPlus className="size-4" /> Inviter
            </Button>
          )
        }
      />
      <div className="mb-6 max-w-sm">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted">Utilisateurs</span>
          <span className="font-medium">
            {data.seats.used} / {data.seats.limit}
          </span>
        </div>
        <Progress value={data.seats.used} max={data.seats.limit} />
        {full && (
          <p className="mt-2 text-[13px] text-muted">
            Limite atteinte.{" "}
            <Link href={`/app/${ws}/facturation`} className="text-accent hover:underline">
              Passer à l&apos;offre supérieure
            </Link>
          </p>
        )}
      </div>

      <Card>
        <CardHeader title="Membres" />
        <ul className="divide-y divide-line">
          {data.members.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                  {initials(m.name, m.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email} {m.id === data.me && <span className="font-normal text-muted">(vous)</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {m.email} · {m.last_login_at ? `vu ${timeAgo(m.last_login_at)}` : "jamais connecté"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {can("owner") && m.id !== data.me ? (
                  <Select className="h-9 w-44" value={m.role} onChange={(e) => changeRole(m.id, e.target.value as Role)} aria-label={`Rôle de ${m.email}`}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone={m.role === "owner" ? "ink" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                )}
                {(can("admin") || m.id === data.me) && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(m)} aria-label={m.id === data.me ? "Quitter l'espace" : `Retirer ${m.email}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {data.invitations.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Invitations en attente" />
          <ul className="divide-y divide-line">
            {data.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{i.email}</p>
                  <p className="text-[13px] text-muted">
                    {ROLE_LABEL[i.role]} · expire le {formatDate(i.expires_at)}
                  </p>
                </div>
                {can("admin") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await api(wsPath(ws, `/team/invitations/${i.id}`), { method: "DELETE" });
                      await mutate();
                      toast.success("Invitation annulée");
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Les rôles</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium">{ROLE_LABEL[r]}</dt>
              <dd className="text-[13px] text-muted">{ROLE_HINT[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Inviter un collaborateur" description="Un e-mail d'invitation valable 7 jours sera envoyé.">
        <form id="invite" onSubmit={invite} className="space-y-4">
          <Field label="Adresse e-mail">
            {(p) => <Input {...p} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Rôle" hint={ROLE_HINT[role]}>
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </Select>
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={busy}>
              Envoyer l&apos;invitation
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        danger
        title={removing?.id === data.me ? "Quitter cet espace ?" : `Retirer ${removing?.name || removing?.email} ?`}
        description={removing?.id === data.me ? "Vous perdrez l'accès à cet espace." : "Cette personne perdra immédiatement l'accès à l'espace."}
        confirmLabel={removing?.id === data.me ? "Quitter" : "Retirer"}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(wsPath(ws, `/team/members/${removing.id}`), { method: "DELETE" });
            if (removing.id === data.me) {
              router.replace("/app");
              return;
            }
            await mutate();
            toast.success("Membre retiré");
          } catch (e) {
            toast.error("Impossible", errorMessage(e));
          } finally {
            setRemoving(null);
          }
        }}
      />
      {!can("admin") && <Alert tone="info" className="mt-6">Seuls les administrateurs peuvent inviter de nouveaux membres.</Alert>}
    </>
  );
}
