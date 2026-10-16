"use client";

import { Eye, History, Rocket, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AlertsSection } from "@/components/assistant/alerts-section";
import { ChatPreview } from "@/components/assistant/chat-preview";
import {
  HoursSection,
  IdentitySection,
  QuestionsSection,
  SafetySection,
  ScoringSection,
} from "@/components/assistant/sections";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, PageHeader, Tabs } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, useApi, wsPath } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { InboundConfig } from "@/lib/types";

type AssistantData = {
  draft: InboundConfig;
  draft_source: "draft" | "published" | "template";
  published: InboundConfig | null;
  published_version: number | null;
  published_at: string | null;
  has_unpublished_changes: boolean;
  versions: Array<{ version: number; status: string; published_at: string | null; published_by: string | null }>;
};

type Tab = "identite" | "questions" | "scoring" | "horaires" | "securite" | "alertes";

export default function AssistantPage() {
  const { ws, can, refreshOverview } = useWorkspace();
  const toast = useToast();
  const { data, mutate } = useApi<AssistantData>(wsPath(ws, "/assistant"), { revalidateOnFocus: false });
  const [config, setConfig] = useState<InboundConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("identite");
  const [saving, setSaving] = useState<"save" | "publish" | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const canEdit = can("admin");

  useEffect(() => {
    if (data && !dirty) setConfig(data.draft);
  }, [data, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const onChange = useCallback((c: InboundConfig) => {
    setConfig(c);
    setDirty(true);
  }, []);

  async function save(): Promise<boolean> {
    if (!config) return false;
    setErrors([]);
    try {
      const r = await api<{ config: InboundConfig }>(wsPath(ws, "/assistant/draft"), { method: "PUT", body: { config } });
      setConfig(r.config);
      setDirty(false);
      await mutate();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.details);
      toast.error("Brouillon non enregistré", errorMessage(e));
      return false;
    }
  }

  async function onSave() {
    setSaving("save");
    if (await save()) toast.success("Brouillon enregistré", "Publiez pour mettre à jour votre site.");
    setSaving(null);
  }

  async function onPublish() {
    setSaving("publish");
    try {
      if (dirty && !(await save())) return;
      const r = await api<{ version: number }>(wsPath(ws, "/assistant/publish"), { method: "POST" });
      await mutate();
      void refreshOverview();
      toast.success(`Version ${r.version} publiée`, "Votre site utilise désormais cette configuration.");
    } catch (e) {
      toast.error("Publication impossible", errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  async function restore(version: number) {
    try {
      const r = await api<{ config: InboundConfig }>(wsPath(ws, `/assistant/restore/${version}`), { method: "POST" });
      setConfig(r.config);
      setDirty(false);
      await mutate();
      setShowHistory(false);
      toast.success(`Version ${version} restaurée dans le brouillon`);
    } catch (e) {
      toast.error("Restauration impossible", errorMessage(e));
    }
  }

  if (!data || !config) return <PageSpinner />;
  const pending = dirty || data.has_unpublished_changes;

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Personnalisez les questions, le score et le ton de votre assistant d'accueil."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              <History className="size-4" /> Historique
            </Button>
            <Button variant="secondary" size="sm" className="xl:hidden" onClick={() => setShowPreview(true)}>
              <Eye className="size-4" /> Aperçu
            </Button>
            {canEdit && tab !== "alertes" && (
              <>
                <Button variant="secondary" size="sm" onClick={onSave} loading={saving === "save"} disabled={!dirty}>
                  <Save className="size-4" /> Enregistrer
                </Button>
                <Button size="sm" onClick={onPublish} loading={saving === "publish"} disabled={!pending}>
                  <Rocket className="size-4" /> Publier
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        {data.published_version ? (
          <Badge tone="success" dot>
            Version {data.published_version} en ligne
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            Jamais publié
          </Badge>
        )}
        {pending && <Badge tone="info">Modifications non publiées</Badge>}
        {data.published_at && <span className="text-xs text-muted">Publié le {formatDateTime(data.published_at)}</span>}
      </div>
      {!canEdit && <Alert tone="info" className="mb-5">Lecture seule : seuls les administrateurs peuvent modifier l&apos;assistant.</Alert>}
      {errors.length > 0 && (
        <Alert tone="danger" title="La configuration contient des erreurs" className="mb-5">
          <ul className="list-disc pl-4">
            {errors.slice(0, 5).map((e) => (
              <li key={e.path}>{e.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: "identite", label: "Identité" },
          { value: "questions", label: "Questions" },
          { value: "scoring", label: "Score" },
          { value: "horaires", label: "Horaires" },
          { value: "securite", label: "Mentions & sécurité" },
          { value: "alertes", label: "Alertes" },
        ]}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {tab === "identite" && <IdentitySection config={config} onChange={onChange} readOnly={!canEdit} />}
          {tab === "questions" && <QuestionsSection config={config} onChange={onChange} readOnly={!canEdit} />}
          {tab === "scoring" && <ScoringSection config={config} onChange={onChange} readOnly={!canEdit} />}
          {tab === "horaires" && <HoursSection config={config} onChange={onChange} readOnly={!canEdit} />}
          {tab === "securite" && <SafetySection config={config} onChange={onChange} readOnly={!canEdit} />}
          {tab === "alertes" && <AlertsSection ws={ws} canEdit={canEdit} />}
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Aperçu en direct</p>
            <ChatPreview ws={ws} config={config} />
          </div>
        </aside>
      </div>

      <Dialog open={showPreview} onClose={() => setShowPreview(false)} title="Aperçu" size="md">
        <ChatPreview ws={ws} config={config} />
      </Dialog>

      <Dialog open={showHistory} onClose={() => setShowHistory(false)} title="Versions publiées" description="Restaurer une version la copie dans le brouillon, sans la publier.">
        <ul className="divide-y divide-line">
          {data.versions.map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  Version {v.version} {v.status === "published" && <Badge tone="success">en ligne</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(v.published_at)} · {v.published_by?.replace(/^portal:|^app:/, "") ?? "—"}
                </p>
              </div>
              {canEdit && v.status !== "published" && (
                <Button size="sm" variant="secondary" onClick={() => restore(v.version)}>
                  Restaurer
                </Button>
              )}
            </li>
          ))}
          {data.versions.length === 0 && <li className="py-6 text-center text-sm text-muted">Aucune version publiée.</li>}
        </ul>
      </Dialog>
    </>
  );
}
