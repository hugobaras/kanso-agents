import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EICAR_TEST_STRING, setStorage } from "@kanso/portal";
import { FsStorage } from "@kanso/portal";
import { getPool } from "@kanso/tenancy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const hasDb = !!process.env.DATABASE_URL;
const APP = "http://localhost:3001";

process.env.KANSO_APP_URL = APP;
process.env.KANSO_MASTER_KEY ??= "test-master-key-at-least-32-characters!!";
process.env.KANSO_ACCESS_LOG = "0";
process.env.KANSO_AUTH_RATE_LIMIT = "1000";
process.env.KANSO_AV_MODE = "eicar";

const app = createApp({});
const suffix = randomBytes(4).toString("hex");

type Jar = Record<string, string>;
const cookieHeader = (j: Jar) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");

async function call(jar: Jar, method: string, path: string, body?: unknown, form?: FormData) {
  const res = await app.request(path, {
    method,
    headers: { ...(form ? {} : { "content-type": "application/json" }), origin: APP, cookie: cookieHeader(jar) },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [kv] = sc.split(";");
    const i = kv!.indexOf("=");
    jar[kv!.slice(0, i)] = kv!.slice(i + 1);
  }
  const text = await res.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, res };
}

const pdf = (extra = "") => new File([Buffer.from(`%PDF-1.4\n${extra}\n%%EOF`)], "Relevé.pdf", { type: "application/pdf" });
const upload = (itemId: string, file: File) => {
  const f = new FormData();
  f.set("file", file);
  return f;
};

async function lastMail(to: string, template: string) {
  const r = await getPool().query<{ subject: string; text_body: string }>(
    `select subject, text_body from mail_outbox where to_email = $1 and template = $2 order by id desc limit 1`,
    [to, template],
  );
  return r.rows[0]!;
}

