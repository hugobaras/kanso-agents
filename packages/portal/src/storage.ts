import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** Stockage d'objets (déjà chiffrés) : fichiers locaux en dev, S3 compatible (OVHcloud) en production. */
export interface ObjectStorage {
  readonly kind: "fs" | "s3";
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Ping de santé (bucket accessible). */
  check(): Promise<void>;
}

const KEY_RE = /^portail\/[a-z0-9-]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export function fileStorageKey(tenantId: string, dossierId: string, fileId: string): string {
  return `portail/${tenantId}/${dossierId}/${fileId}`;
}

function assertKey(key: string) {
  // Aucune clé arbitraire : pas de traversée de répertoire, pas de collision de préfixe.
  if (!KEY_RE.test(key)) throw new Error("invalid_storage_key");
}

export class FsStorage implements ObjectStorage {
  readonly kind = "fs" as const;
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private path(key: string): string {
    assertKey(key);
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + "/")) throw new Error("invalid_storage_key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
  async check() {
    await mkdir(this.root, { recursive: true });
  }
}

export type S3Options = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export class S3Storage implements ObjectStorage {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  constructor(private readonly opts: S3Options) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle ?? !!opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }
  async put(key: string, body: Buffer) {
    assertKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: "application/octet-stream" }),
    );
  }
  async get(key: string) {
    assertKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("storage_empty_body");
    return Buffer.from(bytes);
  }
  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.opts.bucket }));
  }
}

let cached: ObjectStorage | null = null;

/** KANSO_S3_BUCKET défini → S3 ; sinon fichiers locaux (refusé en production). */
export function createStorage(env: NodeJS.ProcessEnv = process.env): ObjectStorage {
  if (env.KANSO_S3_BUCKET) {
    const accessKeyId = env.KANSO_S3_ACCESS_KEY;
    const secretAccessKey = env.KANSO_S3_SECRET_KEY;
    if (!accessKeyId || !secretAccessKey) throw new Error("KANSO_S3_ACCESS_KEY / KANSO_S3_SECRET_KEY required");
    return new S3Storage({
      endpoint: env.KANSO_S3_ENDPOINT,
      region: env.KANSO_S3_REGION ?? "gra",
      bucket: env.KANSO_S3_BUCKET,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: env.KANSO_S3_PATH_STYLE === "1" || undefined,
    });
  }
  if ((env.KANSO_ENV ?? "local") === "production") {
    throw new Error("Kanso Portail: KANSO_S3_BUCKET required in production (no local file storage)");
  }
  return new FsStorage(join(env.KANSO_STORAGE_DIR ?? join(process.cwd(), ".data/storage"), "_portail"));
}

export function getStorage(): ObjectStorage {
  cached ??= createStorage();
  return cached;
}

/** Tests. */
export function setStorage(s: ObjectStorage | null) {
  cached = s;
}
