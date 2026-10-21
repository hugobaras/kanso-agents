"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { MfaStep, type MfaChallenge } from "@/components/auth/mfa-step";
import { api, errorMessage } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api<MfaChallenge>("/api/auth/password/reset", { body: { token: params.get("token") ?? "", password } });
      if (r.mfa_required && r.mfa_token) setMfaToken(r.mfa_token);
      else router.replace("/app");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (mfaToken) return <MfaStep token={mfaToken} onDone={() => router.replace("/app")} />;

  return (
    <div>
      <h1 className="font-display text-3xl">Nouveau mot de passe</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec un chiffre ou un symbole.">
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field label="Confirmation">
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Enregistrer et me connecter
        </Button>
        <p className="text-xs text-subtle">Par sécurité, vos autres sessions seront déconnectées.</p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
