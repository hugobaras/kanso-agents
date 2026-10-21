"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { Alert, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AiStatus } from "@/lib/portail";
import { siteHref } from "@/lib/sites";

/** Activation de l'analyse IA : réservée au propriétaire, après acceptation de l'avenant. */
export function AiSettingsCard() {
  const { ws, can } = useWorkspace();
  const toast = useToast();
  const { data, mutate } = useApi<AiStatus>(wsPath(ws, "/portail/ai"));
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await api(wsPath(ws, "/portail/ai"), { method: "PUT", body: { enabled, accept_terms: enabled ? data!.terms_version : undefined } });
      await mutate();
      toast.success(enabled ? "Analyse IA activée" : "Analyse IA désactivée", enabled ? undefined : "Les textes extraits ont été supprimés.");
    } catch (e) {
      toast.error("Modification impossible", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden /> Analyse IA des pièces
          </span>
        }
        description="Résumé du dossier, contrôle des pièces reçues et questions sur leur contenu. Des suggestions citées, jamais de décision automatique."
      />
      <CardBody className="space-y-4 text-sm">
        {!data.entitled ? (
          <Alert tone="info">L&apos;analyse IA est incluse dans l&apos;offre Portail Cabinet.</Alert>
        ) : data.enabled ? (
          <>
            <p className="text-muted">
              Activée{data.accepted_at ? ` le ${formatDate(data.accepted_at)}` : ""}. Vous pouvez exclure un dossier ou une pièce (par exemple un certificat
              médical) depuis la fiche du dossier.
            </p>
            <div>
              <p className="text-[13px] text-muted">
                Pages analysées ce mois : {data.usage.used} / {data.usage.limit}
              </p>
              <Progress value={data.usage.used} max={data.usage.limit} className="mt-2" />
            </div>
            {can("owner") && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => toggle(false)}>
                Désactiver et supprimer les textes extraits
              </Button>
            )}
          </>
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Le texte des pièces est extrait puis chiffré ; il est effacé si vous désactivez la fonction.</li>
              <li>Chaque analyse ne porte que sur un seul dossier et n&apos;est pas conservée.</li>
              <li>Traitement par Mistral AI, dans l&apos;Union européenne, sans réutilisation pour l&apos;entraînement.</li>
            </ul>
            {can("owner") ? (
              <>
                <Checkbox
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  label={
                    <>
                      J&apos;accepte l&apos;
                      <a className="text-accent underline" href={siteHref("portail", "/legal/avenant-ia")} target="_blank" rel="noreferrer">
                        avenant « Analyse IA » à l&apos;accord de traitement des données
                      </a>{" "}
                      (version {data.terms_version}) et j&apos;informe mes clients de cette analyse.
                    </>
                  }
                />
                <Button size="sm" disabled={!accepted} loading={busy} onClick={() => toggle(true)}>
                  Activer l&apos;analyse IA
                </Button>
              </>
            ) : (
              <p className="text-muted">Seul le propriétaire de l&apos;espace peut activer cette fonction.</p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
