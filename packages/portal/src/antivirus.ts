import { connect } from "node:net";

export type ScanResult = { status: "clean" | "infected" | "error"; detail?: string };

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export type AvMode = "clamd" | "eicar" | "off" | "unavailable";

/**
 * KANSO_AV_MODE = clamd | eicar | off. Par défaut : clamd si CLAMD_HOST est
 * défini ; sinon « eicar » (détection du fichier de test uniquement) en
 * développement et **indisponible** en production (les dépôts sont refusés).
 */
export function avMode(env: NodeJS.ProcessEnv = process.env): AvMode {
  const forced = env.KANSO_AV_MODE;
  if (forced === "clamd" || forced === "eicar" || forced === "off") return forced;
  if (env.CLAMD_HOST) return "clamd";
  return (env.KANSO_ENV ?? "local") === "production" ? "unavailable" : "eicar";
}

/** Protocole clamd INSTREAM (zINSTREAM) sur TCP. */
export function scanWithClamd(buf: Buffer, host: string, port: number, timeoutMs = 30_000): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (r: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    socket.setTimeout(timeoutMs, () => done({ status: "error", detail: "clamd_timeout" }));
    socket.on("error", (e) => done({ status: "error", detail: `clamd_${(e as NodeJS.ErrnoException).code ?? "error"}` }));
    socket.on("data", (d) => chunks.push(d));
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      if (/\bOK$/.test(reply)) return done({ status: "clean" });
      const found = /: (.+) FOUND$/.exec(reply);
      if (found) return done({ status: "infected", detail: found[1] });
      done({ status: "error", detail: reply.slice(0, 120) || "clamd_empty_reply" });
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let i = 0; i < buf.length; i += CHUNK) {
        const part = buf.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // fin de flux
    });
  });
}

export async function scanBuffer(buf: Buffer, env: NodeJS.ProcessEnv = process.env): Promise<ScanResult> {
  switch (avMode(env)) {
    case "clamd":
      return scanWithClamd(buf, env.CLAMD_HOST ?? "127.0.0.1", Number(env.CLAMD_PORT ?? 3310));
    case "eicar":
      return buf.includes(Buffer.from(EICAR)) ? { status: "infected", detail: "Eicar-Test-Signature" } : { status: "clean" };
    case "off":
      return { status: "clean", detail: "av_off" };
    case "unavailable":
      return { status: "error", detail: "av_unavailable" };
  }
}

export const EICAR_TEST_STRING = EICAR;
