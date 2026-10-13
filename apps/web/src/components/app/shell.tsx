"use client";

import {
  Bell,
  Bot,
  Building2,
  ChevronsUpDown,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  Settings,
  Shield,
  User,
  Users,
  X,
  Code2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { api, useApi, wsPath } from "@/lib/api";
import { cn } from "@/lib/cn";
import { initials, timeAgo } from "@/lib/format";
import { useWorkspace } from "./workspace-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  exact?: boolean;
};

function useNav(): NavItem[][] {
  const { ws, overview } = useWorkspace();
  const base = `/app/${ws}`;
  const ent = overview.entitlements;
  const main: NavItem[] = [
    { href: base, label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { href: `${base}/demandes`, label: "Demandes", icon: Inbox, badge: overview.leads_this_month.new || undefined },
    { href: `${base}/assistant`, label: "Assistant", icon: Bot },
    { href: `${base}/installation`, label: "Installation", icon: Code2 },
  ];
  if (ent.modules.document_to_action) {
    main.push({
      href: `${base}/documents`,
      label: "Documents",
      icon: FileText,
      badge: overview.documents.pending_review || undefined,
    });
  }
  const manage: NavItem[] = [
    { href: `${base}/integrations`, label: "Intégrations", icon: Plug },
    { href: `${base}/equipe`, label: "Équipe", icon: Users },
    { href: `${base}/facturation`, label: "Facturation", icon: CreditCard },
    { href: `${base}/parametres`, label: "Paramètres", icon: Settings },
  ];
  return [main, manage];
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = useNav();
  const { me } = useWorkspace();
  return (
    <nav className="flex flex-col gap-6" aria-label="Navigation principale">
      {groups.map((items, i) => (
        <ul key={i} className="flex flex-col gap-0.5">
          {items.map((it) => {
            const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line" : "text-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  <it.icon className="size-4 shrink-0" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    <span className="rounded-full bg-accent px-1.5 py-px text-[11px] font-semibold text-white">{it.badge}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
      {me.user.is_staff && (
        <Link href="/admin" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-sunken hover:text-ink">
          <Shield className="size-4" /> Back-office Kanso
        </Link>
      )}
    </nav>
  );
}

function WorkspaceSwitcher() {
  const { me, ws, overview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-2 text-left hover:bg-sunken"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-ink text-[11px] font-semibold text-paper">
          {initials(overview.workspace.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{overview.workspace.name}</span>
          <span className="block text-xs text-muted">{overview.entitlements.plan_name}</span>
        </span>
        <ChevronsUpDown className="size-4 text-subtle" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
          {me.workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/app/${w.id}`}
              onClick={() => setOpen(false)}
              className={cn("flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-sunken", w.id === ws && "font-medium")}
            >
              <Building2 className="size-4 text-subtle" />
              <span className="truncate">{w.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && cb();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, cb]);
}

type Notification = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

function Notifications() {
  const { ws, overview, refreshOverview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const list = useApi<{ notifications: Notification[] }>(open ? wsPath(ws, "/notifications") : null);
  const unread = overview.unread_notifications;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api(wsPath(ws, "/notifications/read"), { method: "POST" });
      void refreshOverview();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative rounded-md p-2 text-muted hover:bg-sunken hover:text-ink"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-4.5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-paper" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 animate-fade-in rounded-lg border border-line bg-surface shadow-pop">
          <p className="border-b border-line px-4 py-2.5 text-sm font-medium">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {list.data?.notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Rien de nouveau.</li>}
            {list.data?.notifications.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-paper">
                  <p className="text-sm text-ink">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-subtle">{timeAgo(n.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { me } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/connexion");
  }
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong hover:ring-2 hover:ring-line"
        aria-label="Mon compte"
        aria-expanded={open}
      >
        {initials(me.user.name, me.user.email)}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{me.user.name || "Mon compte"}</p>
            <p className="truncate text-xs text-muted">{me.user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link href="/compte" className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-sunken" onClick={() => setOpen(false)}>
            <User className="size-4 text-subtle" /> Mon compte
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-sunken">
            <LogOut className="size-4 text-subtle" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

function Banners() {
  const { me, overview, ws } = useWorkspace();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const ent = overview.entitlements;
  const banners: React.ReactNode[] = [];
  if (me.user.impersonated) {
    banners.push(
      <div key="imp" className="bg-warning px-4 py-2 text-center text-sm text-white">
        Session support (lecture/écriture limitée, 24 h). <LogoutLink />
      </div>,
    );
  }
  if (!ent.active) {
    banners.push(
      <div key="exp" className="bg-danger px-4 py-2 text-center text-sm text-white">
        {ent.status === "expired" ? "Votre essai est terminé" : "Votre abonnement est inactif"} : l&apos;assistant est en pause sur
        votre site.{" "}
        <Link href={`/app/${ws}/facturation`} className="font-semibold underline underline-offset-2">
          Choisir une offre
        </Link>
      </div>,
    );
  } else if (ent.status === "trialing" && ent.trial_days_left !== null) {
    banners.push(
      <div key="trial" className="border-b border-line bg-accent-soft px-4 py-2 text-center text-sm text-accent-strong">
        Essai gratuit : {ent.trial_days_left} jour{ent.trial_days_left > 1 ? "s" : ""} restant{ent.trial_days_left > 1 ? "s" : ""}.{" "}
        <Link href={`/app/${ws}/facturation`} className="font-semibold underline underline-offset-2">
          Voir les offres
        </Link>
      </div>,
    );
  } else if (ent.status === "past_due") {
    banners.push(
      <div key="due" className="bg-warning px-4 py-2 text-center text-sm text-white">
        Le dernier paiement a échoué.{" "}
        <Link href={`/app/${ws}/facturation`} className="font-semibold underline underline-offset-2">
          Mettre à jour le moyen de paiement
        </Link>
      </div>,
    );
  }
  if (!me.user.email_verified && !me.user.impersonated) {
    banners.push(
      <div key="verify" className="border-b border-line bg-warning-soft px-4 py-2 text-center text-sm text-warning">
        Confirmez votre adresse {me.user.email} pour sécuriser votre compte.{" "}
        {sent ? (
          <span className="font-medium">E-mail renvoyé.</span>
        ) : (
          <button
            disabled={sending}
            className="font-semibold underline underline-offset-2"
            onClick={async () => {
              setSending(true);
              await api("/api/auth/resend-verification", { method: "POST" }).catch(() => undefined);
              setSent(true);
              setSending(false);
            }}
          >
            Renvoyer l&apos;e-mail
          </button>
        )}
      </div>,
    );
  }
  return <>{banners}</>;
}

function LogoutLink() {
  const router = useRouter();
  return (
    <button
      className="font-semibold underline underline-offset-2"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/admin");
      }}
    >
      Terminer
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      <Banners />
      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-paper px-4 py-5 lg:flex">
          <Logo site="assistant" href="/app" className="px-1" />
          <WorkspaceSwitcher />
          <div className="flex-1 overflow-y-auto">
            <NavLinks />
          </div>
          <a
            href="mailto:support@kanso.fr"
            className="rounded-md px-3 py-2 text-[13px] text-muted hover:bg-sunken hover:text-ink"
          >
            Besoin d&apos;aide ? support@kanso.fr
          </a>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 animate-slide-up flex-col gap-6 overflow-y-auto bg-paper px-4 py-5 shadow-pop">
              <div className="flex items-center justify-between">
                <LogoMark className="size-7" />
                <button onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" className="rounded p-1.5 hover:bg-sunken">
                  <X className="size-5" />
                </button>
              </div>
              <WorkspaceSwitcher />
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-8">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
              <Menu className="size-5" />
            </Button>
            <div className="flex-1" />
            <Notifications />
            <UserMenu />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
