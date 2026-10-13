import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne les classes en résolvant les conflits Tailwind : la dernière gagne
 * (ex. `bg-ink text-paper` + `bg-white text-ink` → `bg-white text-ink`).
 * Les couleurs et tailles personnalisées du thème sont déclarées pour que
 * `text-paper`, `text-ink`… soient bien traitées comme des couleurs.
 */
const merge = twMerge;

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
