"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { api, errorMessage, useApi } from "@/lib/api";
import type { Me } from "@/lib/types";
import { siteHref } from "@/lib/sites";

type Invite = { workspace: string; email: string; role: string; has_account: boolean };

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const invite = useApi<Invite>(`/api/auth/invitations/${encodeURIComponent(token)}`);
  const me = useApi<Me>("/api/auth/me", { shouldRetryOnError: false });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invite.isLoading || me.isLoading) return <PageSpinner />;
  if (invite.error || !invite.data) {
    return (
      <div>
        <h1 className="font-display text-3xl">Invitation expirée</h1>
        <p className="mt-3 text-sm text-muted">{errorMessage(invite.error)}</p>
        <ButtonLink href="/connexion" className="mt-6">
          Se connecter
        </ButtonLink>
      </div>
    );
  }
  const inv = invite.data;
  const loggedIn = !!me.data;

  async function accept(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ workspace: string }>(`/api/auth/invitations/${encodeURIComponent(token)}/accept`, {
        body: loggedIn ? {} : { name, password },
      });
      router.replace(`/app/${r.workspace}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">Invitation</p>
      <h1 className="mt-1 font-display text-3xl">Rejoindre {inv.workspace}</h1>
      <p className="mt-2 text-sm text-muted">
        Pour <strong className="text-ink">{inv.email}</strong> · rôle {inv.role === "admin" ? "administrateur" : "membre"}
      </p>
      <div className="mt-8 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {loggedIn ? (
          me.data!.user.email.toLowerCase() === inv.email.toLowerCase() ? (
            <Button size="lg" className="w-full" loading={loading} onClick={() => accept()}>
              Accepter l&apos;invitation
            </Button>
          ) : (
            <Alert tone="warning" title="Mauvais compte">
              Vous êtes connecté en tant que {me.data!.user.email}. Déconnectez-vous puis rouvrez ce lien.
            </Alert>
          )
        ) : inv.has_account ? (
          <>
            <Alert tone="info">Un compte existe déjà pour cette adresse : connectez-vous pour accepter.</Alert>
            <ButtonLink
              href={`/connexion?suite=${encodeURIComponent(`/invitation/${token}`)}`}
              size="lg"
              className="w-full"
            >
              Se connecter
            </ButtonLink>
          </>
        ) : (
          <form onSubmit={accept} className="space-y-4">
            <Field label="Votre nom">
              {(p) => <Input {...p} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Choisissez un mot de passe" hint="10 caractères minimum, avec un chiffre ou un symbole.">
              {(p) => (
                <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Créer mon compte et rejoindre
            </Button>
            <p className="text-xs text-subtle">
              En continuant, vous acceptez les{" "}
              <Link href={siteHref("assistant", "/legal/cgu")} className="underline">
                conditions d&apos;utilisation
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
