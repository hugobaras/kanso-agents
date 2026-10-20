export type Role = "owner" | "admin" | "member";

export type Me = {
  user: {
    id: string;
    email: string;
    name: string;
    locale: "fr" | "en";
    email_verified: boolean;
    is_staff: boolean;
    impersonated: boolean;
    mfa_enabled: boolean;
  };
  workspaces: Array<{ id: string; name: string; role: Role; profession: string | null; onboarded: boolean }>;
};

export type Entitlements = {
  plan: "trial" | "essentiel" | "cabinet" | "expert" | "portail_trial" | "portail_essentiel" | "portail_cabinet";
  product: "assistant" | "portail";
  plan_name: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "expired";
  active: boolean;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  modules: { inbound: boolean; document_to_action: boolean; portail: boolean };
  quotas: { conversations: number; documents: number; ai_pages: number };
  seats: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  has_stripe_customer: boolean;
};

export type Overview = {
  workspace: {
    id: string;
    name: string;
    role: Role;
    profession: string | null;
    created_at: string;
    onboarding_step: number;
    onboarded: boolean;
  };
  entitlements: Entitlements;
  usage: { conversations: number; documents: number; ai_pages: number };
  assistant: {
    published: boolean;
    version: number | null;
    published_at: string | null;
    installed: boolean;
    last_seen_at: string | null;
    last_seen_origin: string | null;
    origins_restricted: boolean;
  };
  documents: { published: boolean; pending_review: number; dpa_accepted: boolean };
  leads_this_month: { total: number; hot: number; new: number; last_7_days: number };
  unread_notifications: number;
};

export type LeadListItem = {
  id: string;
  contact: { name?: string; email?: string; phone?: string };
  score: number;
  tier: "hot" | "warm" | "cold";
  event: string;
  status: string;
  summary: string | null;
  assignee: { id: string; name: string | null } | null;
  created_at: string;
};

export type Plan = {
  id: "essentiel" | "cabinet" | "expert" | "trial" | "portail_trial" | "portail_essentiel" | "portail_cabinet";
  product: "assistant" | "portail";
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  modules: { inbound: boolean; document_to_action: boolean; portail: boolean };
  quotas: { conversations: number; documents: number; ai_pages: number };
  seats: number;
  highlights: string[];
};

export type InboundQuestion = {
  id: string;
  prompt: string;
  type: "single_choice" | "multi_choice" | "free_text" | "number" | "boolean";
  required: boolean;
  options?: Array<{ id: string; label: string }>;
};

export type Weight =
  | { kind: "choice_map"; points: Record<string, number> }
  | { kind: "boolean"; true_points: number; false_points: number }
  | { kind: "number_range"; ranges: Array<{ min: number; max: number; points: number }> }
  | { kind: "free_text"; points_if_non_empty: number };

export type InboundConfig = {
  schema_version: string;
  product: "inbound";
  identity: {
    display_name: string;
    locale_default: "fr" | "en";
    branding: { primary_color: string; logo_url?: string | null };
    welcome_message?: string;
  };
  disclosure: { ai_notice: string; forbidden_topics: string[] };
  qualification: { questions: InboundQuestion[] };
  scoring: {
    max_score: 100;
    thresholds: { hot: number; warm: number; cold: number };
    weights: Record<string, Weight>;
  };
  alerts: { channels: Array<{ type: "email" | "slack"; secret_ref: string; on: string[]; enabled?: boolean }> };
  operations: {
    timezone: string;
    languages: string[];
    business_hours: Record<string, Array<[string, string]>>;
    after_hours_message?: string;
    after_hours_mode?: "block" | "qualify";
    escalation: { user_requests_human: boolean; keywords: string[]; message: string };
  };
  integrations?: Record<string, { provider: string; secret_ref: string }>;
};

export type DocumentItem = {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: string | null;
  step: string;
  status: string;
  review_status: string | null;
  anomaly: string | null;
  remote_id: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string | null;
};
