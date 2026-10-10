import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function storageRoot(): string {
  return process.env.KANSO_STORAGE_DIR ?? join(process.cwd(), ".data/storage");
}

export function writeJobPayload(
  tenantId: string,
  jobId: string,
  content: Buffer,
): string {
  const dir = join(storageRoot(), tenantId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${jobId}.bin`);
  writeFileSync(path, content);
  return `file://${path}`;
}

export function readJobPayload(storageRef: string): Buffer {
  if (storageRef.startsWith("file://")) {
    return readFileSync(storageRef.slice("file://".length));
  }
  if (storageRef.startsWith("mem://")) {
    return Buffer.from(storageRef.slice("mem://".length));
  }
  throw new Error(`Unsupported storage_ref: ${storageRef.slice(0, 32)}`);
}
