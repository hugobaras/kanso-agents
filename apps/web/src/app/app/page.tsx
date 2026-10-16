"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { ApiError, useApi } from "@/lib/api";
import type { Me } from "@/lib/types";

/** Entry point after login: go to the (last) workspace or its onboarding. */
export default function AppIndex() {
  const router = useRouter();
  const me = useApi<Me>("/api/auth/me");

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/connexion");
    const first = me.data?.workspaces[0];
    if (!first) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem("kanso:last-ws");
    } catch {
      // storage unavailable
    }
    const target = me.data!.workspaces.find((w) => w.id === last) ?? first;
    router.replace(target.onboarded || target.role === "member" ? `/app/${target.id}` : `/app/${target.id}/bienvenue`);
  }, [me.data, me.error, router]);

  if (me.data && me.data.workspaces.length === 0) {
    return (
      <EmptyState
        className="min-h-dvh justify-center"
        title="Aucun espace"
        description="Votre compte n'est rattaché à aucun cabinet. Demandez une invitation à un administrateur, ou créez votre espace."
        action={<ButtonLink href="/inscription">Créer un espace</ButtonLink>}
      />
    );
  }
  return <PageSpinner />;
}
