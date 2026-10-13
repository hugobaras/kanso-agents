"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-muted">Réessayez dans un instant. Si le problème persiste, écrivez à support@kanso.fr.</p>
      <Button className="mt-6" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
