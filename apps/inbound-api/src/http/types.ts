import type { Entitlements } from "@kanso/billing";

export type Role = "owner" | "admin" | "member";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  locale: "fr" | "en";
  email_verified_at: Date | null;
  is_staff: boolean;
  session_id: string;
  impersonator_user_id: string | null;
};

export type WorkspaceContext = {
  tenantId: string;
  displayName: string;
  role: Role;
  profession: string | null;
  entitlements: Entitlements;
};

export type WidgetContext = {
  tenantId: string;
  keyId: string;
  mode: "live" | "test";
  origin: string | null;
};

export type AppEnv = {
  Variables: {
    requestId: string;
    user?: SessionUser;
    workspace?: WorkspaceContext;
    widget?: WidgetContext;
  };
};
