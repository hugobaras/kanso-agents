"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, wsPath } from "@/lib/api";
import { siteHref } from "@/lib/sites";

export const DPA_VERSION = "2026-10";

/** In-app acceptance of the data processing agreement (art. 28 RGPD). */
export function DpaCard({ ws, canAccept, onAccepted }: { ws: string; canAccept: boolean; onAccepted: () => void }) {
  const toast = useToast();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" /> Accord de traitement des données
          </span>
        }
        description="Requis avant d'envoyer des documents contenant des données de vos clients."
      />
      <CardBody className="space-y-3 text-sm text-ink/90">
        <p>
          Kanso agit comme sous-traitant au sens de l&apos;article 28 du RGPD : vos documents sont traités uniquement pour en
          extraire les informations demandées, hébergés dans l&apos;Union européenne et supprimés après 90 jours.
        </p>
        <p>
          <a href={siteHref("assistant", "/legal/dpa")} target="_blank" className="font-medium text-accent hover:underline">
            Lire l&apos;accord complet (version {DPA_VERSION})
          </a>{" "}
          ·{" "}
          <a href={siteHref("assistant", "/legal/sous-traitants")} target="_blank" className="text-accent hover:underline">
            Liste des sous-traitants
          </a>
        </p>
        {canAccept ? (
          <Checkbox
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            label="J'ai lu l'accord et je l'accepte au nom de mon cabinet, que je suis habilité(e) à engager."
          />
        ) : (
          <p className="text-muted">Seul un propriétaire de l&apos;espace peut accepter l&apos;accord.</p>
        )}
      </CardBody>
      {canAccept && (
        <CardFooter>
          <Button
            disabled={!checked}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await api(wsPath(ws, "/settings/privacy/dpa"), { body: { version: DPA_VERSION, accept: true } });
                toast.success("Accord accepté", "Vous pouvez maintenant envoyer vos documents.");
                onAccepted();
              } catch (e) {
                toast.error("Impossible d'enregistrer", errorMessage(e));
              } finally {
                setLoading(false);
              }
            }}
          >
            Accepter l&apos;accord
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
