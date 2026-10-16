"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi } from "@/lib/api";
import type { Me } from "@/lib/types";

export default function AccountPage() {
  const toast = useToast();
  const { data, mutate } = useApi<Me>("/api/auth/me");
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (data) setName(data.user.name);
  }, [data]);
  if (!data) return <PageSpinner />;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-6 py-4">
        <Logo href="/app" />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/app" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Retour à mon espace
        </Link>
        <PageHeader title="Mon compte" description={data.user.email} />
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profil" />
            <CardBody>
              <Field label="Nom">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            </CardBody>
            <CardFooter>
              <Button
                loading={busy === "name"}
                disabled={name.trim() === data.user.name || name.trim().length < 2}
                onClick={async () => {
                  setBusy("name");
                  try {
                    await api("/api/auth/me", { method: "PATCH", body: { name: name.trim() } });
                    await mutate();
                    toast.success("Profil mis à jour");
                  } catch (e) {
                    toast.error("Erreur", errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Enregistrer
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader title="Mot de passe" description="Vos autres sessions seront déconnectées." />
            <CardBody className="space-y-4">
              <Field label="Mot de passe actuel" hint="Laissez vide si vous vous connectez uniquement par lien e-mail.">
                {(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}
              </Field>
              <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec un chiffre ou un symbole.">
                {(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}
              </Field>
            </CardBody>
            <CardFooter>
              <Button
                loading={busy === "pw"}
                disabled={pw.next.length < 10}
                onClick={async () => {
                  setBusy("pw");
                  try {
                    await api("/api/auth/password/change", { body: pw });
                    setPw({ current: "", next: "" });
                    toast.success("Mot de passe modifié");
                  } catch (e) {
                    toast.error("Modification impossible", errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Changer le mot de passe
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
