/** WCAG contrast helpers: the tenant colour is used as-is, text adapts. */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function normaliseHex(hex: string | null | undefined, fallback = "#1B2A4A"): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  return m ? `#${m[1]!.toUpperCase()}` : fallback;
}

export function luminance(hex: string): number {
  const n = parseInt(normaliseHex(hex).slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White text when it reaches AA (4.5:1), otherwise the dark ink. */
export function onColor(bg: string): string {
  return contrast(bg, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#1B2A4A";
}

/** Colour usable for text/borders on white (darkened until AA). */
export function readableOnWhite(hex: string): string {
  let n = parseInt(normaliseHex(hex).slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  for (let i = 0; i < 20 && contrast(toHex(r, g, b), "#FFFFFF") < 4.5; i++) {
    r = Math.round(r * 0.85);
    g = Math.round(g * 0.85);
    b = Math.round(b * 0.85);
  }
  n = (r << 16) | (g << 8) | b;
  return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
}

function toHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
