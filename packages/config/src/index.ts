export {
  InboundConfigSchema,
  parseInboundConfig,
  type InboundConfig,
} from "./inbound.js";
export {
  DocumentToActionConfigSchema,
  parseDocumentToActionConfig,
  type DocumentToActionConfig,
} from "./document-to-action.js";
export {
  PROFESSIONS,
  EMAIL_ALERT_SECRET_REF,
  SLACK_ALERT_SECRET_REF,
  buildInboundTemplate,
  buildDocumentTemplate,
  type Profession,
} from "./templates.js";
