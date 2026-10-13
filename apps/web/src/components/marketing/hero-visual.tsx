import { Bell, Bot, Mail } from "lucide-react";

/** Static illustration: a conversation on the left, what the firm receives on the right. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden>
      <div className="rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 rounded-t-2xl bg-ink px-4 py-3 text-paper">
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
            <Bot className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Cabinet Lefèvre & Associés</p>
            <p className="text-[11px] opacity-75">Assistant automatisé</p>
          </div>
        </div>
        <div className="space-y-2.5 bg-paper/60 px-4 py-5 text-[13px]">
          <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2">
            Bonjour, je peux transmettre votre demande au cabinet. Quel est le domaine concerné ?
          </p>
          <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-paper">
            Mon employeur veut me licencier, j&apos;ai reçu une convocation.
          </p>
          <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2">
            Je comprends. Je ne peux pas vous conseiller, mais un avocat peut vous rappeler. Sous quel délai souhaitez-vous un échange ?
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Sous 48 h", "Dans la semaine", "Pas d'urgence"].map((c) => (
              <span key={c} className="rounded-full border border-ink/40 px-3 py-1 text-xs text-ink">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-10 -right-4 w-72 rounded-xl border border-line bg-surface p-4 shadow-pop sm:-right-10">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Mail className="size-3.5" /> accueil@lefevre-avocats.fr
        </div>
        <p className="mt-2 text-sm font-semibold">Demande prioritaire — Julien M.</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-[#f0c9c1] bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Prioritaire · 86/100</span>
        </div>
        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted">Domaine</dt>
            <dd>Droit du travail</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Délai</dt>
            <dd>Sous 48 h</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Contact</dt>
            <dd>julien.m@…</dd>
          </div>
        </dl>
      </div>
      <div className="absolute -left-6 top-16 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs shadow-card sm:flex">
        <Bell className="size-3.5 text-accent" /> Nouvelle demande qualifiée
      </div>
    </div>
  );
}
