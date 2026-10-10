import type { InboundConfig } from "@kanso/config";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** True if `at` falls in configured business_hours for the tenant timezone. */
export function isWithinBusinessHours(
  config: InboundConfig,
  at: Date = new Date(),
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.operations.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const hhmm = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekday,
  );
  const dayKey = DAY_KEYS[dayIndex] ?? "sun";
  const windows = config.operations.business_hours[dayKey] ?? [];
  return windows.some(([start, end]) => hhmm >= start && hhmm < end);
}

export const AFTER_HOURS_NOTICE =
  "Nous sommes actuellement hors des horaires d'ouverture. La qualification peut continuer ; un collaborateur vous recontactera aux heures ouvrées.";
