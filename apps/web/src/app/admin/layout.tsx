"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { ApiError, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Me } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/cabinets", label: "Cabinets" },
  { href: "/admin/demandes", label: "Demandes clients" },
  { href: "/admin/sante", label: "Santé" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useApi<Me>("/api/auth/me");
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/connexion?suite=/admin");
    if (me.data && !me.data.user.is_staff) router.replace("/app");
  }, [me.data, me.error, router]);
  if (!me.data?.user.is_staff) return <PageSpinner />;
  // Mirrors the API rule (staff need two-factor in production) so staff get a way forward, not empty pages.
  if (process.env.NODE_ENV === "production" && !me.data.user.mfa_enabled) {
    return (
      <EmptyState
        className="min-h-dvh justify-center"
        title="Double authentification requise"
        description="Le back-office donne accès à tous les cabinets : activez la double authentification sur votre compte pour y entrer."
        action={<ButtonLink href="/compte">Activer dans Mon compte</ButtonLink>}
      />
    );
  }
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-2">
            <LogoMark variant="light" className="size-7" />
            <span className="font-display font-semibold">Kanso</span>
            <Badge tone="accent">staff</Badge>
          </Link>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5",
                  (n.href === "/admin" ? pathname === n.href : pathname.startsWith(n.href)) ? "bg-white/15" : "text-paper/70 hover:text-paper",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <Link href="/app" className="text-sm text-paper/70 hover:text-paper">
            Mon espace
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
