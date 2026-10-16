"use client";

import { createContext, useContext } from "react";
import type { SiteId } from "@/lib/sites";

/** Produit qui habille l'authentification : posé par le proxy (domaine ou ?produit=portail). */
export type AuthProduct = Extract<SiteId, "assistant" | "portail">;

const ProductContext = createContext<AuthProduct>("assistant");

export const ProductProvider = ProductContext.Provider;
export const useAuthProduct = () => useContext(ProductContext);

/** Conserve le produit d'une page d'authentification à l'autre (utile hors mode domaines). */
export const withProduct = (product: AuthProduct, path: string) =>
  product === "portail" ? `${path}${path.includes("?") ? "&" : "?"}produit=portail` : path;
