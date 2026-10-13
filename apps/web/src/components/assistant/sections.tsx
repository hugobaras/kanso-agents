"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { contrast } from "@/lib/color";
import type { InboundConfig, InboundQuestion, Weight } from "@/lib/types";

type Props = { config: InboundConfig; onChange: (c: InboundConfig) => void; readOnly?: boolean };

export function slugId(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "q";
  let id = base;
  let i = 2;
  while (taken.has(id)) id = `${base}_${i++}`;
  return id;
}

const SWATCHES = ["#1B2A4A", "#1F6F6B", "#0F4C3A", "#5B2A4A", "#7A3E1D", "#2D5B8A", "#3B3B3B"];

export function IdentitySection({ config, onChange, readOnly }: Props) {
  const id = config.identity;
  const set = (patch: Partial<InboundConfig["identity"]>) => onChange({ ...config, identity: { ...id, ...patch } });
  const color = id.branding.primary_color;
  const validColor = /^#[0-9a-fA-F]{6}$/.test(color);
  const ratio = validColor ? contrast(color, "#ffffff") : 0;
  return (
    <Card>
      <CardHeader title="Identité et apparence" description="Ce que vos visiteurs voient en ouvrant l'assistant." />
      <CardBody className="space-y-5">
        <Field label="Nom affiché">
          {(p) => <Input {...p} disabled={readOnly} value={id.display_name} onChange={(e) => set({ display_name: e.target.value })} />}
        </Field>
        <Field label="Message d'accueil" hint="Une phrase courte, avant les mentions légales." optional>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={280}
              disabled={readOnly}
              value={id.welcome_message ?? ""}
              onChange={(e) => set({ welcome_message: e.target.value || undefined })}
            />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Couleur principale</p>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                disabled={readOnly}
                onClick={() => set({ branding: { ...id.branding, primary_color: c } })}
                className={cn(
                  "size-8 rounded-full ring-offset-2 transition",
                  color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-ink" : "hover:scale-105",
                )}
                style={{ background: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
            <label className="relative flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface pl-1 pr-2 text-sm">
              <input
                type="color"
                disabled={readOnly}
                value={validColor ? color : "#1b2a4a"}
                onChange={(e) => set({ branding: { ...id.branding, primary_color: e.target.value.toUpperCase() } })}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Couleur personnalisée"
              />
              <input
                className="w-20 bg-transparent font-mono text-xs uppercase outline-none"
                value={color}
                disabled={readOnly}
                onChange={(e) => set({ branding: { ...id.branding, primary_color: e.target.value } })}
                aria-label="Code couleur"
              />
            </label>
          </div>
          {!validColor ? (
            <p className="mt-1.5 text-[13px] text-danger">Format attendu : #RRGGBB</p>
          ) : ratio < 4.5 ? (
            <p className="mt-1.5 text-[13px] text-warning">
              Couleur claire (contraste {ratio.toFixed(1)}:1) : le texte des boutons passera en foncé pour rester lisible.
            </p>
          ) : null}
        </div>
        <Field label="Logo (URL)" hint="Image carrée en HTTPS, idéalement 128 × 128 px." optional>
          {(p) => (
            <Input
              {...p}
              type="url"
              disabled={readOnly}
              placeholder="https://www.mon-cabinet.fr/logo.png"
              value={id.branding.logo_url ?? ""}
              onChange={(e) => set({ branding: { ...id.branding, logo_url: e.target.value || null } })}
            />
          )}
        </Field>
        <Field label="Langue de l'assistant">
          {(p) => (
            <Select
              {...p}
              disabled={readOnly}
              value={id.locale_default}
              onChange={(e) => set({ locale_default: e.target.value as "fr" | "en" })}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </CardBody>
    </Card>
  );
}

const TYPE_LABEL: Record<InboundQuestion["type"], string> = {
  single_choice: "Choix unique",
  multi_choice: "Choix multiples",
  free_text: "Texte libre",
  number: "Nombre",
  boolean: "Oui / non",
};

function defaultWeight(q: InboundQuestion): Weight {
  switch (q.type) {
    case "single_choice":
    case "multi_choice":
      return { kind: "choice_map", points: Object.fromEntries((q.options ?? []).map((o) => [o.id, 10])) };
    case "boolean":
      return { kind: "boolean", true_points: 10, false_points: 0 };
    case "number":
      return { kind: "number_range", ranges: [{ min: 0, max: 1_000_000, points: 10 }] };
    default:
      return { kind: "free_text", points_if_non_empty: 5 };
  }
}

export function QuestionsSection({ config, onChange, readOnly }: Props) {
  const questions = config.qualification.questions;
  const [openId, setOpenId] = useState<string | null>(null);

  function setQuestions(next: InboundQuestion[], weights = config.scoring.weights) {
    onChange({ ...config, qualification: { questions: next }, scoring: { ...config.scoring, weights } });
  }
  function update(i: number, patch: Partial<InboundQuestion>) {
    const next = [...questions];
    const q = { ...next[i]!, ...patch };
    next[i] = q;
    let weights = config.scoring.weights;
    if (patch.type && patch.type !== questions[i]!.type) {
      if ((patch.type === "single_choice" || patch.type === "multi_choice") && !q.options?.length) {
        q.options = [
          { id: "option_1", label: "Option 1" },
          { id: "option_2", label: "Option 2" },
        ];
      }
      if (patch.type !== "single_choice" && patch.type !== "multi_choice") delete q.options;
      weights = { ...weights, [q.id]: defaultWeight(q) };
    }
    setQuestions(next, weights);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setQuestions(next);
  }
  function remove(i: number) {
    const q = questions[i]!;
    const weights = { ...config.scoring.weights };
    delete weights[q.id];
    setQuestions(
      questions.filter((_, k) => k !== i),
      weights,
    );
  }
  function add() {
    const id = slugId("nouvelle_question", new Set(questions.map((q) => q.id)));
    const q: InboundQuestion = {
      id,
      prompt: "Nouvelle question ?",
      type: "single_choice",
      required: true,
      options: [
        { id: "option_1", label: "Option 1" },
        { id: "option_2", label: "Option 2" },
      ],
    };
    // Insert before the contact questions, which conventionally close the flow.
    const contactIdx = questions.findIndex((x) => /contact|email|nom|name/.test(x.id));
    const next = [...questions];
    next.splice(contactIdx >= 0 ? contactIdx : next.length, 0, q);
    setQuestions(next, { ...config.scoring.weights, [id]: defaultWeight(q) });
    setOpenId(id);
  }
  function setOption(qi: number, oi: number, label: string) {
    const q = questions[qi]!;
    const options = [...(q.options ?? [])];
    options[oi] = { ...options[oi]!, label };
    update(qi, { options });
  }
  function addOption(qi: number) {
    const q = questions[qi]!;
    const taken = new Set((q.options ?? []).map((o) => o.id));
    const label = `Option ${(q.options?.length ?? 0) + 1}`;
    const id = slugId(label, taken);
    const w = config.scoring.weights[q.id];
    const weights =
      w?.kind === "choice_map" ? { ...config.scoring.weights, [q.id]: { ...w, points: { ...w.points, [id]: 10 } } } : config.scoring.weights;
    const next = [...questions];
    next[qi] = { ...q, options: [...(q.options ?? []), { id, label }] };
    setQuestions(next, weights);
  }
  function removeOption(qi: number, oi: number) {
    const q = questions[qi]!;
    const opt = q.options![oi]!;
    const w = config.scoring.weights[q.id];
    const weights = { ...config.scoring.weights };
    if (w?.kind === "choice_map") {
      const points = { ...w.points };
      delete points[opt.id];
      weights[q.id] = { ...w, points };
    }
    const next = [...questions];
    next[qi] = { ...q, options: q.options!.filter((_, k) => k !== oi) };
    setQuestions(next, weights);
  }

  return (
    <Card>
      <CardHeader
        title="Questions de qualification"
        description="Posées dans l'ordre. L'assistant reformule et comprend les réponses libres."
        action={
          !readOnly && (
            <Button size="sm" variant="secondary" onClick={add}>
              <Plus className="size-4" /> Ajouter
            </Button>
          )
        }
      />
      <ul className="divide-y divide-line">
        {questions.map((q, i) => {
          const open = openId === q.id;
          return (
            <li key={q.id} className={cn(open && "bg-paper/60")}>
              <div className="flex items-center gap-2 px-4 py-3">
                <GripVertical className="size-4 shrink-0 text-line-strong" aria-hidden />
                <span className="w-5 shrink-0 text-xs text-subtle">{i + 1}.</span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : q.id)} aria-expanded={open}>
                  <span className="block truncate text-sm font-medium">{q.prompt}</span>
                  <span className="text-xs text-muted">
                    {TYPE_LABEL[q.type]}
                    {q.options ? ` · ${q.options.length} choix` : ""}
                    {!q.required && " · facultative"}
                  </span>
                </button>
                {!readOnly && (
                  <div className="flex shrink-0 items-center">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-subtle hover:bg-sunken disabled:opacity-30" aria-label="Monter">
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === questions.length - 1}
                      className="rounded p-1.5 text-subtle hover:bg-sunken disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      disabled={questions.length <= 1}
                      className="rounded p-1.5 text-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                      aria-label="Supprimer la question"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              {open && (
                <div className="space-y-4 px-4 pb-5 pl-14">
                  <Field label="Question posée">
                    {(p) => <Input {...p} disabled={readOnly} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />}
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type de réponse">
                      {(p) => (
                        <Select
                          {...p}
                          disabled={readOnly}
                          value={q.type}
                          onChange={(e) => update(i, { type: e.target.value as InboundQuestion["type"] })}
                        >
                          {Object.entries(TYPE_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <div className="flex items-end gap-3 pb-2">
                      <Switch checked={q.required} disabled={readOnly} onChange={(v) => update(i, { required: v })} label="Obligatoire" />
                      <span className="text-sm">Réponse obligatoire</span>
                    </div>
                  </div>
                  {q.options && (
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium">Choix proposés</p>
                      <ul className="space-y-2">
                        {q.options.map((o, oi) => (
                          <li key={o.id} className="flex items-center gap-2">
                            <Input
                              className="h-9"
                              disabled={readOnly}
                              value={o.label}
                              onChange={(e) => setOption(i, oi, e.target.value)}
                              aria-label={`Choix ${oi + 1}`}
                            />
                            {!readOnly && (
                              <button
                                onClick={() => removeOption(i, oi)}
                                disabled={q.options!.length <= 2}
                                className="rounded p-1.5 text-subtle hover:bg-sunken disabled:opacity-30"
                                aria-label="Retirer ce choix"
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {!readOnly && (
                        <Button size="sm" variant="ghost" className="mt-2" onClick={() => addOption(i)}>
                          <Plus className="size-4" /> Ajouter un choix
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <CardBody className="border-t border-line">
        <p className="text-xs text-muted">
          Astuce : terminez par le nom et l&apos;e-mail du visiteur. Une question dont l&apos;identifiant contient « email » ou
          « contact » sert aussi à recueillir les coordonnées quand le visiteur demande un conseil que l&apos;assistant ne peut pas
          donner.
        </p>
      </CardBody>
    </Card>
  );
}

export function maxScore(config: InboundConfig): number {
  return config.qualification.questions.reduce((sum, q) => {
    const w = config.scoring.weights[q.id];
    if (!w) return sum;
    switch (w.kind) {
      case "choice_map": {
        const vals = Object.values(w.points);
        return sum + (q.type === "multi_choice" ? vals.reduce((a, b) => a + Math.max(0, b), 0) : Math.max(0, ...vals));
      }
      case "boolean":
        return sum + Math.max(w.true_points, w.false_points);
      case "free_text":
        return sum + w.points_if_non_empty;
      case "number_range":
        return sum + Math.max(0, ...w.ranges.map((r) => r.points));
    }
  }, 0);
}

function PointsInput({ value, onChange, disabled, label }: { value: number; onChange: (n: number) => void; disabled?: boolean; label: string }) {
  return (
    <Input
      type="number"
      min={-50}
      max={100}
      className="h-8 w-20 text-right tabular-nums"
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
    />
  );
}

export function ScoringSection({ config, onChange, readOnly }: Props) {
  const { thresholds, weights } = config.scoring;
  const setWeight = (id: string, w: Weight) => onChange({ ...config, scoring: { ...config.scoring, weights: { ...weights, [id]: w } } });
  const setThreshold = (k: "hot" | "warm", v: number) =>
    onChange({ ...config, scoring: { ...config.scoring, thresholds: { ...thresholds, [k]: v } } });
  const max = maxScore(config);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Seuils de priorité" description="Le score final (sur 100) classe chaque demande." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prioritaire à partir de" hint="Alerte immédiate.">
              {(p) => (
                <Input {...p} type="number" min={1} max={100} disabled={readOnly} value={thresholds.hot} onChange={(e) => setThreshold("hot", Number(e.target.value))} />
              )}
            </Field>
            <Field label="À suivre à partir de">
              {(p) => (
                <Input {...p} type="number" min={0} max={99} disabled={readOnly} value={thresholds.warm} onChange={(e) => setThreshold("warm", Number(e.target.value))} />
              )}
            </Field>
          </div>
          <div className="relative h-2 rounded-full bg-sunken">
            <div className="absolute inset-y-0 rounded-l-full bg-[#e5e1d8]" style={{ width: `${thresholds.warm}%` }} />
            <div className="absolute inset-y-0 bg-warning/40" style={{ left: `${thresholds.warm}%`, width: `${Math.max(0, thresholds.hot - thresholds.warm)}%` }} />
            <div className="absolute inset-y-0 rounded-r-full bg-danger/50" style={{ left: `${thresholds.hot}%`, right: 0 }} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Faible</span>
            <span>À suivre</span>
            <span>Prioritaire</span>
          </div>
          {thresholds.hot <= thresholds.warm && <Alert tone="danger">Le seuil « prioritaire » doit être supérieur au seuil « à suivre ».</Alert>}
          {max < thresholds.hot && (
            <Alert tone="warning">
              Le score maximal atteignable ({max}) est inférieur au seuil prioritaire : aucune demande ne sera prioritaire.
            </Alert>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Points par réponse" description={`Score maximal atteignable : ${Math.min(100, max)} / 100`} />
        <ul className="divide-y divide-line">
          {config.qualification.questions.map((q) => {
            const w = weights[q.id] ?? defaultWeight(q);
            return (
              <li key={q.id} className="px-5 py-4">
                <p className="mb-3 text-sm font-medium">{q.prompt}</p>
                {w.kind === "choice_map" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(q.options ?? []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-1.5">
                        <span className="truncate text-sm text-muted">{o.label}</span>
                        <PointsInput
                          label={`Points pour ${o.label}`}
                          disabled={readOnly}
                          value={w.points[o.id] ?? 0}
                          onChange={(n) => setWeight(q.id, { ...w, points: { ...w.points, [o.id]: n } })}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {w.kind === "free_text" && (
                  <div className="flex items-center gap-3 text-sm text-muted">
                    Points si une réponse est donnée
                    <PointsInput label="Points" disabled={readOnly} value={w.points_if_non_empty} onChange={(n) => setWeight(q.id, { ...w, points_if_non_empty: n })} />
                  </div>
                )}
                {w.kind === "boolean" && (
                  <div className="flex flex-wrap gap-4 text-sm text-muted">
                    <span className="flex items-center gap-2">
                      Oui <PointsInput label="Points si oui" disabled={readOnly} value={w.true_points} onChange={(n) => setWeight(q.id, { ...w, true_points: n })} />
                    </span>
                    <span className="flex items-center gap-2">
                      Non <PointsInput label="Points si non" disabled={readOnly} value={w.false_points} onChange={(n) => setWeight(q.id, { ...w, false_points: n })} />
                    </span>
                  </div>
                )}
                {w.kind === "number_range" && (
                  <div className="space-y-2">
                    {w.ranges.map((r, ri) => (
                      <div key={ri} className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        De
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={r.min}
                          disabled={readOnly}
                          onChange={(e) => setWeight(q.id, { ...w, ranges: w.ranges.map((x, k) => (k === ri ? { ...x, min: Number(e.target.value) } : x)) })}
                          aria-label="Minimum"
                        />
                        à
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={r.max}
                          disabled={readOnly}
                          onChange={(e) => setWeight(q.id, { ...w, ranges: w.ranges.map((x, k) => (k === ri ? { ...x, max: Number(e.target.value) } : x)) })}
                          aria-label="Maximum"
                        />
                        <PointsInput
                          label="Points"
                          disabled={readOnly}
                          value={r.points}
                          onChange={(n) => setWeight(q.id, { ...w, ranges: w.ranges.map((x, k) => (k === ri ? { ...x, points: n } : x)) })}
                        />
                        points
                      </div>
                    ))}
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setWeight(q.id, { ...w, ranges: [...w.ranges, { min: 0, max: 0, points: 0 }] })}
                      >
                        <Plus className="size-4" /> Ajouter une tranche
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

const DAYS: Array<[string, string]> = [
  ["mon", "Lundi"],
  ["tue", "Mardi"],
  ["wed", "Mercredi"],
  ["thu", "Jeudi"],
  ["fri", "Vendredi"],
  ["sat", "Samedi"],
  ["sun", "Dimanche"],
];

export function HoursSection({ config, onChange, readOnly }: Props) {
  const ops = config.operations;
  const hours = ops.business_hours;
  const setOps = (patch: Partial<InboundConfig["operations"]>) => onChange({ ...config, operations: { ...ops, ...patch } });
  const setDay = (day: string, ranges: Array<[string, string]>) => setOps({ business_hours: { ...hours, [day]: ranges } });
  const mode = ops.after_hours_mode ?? "block";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Horaires d'ouverture" description={`Fuseau horaire : ${ops.timezone}`} />
        <ul className="divide-y divide-line">
          {DAYS.map(([key, label]) => {
            const ranges = hours[key] ?? [];
            const open = ranges.length > 0;
            return (
              <li key={key} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <div className="flex w-36 items-center gap-3">
                  <Switch
                    checked={open}
                    disabled={readOnly}
                    label={`${label} ouvert`}
                    onChange={(v) => setDay(key, v ? [["09:00", "12:30"], ["14:00", "18:00"]] : [])}
                  />
                  <span className="text-sm">{label}</span>
                </div>
                {open ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {ranges.map(([s, e], ri) => (
                      <div key={ri} className="flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1">
                        <input
                          type="time"
                          value={s}
                          disabled={readOnly}
                          onChange={(ev) => setDay(key, ranges.map((r, k) => (k === ri ? [ev.target.value, r[1]] : r)))}
                          className="bg-transparent text-sm tabular-nums outline-none"
                          aria-label={`${label} début ${ri + 1}`}
                        />
                        <span className="text-subtle">–</span>
                        <input
                          type="time"
                          value={e}
                          disabled={readOnly}
                          onChange={(ev) => setDay(key, ranges.map((r, k) => (k === ri ? [r[0], ev.target.value] : r)))}
                          className="bg-transparent text-sm tabular-nums outline-none"
                          aria-label={`${label} fin ${ri + 1}`}
                        />
                        {!readOnly && ranges.length > 1 && (
                          <button onClick={() => setDay(key, ranges.filter((_, k) => k !== ri))} className="text-subtle hover:text-ink" aria-label="Retirer la plage">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && ranges.length < 3 && (
                      <button onClick={() => setDay(key, [...ranges, ["14:00", "18:00"]])} className="text-xs text-accent hover:underline">
                        + plage
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-subtle">Fermé</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader title="En dehors des horaires" />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["qualify", "Continuer à qualifier", "L'assistant recueille la demande et précise qu'elle sera traitée à la réouverture. Recommandé."],
                ["block", "Mettre en pause", "L'assistant affiche un message d'indisponibilité et ne prend aucune demande."],
              ] as const
            ).map(([v, title, desc]) => (
              <label
                key={v}
                className={cn(
                  "cursor-pointer rounded-lg border p-4 transition-colors",
                  mode === v ? "border-accent bg-accent-soft/60" : "border-line hover:bg-paper",
                )}
              >
                <input type="radio" className="sr-only" name="after_hours" disabled={readOnly} checked={mode === v} onChange={() => setOps({ after_hours_mode: v })} />
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-[13px] text-muted">{desc}</span>
              </label>
            ))}
          </div>
          <Field label="Message hors horaires" optional hint="Laissez vide pour utiliser le message par défaut.">
            {(p) => (
              <Textarea {...p} rows={2} disabled={readOnly} value={ops.after_hours_message ?? ""} onChange={(e) => setOps({ after_hours_message: e.target.value || undefined })} />
            )}
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}

const TOPIC_LABEL: Record<string, string> = {
  conseil_juridique: "Conseil juridique",
  conseil_comptable: "Conseil comptable",
  conseil_fiscal: "Conseil fiscal",
  diagnostic_medical: "Diagnostic médical",
};

function TagInput({ values, onChange, disabled, placeholder, labels }: { values: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder: string; labels?: Record<string, string> }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent">
      {values.map((v) => (
        <Badge key={v} tone="neutral" className="gap-1 py-1">
          {labels?.[v] ?? v}
          {!disabled && (
            <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Retirer ${v}`} className="hover:text-ink">
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              if (!values.includes(draft.trim())) onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder={placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      )}
    </div>
  );
}

export function SafetySection({ config, onChange, readOnly }: Props) {
  const d = config.disclosure;
  const esc = config.operations.escalation;
  const setEsc = (patch: Partial<typeof esc>) =>
    onChange({ ...config, operations: { ...config.operations, escalation: { ...esc, ...patch } } });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Transparence" description="Obligatoire : le visiteur doit savoir qu'il échange avec une IA." />
        <CardBody className="space-y-4">
          <Field label="Mention affichée en début de conversation">
            {(p) => (
              <Textarea {...p} rows={3} disabled={readOnly} value={d.ai_notice} onChange={(e) => onChange({ ...config, disclosure: { ...d, ai_notice: e.target.value } })} />
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Sujets refusés</p>
            <TagInput
              values={d.forbidden_topics}
              labels={TOPIC_LABEL}
              disabled={readOnly}
              placeholder="Ajouter un sujet puis Entrée"
              onChange={(v) => onChange({ ...config, disclosure: { ...d, forbidden_topics: v.length ? v : d.forbidden_topics } })}
            />
            <p className="mt-1.5 text-[13px] text-muted">
              Sur ces sujets, l&apos;assistant refuse poliment et propose de transmettre les coordonnées.
            </p>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Passage à un humain" />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={esc.user_requests_human} disabled={readOnly} onChange={(v) => setEsc({ user_requests_human: v })} label="Transmettre quand le visiteur le demande" />
            <span className="text-sm">Transmettre quand le visiteur demande à parler à quelqu&apos;un</span>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Mots-clés déclencheurs</p>
            <TagInput values={esc.keywords} disabled={readOnly} placeholder="ex. urgence" onChange={(v) => setEsc({ keywords: v })} />
          </div>
          <Field label="Message de transmission">
            {(p) => <Textarea {...p} rows={2} disabled={readOnly} value={esc.message} onChange={(e) => setEsc({ message: e.target.value })} />}
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}
