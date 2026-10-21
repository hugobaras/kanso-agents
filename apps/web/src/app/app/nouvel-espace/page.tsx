"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { api, errorMessage, useApi } from "@/lib/api";
import type { Me } from "@/lib/types";

const PRODUCTS = {
  portail: { name: "Kanso Portail", pitch: "L'espace client sécurisé où vos clients déposent leurs pièces. 14 jours d'essai, sans carte bancaire." },
  assistant: { name: "Kanso Assistant", pitch: "L'assistant qui accueille et qualifie les demandes de votre site. 14 jours d'essai, sans carte bancaire." },
} as const;

function NewSpace() {
  const router = useRouter();
  const params = useSearchParams();
  const product = params.get("produit") === "assistant" ? "assistant" : "portail";
  const me = useApi<Me>("/api/auth/me");
  const current = me.data?.workspaces.find((w) => w.role === "owner") ?? me.data?.workspaces[0];
  const [name, setName] = useState<string | null>(null);
  const [profession, setProfession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me.data) return <PageSpinner />;
  const wsName = name ?? current?.name ?? "";
  const prof = profession ?? current?.profession ?? "avocat";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ workspace: string }>("/api/auth/workspaces", { body: { product, workspace_name: wsName, profession: prof } });
      router.replace(product === "portail" ? `/app/${r.workspace}/portail` : `/app/${r.workspace}/bienvenue`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-6 py-4">
        <Logo href="/app" site={product} />
      </header>
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link href="/app" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Retour à mon espace
        </Link>
        <PageHeader title={`Ouvrir un espace ${PRODUCTS[product].name}`} description={PRODUCTS[product].pitch} />
        <Card>
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              <Field label="Nom du cabinet">{(p) => <Input {...p} value={wsName} onChange={(e) => setName(e.target.value)} />}</Field>
              <Field label="Profession">
                {(p) => (
                  <Select {...p} value={prof} onChange={(e) => setProfession(e.target.value)}>
                    <option value="avocat">Avocat</option>
                    <option value="expert_comptable">Expert-comptable</option>
                    <option value="notaire">Notaire</option>
                    <option value="autre">Autre</option>
                  </Select>
                )}
              </Field>
              <p className="text-sm text-muted">Même compte, même connexion : vous passerez d&apos;un espace à l&apos;autre depuis le menu. Chaque espace a son propre abonnement.</p>
              <Button type="submit" loading={busy} disabled={wsName.trim().length < 2}>
                Créer l&apos;espace
              </Button>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

export default function NewSpacePage() {
  return (
    <Suspense>
      <NewSpace />
    </Suspense>
  );
}
