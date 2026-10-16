"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app/shell";
import { roleAtLeast, WorkspaceProvider } from "@/components/app/workspace-context";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { ApiError, useApi, wsPath } from "@/lib/api";
import type { Me, Overview, Role } from "@/lib/types";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { ws } = useParams<{ ws: string }>();
  const router = useRouter();
  const me = useApi<Me>("/api/auth/me");
  const overview = useApi<Overview>(wsPath(ws), { refreshInterval: 60_000 });

  const unauthorized =
    (me.error instanceof ApiError && me.error.status === 401) ||
    (overview.error instanceof ApiError && overview.error.status === 401);
  useEffect(() => {
    try {
      localStorage.setItem("kanso:last-ws", ws);
    } catch {
      // storage unavailable
    }
  }, [ws]);
  useEffect(() => {
    if (unauthorized) router.replace(`/connexion?expire=1&suite=${encodeURIComponent(`/app/${ws}`)}`);
  }, [unauthorized, router, ws]);

  const value = useMemo(() => {
    if (!me.data || !overview.data) return null;
    const role = overview.data.workspace.role;
    return {
      ws,
      me: me.data,
      overview: overview.data,
      refreshOverview: overview.mutate,
      can: (min: Role) => roleAtLeast(role, min),
    };
  }, [ws, me.data, overview.data, overview.mutate]);

  if (overview.error instanceof ApiError && overview.error.status === 404) {
    return (
      <EmptyState
        className="min-h-dvh justify-center"
        title="Espace introuvable"
        description="Cet espace n'existe pas ou vous n'y avez pas accès."
        action={<ButtonLink href="/app">Retour à mes espaces</ButtonLink>}
      />
    );
  }
  if (!value) return <PageSpinner />;
  return (
    <WorkspaceProvider value={value}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
