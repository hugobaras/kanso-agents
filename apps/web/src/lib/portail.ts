export type Stage = "a_completer" | "en_verification" | "complet" | "termine";
export type ItemStatus = "pending" | "received" | "accepted" | "refused";

export const STAGE_TONE: Record<Stage, "warning" | "info" | "success" | "neutral"> = {
  a_completer: "warning",
  en_verification: "info",
  complet: "success",
  termine: "neutral",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "En attente",
  received: "Reçue",
  accepted: "Acceptée",
  refused: "À refaire",
};

export const ITEM_STATUS_TONE: Record<ItemStatus, "warning" | "info" | "success" | "danger"> = {
  pending: "warning",
  received: "info",
  accepted: "success",
  refused: "danger",
};

export type PortalListItem = {
  id: string;
  reference: string;
  title: string;
  client_name: string;
  client_kind: "particulier" | "entreprise";
  stage: Stage;
  updated_at: string;
  created_at: string;
  purge_at: string | null;
  items_total: number;
  items_provided: number;
  unread_messages: number;
};

export type PortalList = {
  dossiers: PortalListItem[];
  active: number;
  max_active: number;
  stage_labels: Record<Stage, string>;
};

export type PortalTemplateItem = { label: string; hint?: string | null; required: boolean };

export type PortalTemplates = {
  system: Array<{ key: string; name: string; description: string; client_kind: string; items: PortalTemplateItem[] }>;
  custom: Array<{ id: string; name: string; description: string | null; items: PortalTemplateItem[] }>;
};

export type PortalFile = { id: string; filename: string; size_bytes?: number; mime_type?: string; created_at: string };

export type PortalDossierDetail = {
  dossier: {
    id: string;
    reference: string;
    title: string;
    client_name: string;
    client_kind: string;
    stage: Stage;
    cabinet_message: string | null;
    assignee_user_id: string | null;
    created_at: string;
    closed_at: string | null;
    purge_at: string | null;
  };
  stage_labels: Record<Stage, string>;
  items: Array<{ id: string; label: string; hint: string | null; required: boolean; status: ItemStatus; refusal_reason: string | null; files: PortalFile[] }>;
  progress: { provided: number; total: number; required: number; requiredProvided: number };
  contacts: Array<{ id: string; email: string; name: string; last_access_at: string | null }>;
  messages: Array<{ id: string; author_kind: "cabinet" | "client"; body: string; created_at: string }>;
};

export type PortalSettings = {
  max_active_dossiers: number;
  retention_days: number;
  reminders: { enabled: boolean; first_after_days: number; every_days: number; max: number };
  stage_labels: Record<Stage, string>;
  brand_color: string | null;
  display_name: string | null;
  welcome_message: string | null;
  has_logo: boolean;
  workspace_name: string;
};
