import { CheckCircle2, FileText, Lock, MessageSquare } from "lucide-react";

/** Aperçu conceptuel (non contractuel) de l'espace client. */
export function PortalMock() {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop" aria-hidden>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Lock className="size-3.5 text-accent" /> Mon espace — Cabinet Exemple
        </span>
        <span className="size-7 rounded-full bg-accent-soft" />
      </div>
      <div className="space-y-4 bg-paper p-5">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-subtle">Dossier</p>
          <p className="mt-0.5 text-sm font-medium">Bilan annuel — exercice en cours</p>
          <div className="mt-3 flex gap-1.5">
            {["bg-accent", "bg-accent", "bg-accent/30", "bg-line"].map((c, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${c}`} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Étape 2 sur 4 · pièces en cours de vérification</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-subtle">Pièces demandées</p>
          <ul className="mt-2 space-y-2 text-[13px]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-accent" /> Relevés bancaires
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-accent" /> Factures de ventes
            </li>
            <li className="flex items-center gap-2 text-muted">
              <FileText className="size-4" /> Factures fournisseurs
              <span className="ml-auto rounded bg-accent px-2 py-0.5 text-[10px] text-white">Déposer</span>
            </li>
          </ul>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <MessageSquare className="mt-0.5 size-4 text-accent" />
          <div>
            <p className="text-[13px] font-medium">Un message de votre cabinet</p>
            <p className="mt-0.5 text-[12px] text-muted">« Il nous manque seulement vos factures fournisseurs. »</p>
          </div>
        </div>
      </div>
    </div>
  );
}