describe.skipIf(!hasDb)("Kanso Portail", () => {
  const cab: Jar = {};
  let ws = "";
  const client = `client-${suffix}@example.com`;

  beforeAll(async () => {
    setStorage(new FsStorage(mkdtempSync(join(tmpdir(), "portail-"))));
    const r = await call(cab, "POST", "/api/auth/signup", {
      name: "Test User",
      email: `cab-${suffix}@example.com`,
      password: "un-mot-de-passe-1",
      workspace_name: `Cab ${suffix}`,
      profession: "expert_comptable",
      accept_terms: true,
    });
    expect(r.status).toBe(201);
    ws = r.json.workspace;
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query(`delete from tenants where tenant_id = $1`, [ws]);
    await pool.query(`delete from users where email like $1`, [`%-${suffix}@example.com`]);
    setStorage(null);
  });

  it("is closed until Kanso enables the module", async () => {
    const r = await call(cab, "GET", `/api/app/${ws}/portail`);
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("module_not_in_plan");
    await getPool().query(`update tenants set modules = modules || '{"portail": true}'::jsonb where tenant_id = $1`, [ws]);
    expect((await call(cab, "GET", `/api/app/${ws}/portail`)).status).toBe(200);
  });

  let dossierId = "";
  let token = "";
  let itemIds: string[] = [];

  it("creates a dossier from a template and e-mails the client", async () => {
    const t = await call(cab, "GET", `/api/app/${ws}/portail/templates`);
    expect(t.json.system.some((x: any) => x.key === "ec-bilan")).toBe(true);
    const c = await call(cab, "POST", `/api/app/${ws}/portail/dossiers`, {
      title: "Bilan 2026",
      client_name: "SARL Dupont",
      client_kind: "entreprise",
      template: "ec-bilan",
      contacts: [{ email: client, name: "M. Dupont" }],
    });
    expect(c.status).toBe(201);
    expect(c.json.reference).toMatch(/^D-\d{4}-001$/);
    dossierId = c.json.id;
    const mail = await lastMail(client, "portal_invite");
    const m = /\/espace\/([A-Za-z0-9_-]{40,})/.exec(mail.text_body);
    expect(m).toBeTruthy();
    token = m![1]!;
    const d = await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`);
    itemIds = d.json.items.map((i: any) => i.id);
    expect(d.json.dossier.stage).toBe("a_completer");
  });

  const clientJar: Jar = {};
  const base = () => `/api/portail/link/${token}`;
  const dossier = () => `/api/portail/d/${token}`;

  it("requires the e-mailed code before showing anything", async () => {
    expect((await call(clientJar, "GET", dossier())).status).toBe(401);
    const info = await call(clientJar, "GET", base());
    expect(info.json.state).toBe("locked");
    expect(info.json.email_hint).toContain("•");
    expect((await call(clientJar, "POST", `${base()}/code`)).status).toBe(200);
    const bad = await call(clientJar, "POST", `${base()}/verify`, { code: "000000" });
    expect(bad.status).toBe(400);
    const mail = await lastMail(client, "portal_code");
    const code = /(\d{6})/.exec(mail.subject)![1]!;
    expect((await call(clientJar, "POST", `${base()}/verify`, { code })).status).toBe(200);
    // le code ne sert qu'une fois
    expect((await call({}, "POST", `${base()}/verify`, { code })).status).toBe(400);
    const v = await call(clientJar, "GET", dossier());
    expect(v.status).toBe(200);
    expect(v.json.dossier.title).toBe("Bilan 2026");
  });

  it("rejects bad links, other types, and infected files", async () => {
    expect((await call({}, "GET", `/api/portail/link/${"a".repeat(43)}`)).status).toBe(404);
    const item = itemIds[0]!;
    const exe = new File([Buffer.from("MZ\x90\x00...")], "x.pdf", { type: "application/pdf" });
    expect((await call(clientJar, "POST", `${dossier()}/items/${item}/files`, undefined, upload(item, exe))).status).toBe(415);
    const virus = pdf(EICAR_TEST_STRING);
    const inf = await call(clientJar, "POST", `${dossier()}/items/${item}/files`, undefined, upload(item, virus));
    expect(inf.status).toBe(422);
    expect(inf.json.error).toBe("file_infected");
  });

  it("stores files encrypted, advances the stage, notifies the cabinet when complete", async () => {
    const required = (await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`)).json.items.filter((i: any) => i.required);
    let last: any;
    for (const it of required) {
      last = await call(clientJar, "POST", `${dossier()}/items/${it.id}/files`, undefined, upload(it.id, pdf(`secret-${it.id}`)));
      expect(last.status).toBe(201);
    }
    expect(last.json.stage).toBe("en_verification");
    const cabMail = await lastMail(`cab-${suffix}@example.com`, "portal_complete");
    expect(cabMail.subject).toContain("D-");

    // jamais de clair sur le disque
    const row = await getPool().query<{ storage_key: string }>(`select storage_key from portal_files where dossier_id = $1 limit 1`, [dossierId]);
    const storage = (await import("@kanso/portal")).getStorage();
    const blob = await storage.get(row.rows[0]!.storage_key);
    expect(blob.includes(Buffer.from("%PDF"))).toBe(false);

    // le cabinet télécharge le fichier déchiffré
    const d = await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`);
    const fileId = d.json.items.find((i: any) => i.files.length).files[0].id;
    const dl = await app.request(`/api/app/${ws}/portail/dossiers/${dossierId}/files/${fileId}`, { headers: { cookie: cookieHeader(cab) } });
    expect(dl.status).toBe(200);
    expect((await dl.text()).startsWith("%PDF")).toBe(true);
  });

  it("lets the cabinet refuse then accept, and the client replace until accepted", async () => {
    const d = await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`);
    const it = d.json.items.find((i: any) => i.required && i.files.length);
    const refuse = await call(cab, "POST", `/api/app/${ws}/portail/dossiers/${dossierId}/items/${it.id}/refuse`, { reason: "Illisible" });
    expect(refuse.json.stage).toBe("a_completer");
    expect((await lastMail(client, "portal_refusal")).text_body).toContain("Illisible");
    const up = await call(clientJar, "POST", `${dossier()}/items/${it.id}/files`, undefined, upload(it.id, pdf("v2")));
    expect(up.status).toBe(201);
    expect(up.json.stage).toBe("en_verification");
    const all = (await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`)).json.items;
    let stage = "";
    for (const i of all.filter((x: any) => x.required)) {
      stage = (await call(cab, "POST", `/api/app/${ws}/portail/dossiers/${dossierId}/items/${i.id}/accept`)).json.stage;
    }
    expect(stage).toBe("complet");
    const accepted = all.find((x: any) => x.required);
    const fid = (await call(clientJar, "GET", dossier())).json.items.find((x: any) => x.id === accepted.id).files[0].id;
    expect((await call(clientJar, "DELETE", `${dossier()}/files/${fid}`)).status).toBe(400);
  });

  it("exports a zip, closes with retention, and isolates other tenants", async () => {
    const z = await app.request(`/api/app/${ws}/portail/dossiers/${dossierId}/export`, { headers: { cookie: cookieHeader(cab) } });
    expect(z.status).toBe(200);
    expect(new Uint8Array(await z.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    expect((await call(cab, "POST", `/api/app/${ws}/portail/dossiers/${dossierId}/close`)).status).toBe(200);
    const row = await getPool().query(`select stage, purge_at from portal_dossiers where id = $1`, [dossierId]);
    expect(row.rows[0].stage).toBe("termine");
    expect(new Date(row.rows[0].purge_at).getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
    // un dossier terminé n'accepte plus de dépôt
    const it = itemIds[0]!;
    expect((await call(clientJar, "POST", `${dossier()}/items/${it}/files`, undefined, upload(it, pdf()))).status).toBe(400);

    const other: Jar = {};
    const r = await call(other, "POST", "/api/auth/signup", { name: "Autre Cab", email: `other-${suffix}@example.com`, password: "un-mot-de-passe-1", workspace_name: `Other ${suffix}`, profession: "avocat", accept_terms: true });
    const ws2 = r.json.workspace;
    await getPool().query(`update tenants set modules = modules || '{"portail": true}'::jsonb where tenant_id = $1`, [ws2]);
    expect((await call(other, "GET", `/api/app/${ws2}/portail/dossiers/${dossierId}`)).status).toBe(404);
    expect((await call(other, "GET", `/api/app/${ws}/portail`)).status).toBe(404);
    await getPool().query(`delete from tenants where tenant_id = $1`, [ws2]);
  });

  it("revokes old links when the cabinet resends", async () => {
    const d = await call(cab, "GET", `/api/app/${ws}/portail/dossiers/${dossierId}`);
    const cid = d.json.contacts[0].id;
    expect((await call(cab, "POST", `/api/app/${ws}/portail/dossiers/${dossierId}/contacts/${cid}/resend`)).status).toBe(200);
    const info = await call({}, "GET", `/api/portail/link/${token}`);
    expect(info.json.state).toBe("expired");
  });
});
