"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api";

function Consume() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = params.get("token");
    if (!token) {
      setError("Lien incomplet.");
      return;
    }
    api("/api/auth/magic-link/consume", { body: { token } })
      .then(() => router.replace("/app"))
      .catch((e) => setError(errorMessage(e)));
  }, [params, router]);

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl">Lien expiré</h1>
        <p className="mt-3 text-sm text-muted">{error}</p>
        <ButtonLink href="/connexion" className="mt-6">
          Demander un nouveau lien
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-muted">
      <Spinner /> Connexion en cours…
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <Consume />
    </Suspense>
  );
}
