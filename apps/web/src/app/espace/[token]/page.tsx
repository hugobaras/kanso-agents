"use client";

import { Camera, Check, FileText, Lock, Paperclip, RotateCw, Send, Trash2, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { PageSpinner } from "@/components/ui/spinner";
import { ApiError, api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { contrast, parseHex } from "@/lib/color";
import { siteHref } from "@/lib/sites";
import { formatBytes, formatDate, timeAgo } from "@/lib/format";
import { ITEM_STATUS_LABEL, ITEM_STATUS_TONE, type ItemStatus, type Stage } from "@/lib/portail";

type Brand = { name: string; color?: string; has_logo: boolean; welcome_message?: string | null };
type LinkInfo = { state: "locked" | "authenticated" | "expired"; brand: Brand; email_hint: string };
type View = {
  brand: Brand;
  dossier: { reference: string; title: string; stage: Stage; stage_label: string; cabinet_message: string | null };
  contact: { name: string };
  stage_labels: Record<Stage, string>;
  locked: boolean;
  items: Array<{
    id: string;
    label: string;
    hint: string | null;
    required: boolean;
    status: ItemStatus;
    refusal_reason: string | null;
    files: Array<{ id: string; filename: string; size_bytes: number; created_at: string }>;
  }>;
  messages: Array<{ id: string; author_kind: "cabinet" | "client"; body: string; created_at: string }>;
  max_file_mb: number;
};

const STEPS: Stage[] = ["a_completer", "en_verification", "complet", "termine"];

/** Assombrit la couleur du cabinet jusqu'à un contraste AA avec le blanc (boutons lisibles). */
function readable(hex: string | undefined): { accent: string; strong: string; soft: string } {
  let rgb = hex ? parseHex(hex) : null;
  if (!rgb) rgb = [31, 111, 107];
  let cur = `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  for (let i = 0; i < 20 && contrast(cur, "#ffffff") < 4.5; i++) {
    rgb = rgb.map((v) => Math.round(v * 0.92)) as [number, number, number];
    cur = `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  const strong = `#${rgb.map((v) => Math.round(v * 0.78).toString(16).padStart(2, "0")).join("")}`;
  return { accent: cur, strong, soft: `color-mix(in srgb, ${cur} 10%, white)` };
}

function upload(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Le dépôt a échoué. Réessayez.";
      try {
        msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg;
      } catch {
        /* keep default */
      }
      reject(new ApiError(xhr.status, "upload", msg));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "Connexion impossible. Vérifiez votre réseau."));
    const form = new FormData();
    form.set("file", file);
    xhr.send(form);
  });
}

export default function EspacePage() {
  const { token } = useParams<{ token: string }>();
  const base = `/api/portail/link/${token}`;
  const dbase = `/api/portail/d/${token}`;
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [view, setView] = useState<View | null>(null);

  const loadView = useCallback(async () => {
    try {
      setView(await api<View>(dbase));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 410)) {
        setView(null);
        setInfo((i) => (i ? { ...i, state: e.status === 410 ? "expired" : "locked" } : i));
      }
    }
  }, [dbase]);

  useEffect(() => {
    api<LinkInfo>(base)
      .then((i) => {
        setInfo(i);
        if (i.state === "authenticated") void loadView();
      })
      .catch(() => setInvalid(true));
  }, [base, loadView]);

  const brand = view?.brand ?? info?.brand;
  const colors = useMemo(() => readable(brand?.color), [brand?.color]);
  const style = { "--color-accent": colors.accent, "--color-accent-strong": colors.strong, "--color-accent-soft": colors.soft } as React.CSSProperties;

  if (invalid) {
    return (
      <Shell style={style}>
        <Card>
          <h1 className="font-display text-xl">Lien introuvable</h1>
          <p className="mt-2 text-sm text-muted">Ce lien n&apos;existe pas ou a été mal copié. Utilisez le lien reçu par e-mail, ou contactez votre cabinet.</p>
        </Card>
      </Shell>
    );
  }
  if (!info || !brand) return <PageSpinner />;

  return (
    <Shell style={style} brand={brand} token={token} base={base}>
      {info.state === "expired" && <Expired base={base} />}
      {info.state === "locked" && <Unlock base={base} hint={info.email_hint} brand={brand} onDone={async () => { setInfo({ ...info, state: "authenticated" }); await loadView(); }} />}
      {info.state === "authenticated" && !view && <PageSpinner />}
      {info.state === "authenticated" && view && <Dossier view={view} dbase={dbase} reload={loadView} />}
    </Shell>
  );
}

