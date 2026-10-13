"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, useApi, wsPath } from "@/lib/api";

type DocConfig = {
  documents: { accepted_types: string[] };
  validation: { rules: Array<{ kind: string; params?: Record<string, unknown> }> };
  action: { target: { provider: string }; require_review?: boolean; sandbox?: boolean };
  alerts: { human_review: { min_confidence: number } };
};

export function DocumentSettingsDialog({ ws, open, onClose }: { ws: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data, mutate } = useApi<{ config: DocConfig }>(open ? wsPath(ws, "/documents/settings/config") : null);
  const [form, setForm] = useState({
    min_confidence: 0.8,
    require_review: true,
    max_auto_draft_eur: 5000,
    accepted_types: ["invoice", "quote"],
    target_provider: "pennylane",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const c = data.config;
    const threshold = c.validation.rules.find((r) => r.kind === "approval_threshold")?.params?.max_auto_draft_eur;
    setForm({
      min_confidence: c.alerts.human_review.min_confidence,
      require_review: c.action.require_review !== false,
      max_auto_draft_eur: typeof threshold === "number" ? threshold : 5000,
      accepted_types: c.documents.accepted_types,
      target_provider: c.action.target.provider === "sellsy" ? "sellsy" : "pennylane",
    });
  }, [data]);

  const toggleType = (t: string, on: boolean) =>
    setForm((f) => ({ ...f, accepted_types: on ? [...f.accepted_types, t] : f.accepted_types.filter((x) => x !== t) }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Réglages des documents"
      description="S'appliquent aux prochains documents envoyés."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={saving}
            disabled={form.accepted_types.length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await api(wsPath(ws, "/documents/settings/config"), { method: "PUT", body: form });
                await mutate();
                toast.success("Réglages enregistrés");
                onClose();
              } catch (e) {
                toast.error("Enregistrement impossible", errorMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <Switch checked={form.require_review} onChange={(v) => setForm({ ...form, require_review: v })} label="Validation humaine systématique" />
          <div>
            <p className="text-sm font-medium">Toujours valider avant envoi</p>
            <p className="text-[13px] text-muted">
              Recommandé. Désactivé, les documents sans anomalie et sous le seuil partent directement en brouillon.
            </p>
          </div>
        </div>
        <Field label="Seuil de validation automatique (TTC)" hint="Au-dessus, une validation humaine est toujours demandée.">
          {(p) => (
            <div className="flex items-center gap-2">
              <Input {...p} type="number" min={0} step={100} value={form.max_auto_draft_eur} onChange={(e) => setForm({ ...form, max_auto_draft_eur: Number(e.target.value) })} />
              <span className="text-sm text-muted">€</span>
            </div>
          )}
        </Field>
        <Field label="Exigence de fiabilité de lecture" hint="En dessous, le document est marqué « lecture incertaine ».">
          {(p) => (
            <Select {...p} value={String(form.min_confidence)} onChange={(e) => setForm({ ...form, min_confidence: Number(e.target.value) })}>
              <option value="0.7">Souple (70 %)</option>
              <option value="0.8">Standard (80 %)</option>
              <option value="0.9">Stricte (90 %)</option>
            </Select>
          )}
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Types de documents acceptés</legend>
          <div className="space-y-2">
            {[
              ["invoice", "Factures fournisseurs"],
              ["quote", "Devis"],
              ["delivery_note", "Bons de livraison"],
            ].map(([t, l]) => (
              <Checkbox key={t} label={l} checked={form.accepted_types.includes(t!)} onChange={(e) => toggleType(t!, e.target.checked)} />
            ))}
          </div>
        </fieldset>
        <Field label="Logiciel comptable" hint="Connectez-le dans Intégrations ; en attendant, les brouillons sont simulés.">
          {(p) => (
            <Select {...p} value={form.target_provider} onChange={(e) => setForm({ ...form, target_provider: e.target.value })}>
              <option value="pennylane">Pennylane</option>
              <option value="sellsy">Sellsy</option>
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}
