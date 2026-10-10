export type {
  AlertAdapter,
  AccountingTargetAdapter,
  CrmAdapter,
  CalendarAdapter,
  DocumentSourceAdapter,
} from "./types.js";
export {
  SmtpEmailAlertAdapter,
  ConsoleEmailAlertAdapter,
  createEmailAlertAdapter,
} from "./email.js";
export {
  SlackWebhookAlertAdapter,
  ConsoleSlackAlertAdapter,
  createSlackAlertAdapter,
} from "./slack.js";
export {
  HubSpotCrmAdapter,
  MockCrmAdapter,
  createHubSpotCrmAdapter,
} from "./hubspot.js";
export {
  GoogleCalendarAdapter,
  MockCalendarAdapter,
  createGoogleCalendarAdapter,
} from "./google-calendar.js";
export {
  PennylaneAccountingAdapter,
  MockPennylaneAdapter,
  createPennylaneAdapter,
} from "./pennylane.js";
export {
  EmailInboxSourceAdapter,
  UploadWebSourceAdapter,
  type InboxItem,
} from "./email-inbox.js";
export {
  GoogleDriveSourceAdapter,
  DropboxSourceAdapter,
} from "./cloud-drive.js";
export {
  SellsyCrmAdapter,
  SellsyAccountingAdapter,
  createSellsyCrmAdapter,
  createSellsyAccountingAdapter,
} from "./sellsy.js";
export { CalendlyAdapter, createCalendlyAdapter } from "./calendly.js";
export {
  getCrmAdapter,
  getCalendarAdapter,
  getDocumentSourceAdapter,
  getAccountingAdapter,
  type AdapterCategory,
} from "./registry.js";
export { withAdapterRetry } from "./retry.js";

import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import type { AlertAdapter } from "./types.js";

export class MockAlertAdapter implements AlertAdapter {
  readonly sent: Array<{ event: string; title: string }> = [];

  async send(
    input: {
      channel: "email" | "slack";
      event: string;
      title: string;
      body: string;
      metadata: Record<string, string | number | boolean>;
    },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ delivered: true }>> {
    this.sent.push({ event: input.event, title: input.title });
    return { status: "ok", data: { delivered: true } };
  }
}
