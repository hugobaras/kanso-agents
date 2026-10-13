"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/password/forgot", { body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Mot de passe oublié</h1>
      {sent ? (
        <>
          <p className="mt-3 text-sm text-muted">
            Si un compte existe pour <strong className="text-ink">{email}</strong>, vous allez recevoir un lien pour choisir un
            nouveau mot de passe. Il expire dans une heure.
          </p>
          <Link href="/connexion" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            Retour à la connexion
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-sm text-muted">Indiquez votre adresse : nous vous envoyons un lien de réinitialisation.</p>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Adresse e-mail">
            {(p) => <Input {...p} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Envoyer le lien
          </Button>
          <Link href="/connexion" className="block text-center text-sm text-muted hover:text-ink">
            Retour à la connexion
          </Link>
        </form>
      )}
    </div>
  );
}
