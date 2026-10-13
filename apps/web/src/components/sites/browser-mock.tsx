/** Maquette illustrative d'un site de cabinet (structure, pas un vrai client). */
export function BrowserMock() {
  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop" aria-hidden>
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 flex-1 rounded-md bg-surface px-3 py-1 text-[11px] text-subtle">www.votre-cabinet.fr</span>
      </div>
      <div className="bg-paper">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
          <span className="font-display text-sm">Cabinet Exemple</span>
          <div className="flex gap-3 text-[10px] text-muted">
            <span>Le cabinet</span>
            <span>Domaines</span>
            <span>Équipe</span>
            <span className="rounded bg-accent px-2 py-0.5 text-white">Rendez-vous</span>
          </div>
        </div>
        <div className="px-6 py-8">
          <p className="font-display text-[22px] leading-tight">Un accompagnement clair, à chaque étape.</p>
          <p className="mt-2 max-w-sm text-[11px] leading-5 text-muted">
            Présentation du cabinet, de ses domaines d'intervention et de sa façon de travailler.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="rounded bg-accent px-3 py-1.5 text-[10px] text-white">Prendre rendez-vous</span>
            <span className="rounded border border-line-strong px-3 py-1.5 text-[10px]">Nos domaines</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {["Domaine 1", "Domaine 2", "Domaine 3"].map((d) => (
              <div key={d} className="rounded-lg border border-line bg-surface p-3">
                <div className="mb-2 h-1.5 w-6 rounded bg-accent" />
                <p className="text-[10px] font-medium">{d}</p>
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 rounded bg-line" />
                  <div className="h-1 w-2/3 rounded bg-line" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