function Shell({ children, brand, token, base, style }: { children: React.ReactNode; brand?: Brand; token?: string; base?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          {brand?.has_logo && token ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${base}/logo`} alt="" className="h-9 max-w-32 object-contain" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">{(brand?.name ?? "K").slice(0, 1).toUpperCase()}</span>
          )}
          <span className="min-w-0 flex-1 truncate font-display text-lg">{brand?.name ?? "Espace documents"}</span>
          <span className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3.5" /> Sécurisé</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-center text-xs text-subtle">
        <p>
          Vos documents sont chiffrés et hébergés dans l&apos;Union européenne. Ce service est fourni par Kanso Portail pour le compte de {brand?.name ?? "votre cabinet"}, responsable du traitement.
        </p>
        <p className="mt-1 flex items-center justify-center gap-1.5">
          <LogoMark className="size-4" /> Kanso Portail ·{" "}
          <a href={siteHref("portail", "/legal/confidentialite-portail")} className="underline underline-offset-2" target="_blank" rel="noreferrer">Protection des données</a>
        </p>
      </footer>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-line bg-surface p-5 shadow-card", className)}>{children}</section>;
}

function Expired({ base }: { base: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <h1 className="font-display text-xl">Ce lien n&apos;est plus valable</h1>
      <p className="mt-2 text-sm text-muted">Pour votre sécurité, les liens expirent au bout de 7 jours. Nous pouvons vous en envoyer un nouveau à votre adresse e-mail.</p>
      {sent ? (
        <p className="mt-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">Si votre adresse est enregistrée, un nouveau lien vient d&apos;être envoyé.</p>
      ) : (
        <Button className="mt-4" loading={busy} onClick={async () => { setBusy(true); await api(`${base}/resend`, { method: "POST" }).catch(() => undefined); setSent(true); setBusy(false); }}>
          Recevoir un nouveau lien
        </Button>
      )}
    </Card>
  );
}

function Unlock({ base, hint, brand, onDone }: { base: string; hint: string; brand: Brand; onDone: () => Promise<void> }) {
  const [step, setStep] = useState<"ask" | "code">("ask");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setErr(null);
    try {
      await api(`${base}/code`, { method: "POST" });
      setStep("code");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(`${base}/verify`, { body: { code } });
      await onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1 className="font-display text-xl">Confirmez que c&apos;est bien vous</h1>
      {brand.welcome_message && <p className="mt-2 text-sm text-muted">{brand.welcome_message}</p>}
      {step === "ask" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Pour protéger vos documents, nous envoyons un code à six chiffres à <strong className="text-ink">{hint}</strong>.
          </p>
          <Button className="mt-4 w-full sm:w-auto" size="lg" loading={busy} onClick={ask}>
            Recevoir le code
          </Button>
        </>
      ) : (
        <form onSubmit={verify} className="mt-3 space-y-3">
          <p className="text-sm text-muted">Saisissez le code reçu à {hint}. Il est valable 10 minutes.</p>
          <Input aria-label="Code à six chiffres" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-14 text-center font-mono text-2xl tracking-[0.4em]" placeholder="••••••" />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>
            Accéder à mon dossier
          </Button>
          <button type="button" className="block w-full text-center text-sm text-accent hover:underline" onClick={ask}>
            Renvoyer un code
          </button>
        </form>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Card>
  );
}

function Dossier({ view, dbase, reload }: { view: View; dbase: string; reload: () => Promise<void> }) {
  const { dossier: d } = view;
  const idx = STEPS.indexOf(d.stage);
  const done = view.items.filter((i) => i.status === "received" || i.status === "accepted").length;
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    setMsgErr(null);
    try {
      await api(`${dbase}/messages`, { body: { body: msg.trim() } });
      setMsg("");
      await reload();
    } catch (err) {
      setMsgErr(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{view.contact.name ? `Bonjour ${view.contact.name}` : "Bonjour"}</p>
        <h1 className="font-display text-[26px] leading-tight">{d.title}</h1>
        <p className="mt-0.5 text-xs text-subtle">Dossier {d.reference}</p>
      </div>

      <Card>
        <ol className="flex items-start" aria-label="Avancement du dossier">
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === idx ? "step" : undefined}>
              {i > 0 && <span className={cn("absolute right-1/2 top-3 h-0.5 w-full", i <= idx ? "bg-accent" : "bg-line")} aria-hidden />}
              <span className={cn("relative z-10 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold", i < idx ? "bg-accent text-white" : i === idx ? "bg-accent text-white ring-4 ring-accent-soft" : "bg-sunken text-subtle")}>
                {i < idx ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("mt-1.5 px-1 text-[11px] leading-tight", i === idx ? "font-medium text-ink" : "text-muted")}>{view.stage_labels[s]}</span>
            </li>
          ))}
        </ol>
        {d.cabinet_message && <p className="mt-4 rounded-md bg-accent-soft px-3.5 py-3 text-sm whitespace-pre-wrap">{d.cabinet_message}</p>}
      </Card>

      {view.locked && <p className="rounded-md bg-sunken px-3.5 py-3 text-sm text-muted">Ce dossier est terminé : il n&apos;est plus possible de déposer de documents.</p>}

      <div>
        <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
          <span>Documents demandés</span>
          <span className="font-normal text-muted">{done} sur {view.items.length}</span>
        </h2>
        <ul className="space-y-3">
          {view.items.length === 0 && <li className="text-sm text-muted">Aucun document n&apos;est demandé pour le moment.</li>}
          {view.items.map((it) => (
            <ItemCard key={it.id} item={it} dbase={dbase} max={view.max_file_mb} locked={view.locked} reload={reload} />
          ))}
        </ul>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Messages</h2>
        <div className="space-y-2.5">
          {view.messages.length === 0 && <p className="text-sm text-muted">Une question ? Écrivez à votre cabinet ici.</p>}
          {view.messages.map((m) => (
            <div key={m.id} className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", m.author_kind === "client" ? "ml-auto bg-accent-soft" : "bg-sunken")}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[11px] text-muted">{m.author_kind === "client" ? "Vous" : view.brand.name} · {timeAgo(m.created_at)}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <Input aria-label="Votre message" maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Écrire un message…" />
          <Button type="submit" aria-label="Envoyer" loading={sending} disabled={!msg.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
        {msgErr && <p role="alert" className="mt-2 text-sm text-danger">{msgErr}</p>}
        <p className="mt-2 text-xs text-subtle">Pour toute urgence, contactez directement votre cabinet.</p>
      </Card>
      <p className="text-center text-xs text-subtle">Dernière mise à jour : {formatDate(new Date().toISOString())}</p>
    </div>
  );
}

const TONE: Record<ReturnType<() => "warning" | "info" | "success" | "danger">, string> = {
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

function ItemCard({ item, dbase, max, locked, reload }: { item: View["items"][number]; dbase: string; max: number; locked: boolean; reload: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const accepted = item.status === "accepted";
  const canUpload = !locked && !accepted;

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setErr(null);
    for (const file of Array.from(list)) {
      if (file.size > max * 1024 * 1024) {
        setErr(`« ${file.name} » dépasse ${max} Mo.`);
        continue;
      }
      try {
        setProgress(0);
        await upload(`${dbase}/items/${item.id}/files`, file, setProgress);
        await reload();
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setProgress(null);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    if (camRef.current) camRef.current.value = "";
  }

  async function remove(id: string) {
    try {
      await api(`${dbase}/files/${id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-medium leading-snug">{item.label}</p>
          {!item.required && <p className="text-xs text-muted">Facultatif</p>}
          {item.hint && <p className="mt-0.5 text-[13px] text-muted">{item.hint}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", TONE[ITEM_STATUS_TONE[item.status]])}>{ITEM_STATUS_LABEL[item.status]}</span>
      </div>
      {item.status === "refused" && (
        <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Ce document n&apos;a pas pu être utilisé{item.refusal_reason ? ` : ${item.refusal_reason}` : "."} Merci d&apos;en déposer un nouveau.
        </p>
      )}
      {item.files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {item.files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate">{f.filename}</span>
              <span className="shrink-0 text-xs text-muted">{formatBytes(f.size_bytes)}</span>
              {canUpload && (
                <button onClick={() => remove(f.id)} aria-label={`Supprimer ${f.filename}`} className="rounded p-1 text-muted hover:bg-sunken hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {progress !== null && (
        <div className="mt-3" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Envoi en cours">
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{progress < 1 ? "Envoi en cours…" : "Vérification du fichier…"}</p>
        </div>
      )}
      {canUpload && progress === null && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} />
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
          <Button size="lg" className="sm:hidden" onClick={() => camRef.current?.click()}>
            <Camera className="size-5" /> Prendre en photo
          </Button>
          <Button size="lg" variant={item.files.length ? "secondary" : "primary"} className={item.files.length ? "" : "sm:bg-accent sm:text-white"} onClick={() => fileRef.current?.click()}>
            {item.files.length ? <Paperclip className="size-5" /> : <Upload className="size-5" />} {item.files.length ? "Ajouter un fichier" : "Choisir un fichier"}
          </Button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] text-danger"><RotateCw className="size-3.5" /> {err}</p>}
      <p className="mt-2 text-[11px] text-subtle">{canUpload ? `PDF, JPEG, PNG ou WebP · ${max} Mo maximum par fichier.` : accepted ? "Pièce acceptée par le cabinet." : ""}</p>
    </li>
  );
}
