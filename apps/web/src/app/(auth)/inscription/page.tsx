"use client";

import { Briefcase, Calculator, Landmark, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { siteHref } from "@/lib/sites";

const PROFESSIONS = [
  { id: "avocat", label: "Avocat", Icon: Scale },
  { id: "expert_comptable", label: "Expert-comptable", Icon: Calculator },
  { id: "notaire", label: "Notaire", Icon: Landmark },
  { id: "autre", label: "Autre", Icon: Briefcase },
] as const;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = PROFESSIONS.find((p) => p.id === params.get("profession"))?.id ?? "avocat";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    workspace_name: "",
    profession: initial as string,
    accept_terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.accept_terms) {
      setFieldErrors({ accept_terms: "Vous devez accepter les conditions pour continuer." });
      return;
    }
    setLoading(true);
    try {
      const r = await api<{ workspace: string }>("/api/auth/signup", { body: form });
      router.replace(`/app/${r.workspace}/bienvenue`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      }
      if (err instanceof ApiError && err.code === "weak_password") setFieldErrors({ password: err.message });
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Créez votre espace</h1>
      <p className="mt-2 text-sm text-muted">
        14 jours d&apos;essai complet, sans carte bancaire. Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-accent hover:underline">
          Se connecter
        </Link>
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Votre profession</legend>
          <div className="grid grid-cols-2 gap-2">
            {PROFESSIONS.map(({ id, label, Icon }) => (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors",
                  form.profession === id
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line-strong bg-surface hover:bg-sunken",
                )}
              >
                <input
                  type="radio"
                  name="profession"
                  value={id}
                  checked={form.profession === id}
                  onChange={() => set("profession", id)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Nom du cabinet" error={fieldErrors.workspace_name}>
          {(p) => (
            <Input
              {...p}
              placeholder="Cabinet Durand & Associés"
              autoComplete="organization"
              value={form.workspace_name}
              onChange={(e) => set("workspace_name", e.target.value)}
            />
          )}
        </Field>
        <Field label="Votre nom" error={fieldErrors.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />}
        </Field>
        <Field label="E-mail professionnel" error={fieldErrors.email}>
          {(p) => (
            <Input {...p} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          )}
        </Field>
        <Field label="Mot de passe" hint="10 caractères minimum, avec un chiffre ou un symbole." error={fieldErrors.password}>
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          )}
        </Field>
        <div>
          <Checkbox
            checked={form.accept_terms}
            onChange={(e) => set("accept_terms", e.target.checked)}
            label={
              <>
                J&apos;accepte les{" "}
                <a href={siteHref("assistant", "/legal/cgu")} target="_blank" className="text-accent underline-offset-2 hover:underline">
                  conditions d&apos;utilisation
                </a>{" "}
                et la{" "}
                <a href={siteHref("assistant", "/legal/confidentialite")} target="_blank" className="text-accent underline-offset-2 hover:underline">
                  politique de confidentialité
                </a>
                .
              </>
            }
          />
          {fieldErrors.accept_terms && <p className="mt-1 text-[13px] text-danger">{fieldErrors.accept_terms}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Démarrer mon essai gratuit
        </Button>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
