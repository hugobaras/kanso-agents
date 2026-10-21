"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { MfaStep, type MfaChallenge } from "@/components/auth/mfa-step";
import { api, errorMessage } from "@/lib/api";
import { useAuthProduct, withProduct } from "@/lib/product";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}

function LoginForm() {
  const router = useRouter();
  const product = useAuthProduct();
  const params = useSearchParams();
  const next = safeNext(params.get("suite"));
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "password") {
        const r = await api<MfaChallenge>("/api/auth/login", { body: { email, password } });
        if (r.mfa_required && r.mfa_token) {
          setMfaToken(r.mfa_token);
          return;
        }
        router.replace(next);
        router.refresh();
      } else {
        await api("/api/auth/magic-link", { body: { email } });
        setSent(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (mfaToken) {
    return (
      <MfaStep
        token={mfaToken}
        onDone={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    );
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl">Vérifiez votre boîte mail</h1>
        <p className="mt-3 text-sm text-muted">
          Si un compte existe pour <strong className="text-ink">{email}</strong>, un lien de connexion valable 20 minutes vient
          de vous être envoyé.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Bon retour</h1>
      <p className="mt-2 text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href={withProduct(product, "/inscription")} className="font-medium text-accent hover:underline">
          Essayer gratuitement 14 jours
        </Link>
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {params.get("expire") && <Alert tone="info">Votre session a expiré. Reconnectez-vous.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Adresse e-mail">
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        {mode === "password" && (
          <Field
            label="Mot de passe"
            hint={
              <Link href="/mot-de-passe-oublie" className="text-accent hover:underline">
                Mot de passe oublié ?
              </Link>
            }
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {mode === "password" ? "Se connecter" : "Recevoir un lien de connexion"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          setMode(mode === "password" ? "magic" : "password");
          setError(null);
        }}
      >
        {mode === "password" ? "Recevoir un lien par e-mail" : "Utiliser mon mot de passe"}
      </Button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
