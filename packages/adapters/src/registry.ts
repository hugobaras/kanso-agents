import type { AuthContext } from "@kanso/tenancy";
import { createCalendlyAdapter } from "./calendly.js";
import {
  DropboxSourceAdapter,
  GoogleDriveSourceAdapter,
} from "./cloud-drive.js";
import {
  EmailInboxSourceAdapter,
  UploadWebSourceAdapter,
} from "./email-inbox.js";
import { createGoogleCalendarAdapter } from "./google-calendar.js";
import { createHubSpotCrmAdapter } from "./hubspot.js";
import { createPennylaneAdapter } from "./pennylane.js";
import {
  createSellsyAccountingAdapter,
  createSellsyCrmAdapter,
} from "./sellsy.js";
import type {
  AccountingTargetAdapter,
  CalendarAdapter,
  CrmAdapter,
  DocumentSourceAdapter,
} from "./types.js";

export type AdapterCategory =
  | "crm"
  | "calendar"
  | "document_source"
  | "accounting";

export function getCrmAdapter(
  provider: string,
  auth: AuthContext,
): CrmAdapter {
  switch (provider) {
    case "hubspot":
      return createHubSpotCrmAdapter(auth);
    case "sellsy":
      return createSellsyCrmAdapter(auth);
    default:
      throw new Error(`Unknown CRM provider: ${provider}`);
  }
}

export function getCalendarAdapter(
  provider: string,
  auth: AuthContext,
): CalendarAdapter {
  switch (provider) {
    case "google_calendar":
      return createGoogleCalendarAdapter(auth);
    case "calendly":
      return createCalendlyAdapter(auth);
    default:
      throw new Error(`Unknown calendar provider: ${provider}`);
  }
}

export function getDocumentSourceAdapter(
  provider: string,
): DocumentSourceAdapter {
  switch (provider) {
    case "email_inbox":
      return new EmailInboxSourceAdapter();
    case "upload_web":
      return new UploadWebSourceAdapter();
    case "google_drive":
      return new GoogleDriveSourceAdapter();
    case "dropbox":
      return new DropboxSourceAdapter();
    default:
      throw new Error(`Unknown document source: ${provider}`);
  }
}

export function getAccountingAdapter(
  provider: string,
  auth: AuthContext,
): AccountingTargetAdapter {
  switch (provider) {
    case "pennylane":
      return createPennylaneAdapter(auth);
    case "sellsy":
    case "sellsy_accounting":
      return createSellsyAccountingAdapter(auth);
    default:
      throw new Error(`Unknown accounting provider: ${provider}`);
  }
}
