"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api";

function Verify() {
  const params = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api("/api/auth/verify-email", { body: { token: params.get("token") ?? "" } })
      .then(() => setState("ok"))
      .catch((e) => {
        setError(errorMessage(e));
        setState("error");
      });
  }, [params]);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 text-muted">
        <Spinner /> Vérification…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div>
        <h1 className="font-display text-3xl">Lien invalide</h1>
        <p className="mt-3 text-sm text-muted">{error} Vous pouvez en demander un nouveau depuis votre espace.</p>
        <ButtonLink href="/app" className="mt-6">
          Aller à mon espace
        </ButtonLink>
      </div>
    );
  }
  return (
    <div>
      <CheckCircle2 className="size-10 text-success" aria-hidden />
      <h1 className="mt-4 font-display text-3xl">Adresse confirmée</h1>
      <p className="mt-3 text-sm text-muted">Merci ! Votre compte est sécurisé.</p>
      <ButtonLink href="/app" className="mt-6">
        Continuer
      </ButtonLink>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
