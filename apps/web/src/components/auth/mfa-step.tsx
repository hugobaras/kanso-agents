"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";

export type MfaChallenge = { mfa_required?: boolean; mfa_token?: string };

/** Second step of a sign-in on an account protected by two-factor authentication. */
export function MfaStep({ token, onDone }: { token: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login/mfa", { body: { mfa_token: token, code } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Code de vérification</h1>
      <p className="mt-2 text-sm text-muted">Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Code" hint="Téléphone perdu ? Saisissez l'un de vos codes de secours.">
          {(p) => (
            <Input
              {...p}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="text"
              autoFocus
              placeholder="123456"
              maxLength={20}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={loading} disabled={code.trim().length < 6}>
          Valider
        </Button>
      </form>
    </div>
  );
}
