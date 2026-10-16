export type PortalMime = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

export const MAX_PORTAL_FILE_BYTES = 20 * 1024 * 1024;

/** Type réel d'après les premiers octets (jamais l'extension ni l'en-tête du navigateur). */
export function sniffPortalMime(buf: Buffer): PortalMime | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}

const EXT: Record<PortalMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Nom de fichier sûr : sans chemin ni caractère de contrôle, extension alignée sur le type réel. */
export function safeFilename(name: string, mime: PortalMime): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\p{Cc}"<>:|?*]/gu, "_").trim();
  const stem = base.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 100) || "document";
  return `${stem}.${EXT[mime]}`;
}
