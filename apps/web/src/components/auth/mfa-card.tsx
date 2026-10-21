"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi } from "@/lib/api";

type Status = { enabled: boolean; recovery_codes_left: number };

/** Activation de la double authentification depuis « Mon compte ». */
export function MfaCard({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const { data, mutate } = useApi<Status>("/api/auth/mfa");
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const title = (
    <span className="inline-flex items-center gap-2">
      <ShieldCheck className="size-4 text-accent" aria-hidden /> Double authentification
    </span>
  );

  if (codes) {
    return (
      <Card>
        <CardHeader title={title} description="Activée. Conservez ces codes de secours : chacun remplace une fois le code de votre téléphone." />
        <CardBody className="space-y-4">
          <pre className="rounded-md bg-sunken p-4 text-sm leading-7 tabular-nums">{codes.join("\n")}</pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={codes.join("\n")} label="Copier les codes" />
            <Button variant="secondary" size="sm" onClick={() => setCodes(null)}>
              J&apos;ai enregistré mes codes
            </Button>
          </div>
          <Alert tone="warning">Ils ne seront plus affichés. Rangez-les dans votre gestionnaire de mots de passe.</Alert>
        </CardBody>
      </Card>
    );
  }

  if (data.enabled) {
    return (
      <Card>
        <CardHeader title={title} description={`Activée. ${data.recovery_codes_left} code${data.recovery_codes_left > 1 ? "s" : ""} de secours restant${data.recovery_codes_left > 1 ? "s" : ""}.`} />
        <CardBody className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Pour désactiver, saisissez un code de votre application ou un code de secours">
            {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={20} />}
          </Field>
          <Button
            variant="secondary"
            loading={busy}
            disabled={code.trim().length < 6}
            onClick={() =>
              run(async () => {
                await api("/api/auth/mfa/disable", { body: { code } });
                setCode("");
                await mutate();
                onChange();
                toast.success("Double authentification désactivée");
              })
            }
          >
            Désactiver
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={title} description="À chaque connexion, un code à 6 chiffres de votre téléphone en plus du mot de passe ou du lien e-mail. Obligatoire pour le back-office." />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {!setup ? (
          <Button
            loading={busy}
            onClick={() => run(async () => setSetup(await api<{ secret: string; otpauth_url: string }>("/api/auth/mfa/setup", { body: {} })))}
          >
            Activer
          </Button>
        ) : (
          <>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Ouvrez une application d&apos;authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
              <li>
                Ajoutez un compte avec cette clé{" "}
                <a href={setup.otpauth_url} className="text-accent underline">
                  (ou ouvrez ce lien depuis votre téléphone)
                </a>{" "}
                :
              </li>
            </ol>
            {/* shortcut: manual key instead of a QR code (no QR library installed); add one if users struggle. */}
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md bg-sunken px-3 py-2 font-mono text-sm tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
              <CopyButton value={setup.secret} label="Copier la clé" />
            </div>
            <Field label="Code affiché par l'application">
              {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" />}
            </Field>
            <Button
              loading={busy}
              disabled={!/^\d{6}$/.test(code)}
              onClick={() =>
                run(async () => {
                  const r = await api<{ recovery_codes: string[] }>("/api/auth/mfa/enable", { body: { code } });
                  setCodes(r.recovery_codes);
                  setSetup(null);
                  setCode("");
                  await mutate();
                  onChange();
                })
              }
            >
              Vérifier et activer
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
