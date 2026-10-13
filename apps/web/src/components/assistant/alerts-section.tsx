"use client";

import { Mail, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Switch } from "@/components/ui/form";
import { Alert, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";

type Alerts = {
  email: { configured: boolean; enabled: boolean; recipients: string[]; on: string[] };
  slack: { configured: boolean; enabled: boolean; webhook_masked: string | null; on: string[] };
  slack_allowed: boolean;
};

const EVENTS: Array<[string, string]> = [
  ["hot_lead", "Demande prioritaire"],
  ["handoff", "Demande qualifiée (autres)"],
  ["new_lead", "Coordonnées laissées sans qualification complète"],
  ["escalation", "Le visiteur demande à parler à quelqu'un"],
];

function EventPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      {EVENTS.map(([id, label]) => (
        <Checkbox
          key={id}
          label={label}
          disabled={disabled}
          checked={value.includes(id)}
          onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((x) => x !== id))}
        />
      ))}
    </div>
  );
}

export function AlertsSection({ ws, canEdit }: { ws: string; canEdit: boolean }) {
  const toast = useToast();
  const { data, mutate } = useApi<Alerts>(wsPath(ws, "/assistant/alerts"));
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [emailOn, setEmailOn] = useState<string[]>([]);
  const [slackUrl, setSlackUrl] = useState("");
  const [slackOn, setSlackOn] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRecipients(data.email.recipients);
    setEmailOn(data.email.on);
    setSlackOn(data.slack.on);
  }, [data]);

  if (!data) return <Skeleton className="h-64" />;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setSaving(key);
    try {
      await fn();
      await mutate();
      toast.success(ok);
    } catch (e) {
      toast.error("Enregistrement impossible", errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  function addRecipient() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast.error("Adresse invalide");
      return;
    }
    if (!recipients.includes(v)) setRecipients([...recipients, v]);
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <Alert tone="info">
        Les alertes s&apos;appliquent immédiatement, sans republier l&apos;assistant. Toutes les demandes restent aussi visibles dans{" "}
        <Link href={`/app/${ws}/demandes`} className="font-medium underline">
          Demandes
        </Link>
        .
      </Alert>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Mail className="size-4" /> Alertes par e-mail
            </span>
          }
          action={
            data.email.configured && (
              <Switch
                checked={data.email.enabled}
                disabled={!canEdit}
                label="Activer les alertes e-mail"
                onChange={(v) => run("email-toggle", () => api(wsPath(ws, "/assistant/alerts/email"), { method: "PUT", body: { recipients, on: emailOn, enabled: v } }), v ? "Alertes activées" : "Alertes en pause")}
              />
            )
          }
        />
        <CardBody className="space-y-5">
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Destinataires (5 maximum)</p>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((r) => (
                <Badge key={r} className="gap-1 py-1">
                  {r}
                  {canEdit && (
                    <button onClick={() => setRecipients(recipients.filter((x) => x !== r))} aria-label={`Retirer ${r}`}>
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {canEdit && recipients.length < 5 && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="email"
                  placeholder="accueil@mon-cabinet.fr"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  aria-label="Ajouter un destinataire"
                />
                <Button variant="secondary" onClick={addRecipient}>
                  Ajouter
                </Button>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">Envoyer une alerte pour</p>
            <EventPicker value={emailOn} onChange={setEmailOn} disabled={!canEdit} />
          </div>
        </CardBody>
        {canEdit && (
          <CardFooter>
            {data.email.configured && (
              <Button variant="ghost" loading={saving === "email-del"} onClick={() => run("email-del", () => api(wsPath(ws, "/assistant/alerts/email"), { method: "DELETE" }), "Alertes e-mail supprimées")}>
                Supprimer
              </Button>
            )}
            <Button
              loading={saving === "email"}
              disabled={recipients.length === 0 || emailOn.length === 0}
              onClick={() => run("email", () => api(wsPath(ws, "/assistant/alerts/email"), { method: "PUT", body: { recipients, on: emailOn } }), "Alertes e-mail enregistrées")}
            >
              Enregistrer
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <MessageSquare className="size-4" /> Alertes Slack
            </span>
          }
          description={data.slack_allowed ? "Publiez les demandes dans un canal Slack." : "Disponible à partir de l'offre Cabinet."}
          action={
            data.slack.configured && (
              <Switch
                checked={data.slack.enabled}
                disabled={!canEdit}
                label="Activer Slack"
                onChange={(v) => run("slack-toggle", () => api(wsPath(ws, "/assistant/alerts/slack"), { method: "PUT", body: { on: slackOn, enabled: v } }), v ? "Slack activé" : "Slack en pause")}
              />
            )
          }
        />
        {data.slack_allowed ? (
          <>
            <CardBody className="space-y-5">
              <Field
                label="URL du webhook entrant"
                hint={
                  data.slack.webhook_masked
                    ? `Webhook actuel : ${data.slack.webhook_masked}. Laissez vide pour le conserver.`
                    : "Slack › Applications › Incoming Webhooks › Ajouter au canal."
                }
              >
                {(p) => <Input {...p} disabled={!canEdit} placeholder="https://hooks.slack.com/services/…" value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} />}
              </Field>
              <div>
                <p className="mb-2 text-[13px] font-medium">Publier pour</p>
                <EventPicker value={slackOn} onChange={setSlackOn} disabled={!canEdit} />
              </div>
            </CardBody>
            {canEdit && (
              <CardFooter>
                {data.slack.configured && (
                  <Button variant="ghost" loading={saving === "slack-del"} onClick={() => run("slack-del", () => api(wsPath(ws, "/assistant/alerts/slack"), { method: "DELETE" }), "Slack déconnecté")}>
                    Déconnecter
                  </Button>
                )}
                <Button
                  loading={saving === "slack"}
                  disabled={(!slackUrl && !data.slack.configured) || slackOn.length === 0}
                  onClick={() =>
                    run(
                      "slack",
                      async () => {
                        await api(wsPath(ws, "/assistant/alerts/slack"), { method: "PUT", body: { webhook_url: slackUrl || undefined, on: slackOn } });
                        setSlackUrl("");
                      },
                      "Slack connecté",
                    )
                  }
                >
                  Enregistrer
                </Button>
              </CardFooter>
            )}
          </>
        ) : (
          <CardBody>
            <Link href={`/app/${ws}/facturation`} className="text-sm font-medium text-accent hover:underline">
              Voir les offres
            </Link>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
