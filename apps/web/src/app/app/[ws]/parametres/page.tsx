"use client";

import { ArrowRight, Database } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, wsPath } from "@/lib/api";
import { PROFESSION_LABEL } from "@/lib/format";

export default function SettingsPage() {
  const { ws, overview, can, refreshOverview } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState(overview.workspace.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(overview.workspace.name), [overview.workspace.name]);
  const ent = overview.entitlements;

  async function patch(body: unknown, msg: string) {
    setSaving(true);
    try {
      await api(wsPath(ws), { method: "PATCH", body });
      await refreshOverview();
      toast.success(msg);
    } catch (e) {
      toast.error("Enregistrement impossible", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Informations de l'espace et modules activés." />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Cabinet" />
          <CardBody className="space-y-4">
            <Field label="Nom de l'espace">
              {(p) => <Input {...p} disabled={!can("admin")} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted">Identifiant</dt>
                <dd className="font-mono text-[13px]">{ws}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Profession</dt>
                <dd>{PROFESSION_LABEL[overview.workspace.profession ?? "autre"]}</dd>
              </div>
            </dl>
          </CardBody>
          {can("admin") && (
            <CardFooter>
              <Button loading={saving} disabled={name.trim() === overview.workspace.name || name.trim().length < 2} onClick={() => patch({ name: name.trim() }, "Nom mis à jour")}>
                Enregistrer
              </Button>
            </CardFooter>
          )}
        </Card>

        {ent.product !== "portail" && (
        <Card>
          <CardHeader title="Modules" description="Désactivez un module que vous n'utilisez pas : il disparaît de l'interface." />
          <CardBody className="divide-y divide-line py-0">
            {(
              [
                ["inbound", "Assistant d'accueil", "Qualifie les demandes des visiteurs de votre site."],
                ["document_to_action", "Traitement des documents", "Extrait les factures et prépare les brouillons comptables."],
              ] as const
            ).map(([key, title, desc]) => {
              const allowed = key === "inbound" || ent.plan === "trial" || ent.plan === "cabinet" || ent.plan === "expert";
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-[13px] text-muted">{allowed ? desc : "Non inclus dans votre offre."}</p>
                  </div>
                  <Switch
                    checked={ent.modules[key]}
                    disabled={!can("admin") || !allowed || saving}
                    label={title}
                    onChange={(v) => patch({ modules: { [key]: v } }, v ? `${title} activé` : `${title} désactivé`)}
                  />
                </div>
              );
            })}
          </CardBody>
        </Card>
        )}

        <Link href={`/app/${ws}/parametres/donnees`} className="group block">
          <Card className="transition-colors group-hover:border-line-strong">
            <CardBody className="flex items-center gap-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Database className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-medium">Données et RGPD</p>
                <p className="text-[13px] text-muted">Accord de traitement, sous-traitants, durées de conservation, export, suppression.</p>
              </div>
              <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
            </CardBody>
          </Card>
        </Link>
      </div>
    </>
  );
}
