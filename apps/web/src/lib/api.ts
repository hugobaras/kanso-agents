"use client";

import useSWR, { type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
  }
}

const FALLBACK: Record<string, string> = {
  unauthorized: "Votre session a expiré. Reconnectez-vous.",
  rate_limited: "Trop de requêtes. Patientez quelques secondes.",
  validation_failed: "Certains champs sont invalides.",
  internal_error: "Une erreur est survenue. Réessayez dans un instant.",
  workspace_not_found: "Espace introuvable.",
  insufficient_role: "Action réservée aux administrateurs de l'espace.",
  subscription_inactive: "Votre essai est terminé : choisissez une offre pour continuer.",
  network: "Connexion impossible. Vérifiez votre réseau.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return FALLBACK.internal_error!;
}

type Options = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      credentials: "same-origin",
      headers: opts.form ? undefined : { "content-type": "application/json", accept: "application/json" },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, "network", FALLBACK.network!);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; message?: string; details?: Array<{ path: string; message: string }> };
    const code = j.error ?? "internal_error";
    const detail = j.details?.[0]?.message;
    throw new ApiError(res.status, code, j.message ?? detail ?? FALLBACK[code] ?? FALLBACK.internal_error!, j.details);
  }
  return json as T;
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, (p: string) => api<T>(p), {
    revalidateOnFocus: true,
    shouldRetryOnError: (err) => !(err instanceof ApiError && err.status < 500),
    ...config,
  });
}

export const wsPath = (ws: string, rest = "") => `/api/app/${encodeURIComponent(ws)}${rest}`;
