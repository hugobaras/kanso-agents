"use client";

import { ArrowDownRight, Inbox, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { TierBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { api } from "@/lib/api";

type Peek = {
  state: string;
  closed: boolean;
  score: number;
  tier: string;
  thresholds: { hot: number; warm: number };
  answers: Array<{ label: string; value: string }>;
  total_questions: number;
};

export default function DemoPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onSession = (e: Event) => setSessionId((e as CustomEvent<{ sessionId: string }>).detail.sessionId);
    window.addEventListener("kanso:session", onSession);
    let cancelled = false;
    api<{ public_key: string; api_url: string; script_url: string }>("/api/public/demo")
      .then((d) => {
        if (cancelled || document.getElementById("kanso-widget-script")) return;
        const s = document.createElement("script");
        s.id = "kanso-widget-script";
        s.src = d.script_url;
        s.async = true;
        s.dataset.key = d.public_key;
        s.dataset.api = d.api_url;
        s.dataset.open = "true";
        document.body.appendChild(s);
      })
      .catch(() => setError("La démonstration est momentanément indisponible."));
    return () => {
      cancelled = true;
      window.removeEventListener("kanso:session", onSession);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    const tick = async () => {
      try {
        const p = await api<Peek>(`/api/public/demo/sessions/${sessionId}`);
        if (!stop) setPeek(p);
        if (p.closed) return;
      } catch {
        // session not yet visible
      }
      if (!stop) setTimeout(tick, 1800);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-accent">Démonstration en direct</p>
          <h1 className="mt-2 font-display text-5xl">Jouez le rôle d&apos;un client.</h1>
          <p className="mt-5 text-lg text-muted">
            L&apos;assistant en bas à droite est le vrai produit, configuré pour un cabinet d&apos;avocats fictif. Répondez à ses
            questions — ou demandez-lui un conseil juridique pour voir comment il réagit.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink/90">
            <li>• « Je suis licencié, j&apos;ai besoin d&apos;aide rapidement »</li>
            <li>• « Combien coûte un divorce ? » (il refuse de répondre sur le fond)</li>
            <li>• « Je veux parler à un avocat »</li>
          </ul>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <ArrowDownRight className="size-4" /> La bulle s&apos;ouvre en bas à droite de l&apos;écran.
          </p>
          <p className="mt-8 text-xs text-subtle">
            Les conversations de démonstration sont supprimées après une heure. N&apos;y saisissez pas de données réelles.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Mail className="size-4" /> Ce que reçoit le cabinet
          </div>
          {error ? (
            <p className="mt-8 text-sm text-danger">{error}</p>
          ) : !peek ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Inbox className="size-8 text-line-strong" />
              <p className="mt-3 text-sm text-muted">Commencez la conversation : la fiche se remplit en temps réel.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-2xl">{peek.closed ? "Demande transmise" : "Qualification en cours…"}</p>
                <TierBadge tier={peek.tier} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-muted">Score</span>
                  <span className="font-medium tabular-nums">{peek.score} / 100</span>
                </div>
                <Progress value={peek.score} max={100} tone="accent" />
                <p className="mt-1.5 text-xs text-subtle">Prioritaire à partir de {peek.thresholds.hot}</p>
              </div>
              <dl className="divide-y divide-line rounded-lg border border-line">
                {peek.answers.length === 0 && <p className="px-4 py-3 text-sm text-muted">Aucune réponse pour l&apos;instant.</p>}
                {peek.answers.map((a) => (
                  <div key={a.label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-muted">{a.label}</dt>
                    <dd className="text-right font-medium">{a.value}</dd>
                  </div>
                ))}
              </dl>
              {peek.closed && (
                <div className="rounded-lg bg-accent-soft p-4 text-sm text-accent-strong">
                  Le cabinet reçoit cette fiche par e-mail, avec la conversation complète, et la retrouve dans son espace.
                </div>
              )}
            </div>
          )}
          <ButtonLink href="/inscription" className="mt-6 w-full">
            Créer mon propre assistant
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
