"use client";

import { createContext, useContext } from "react";
import type { KeyedMutator } from "swr";
import type { Me, Overview, Role } from "@/lib/types";

type Ctx = {
  ws: string;
  me: Me;
  overview: Overview;
  refreshOverview: KeyedMutator<Overview>;
  can: (role: Role) => boolean;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export const WorkspaceProvider = WorkspaceCtx.Provider;

export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace outside workspace layout");
  return c;
}

const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };
export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}
