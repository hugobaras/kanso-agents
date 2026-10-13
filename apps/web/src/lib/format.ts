const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const rel = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

export function formatDate(d: string | Date | null | undefined): string {
  return d ? dateFmt.format(new Date(d)) : "—";
}

export function formatDateTime(d: string | Date | null | undefined): string {
  return d ? dateTimeFmt.format(new Date(d)) : "—";
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rel.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rel.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rel.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function formatEur(cents: number, opts: { decimals?: boolean } = {}): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(cents / 100);
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export function initials(name: string | null | undefined, email?: string): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const PROFESSION_LABEL: Record<string, string> = {
  avocat: "Cabinet d'avocats",
  expert_comptable: "Expertise comptable",
  notaire: "Office notarial",
  autre: "Profession libérale",
};
