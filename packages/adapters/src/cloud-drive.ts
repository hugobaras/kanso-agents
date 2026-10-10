import type { AdapterContext, AdapterResult } from "@kanso/shared";
import type { AuthContext } from "@kanso/tenancy";
import { classifyHttpStatus, networkError } from "./http.js";
import type { DocumentSourceAdapter } from "./types.js";
import type { InboxItem } from "./email-inbox.js";

/**
 * Google Drive — liste fichiers d'un dossier.
 * Secret: `{ "access_token": "...", "folder_id": "..." }` ; sandbox → file mémoire.
 */
export class GoogleDriveSourceAdapter implements DocumentSourceAdapter {
  private readonly mockQueue: InboxItem[];

  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    mockItems: InboxItem[] = [],
  ) {
    this.mockQueue = [...mockItems];
  }

  async poll(
    input: { cursor?: string },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<
    AdapterResult<{
      items: InboxItem[];
      nextCursor?: string;
    }>
  > {
    if (!auth.credentials.access_token || auth.credentials.sandbox === "true") {
      return { status: "ok", data: { items: [...this.mockQueue] } };
    }
    const folderId = auth.credentials.folder_id ?? "root";
    try {
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set(
        "q",
        `'${folderId}' in parents and trashed=false`,
      );
      url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,createdTime)");
      if (input.cursor) url.searchParams.set("pageToken", input.cursor);
      const res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${auth.credentials.access_token}` },
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as {
        nextPageToken?: string;
        files?: {
          id: string;
          name?: string;
          mimeType?: string;
          createdTime?: string;
        }[];
      };
      const items =
        json.files?.map((f) => ({
          sourceItemId: f.id,
          filename: f.name,
          contentType: f.mimeType ?? "application/octet-stream",
          payloadRef: `gdrive://${f.id}`,
          receivedAt: f.createdTime ?? new Date().toISOString(),
        })) ?? [];
      return {
        status: "ok",
        data: { items, nextCursor: json.nextPageToken },
      };
    } catch (err) {
      return networkError(err);
    }
  }

  async ack(
    input: { sourceItemId: string },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ acked: true }>> {
    const idx = this.mockQueue.findIndex((i) => i.sourceItemId === input.sourceItemId);
    if (idx >= 0) this.mockQueue.splice(idx, 1);
    return { status: "ok", data: { acked: true } };
  }
}

/**
 * Dropbox — list_folder.
 * Secret: `{ "access_token": "...", "path": "" }` ; sandbox → file mémoire.
 */
export class DropboxSourceAdapter implements DocumentSourceAdapter {
  private readonly mockQueue: InboxItem[];

  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    mockItems: InboxItem[] = [],
  ) {
    this.mockQueue = [...mockItems];
  }

  async poll(
    input: { cursor?: string },
    auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<
    AdapterResult<{
      items: InboxItem[];
      nextCursor?: string;
    }>
  > {
    if (!auth.credentials.access_token || auth.credentials.sandbox === "true") {
      return { status: "ok", data: { items: [...this.mockQueue] } };
    }
    try {
      const endpoint = input.cursor
        ? "https://api.dropboxapi.com/2/files/list_folder/continue"
        : "https://api.dropboxapi.com/2/files/list_folder";
      const body = input.cursor
        ? { cursor: input.cursor }
        : { path: auth.credentials.path ?? "", limit: 20 };
      const res = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.credentials.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return classifyHttpStatus(res.status, await res.text());
      }
      const json = (await res.json()) as {
        cursor?: string;
        has_more?: boolean;
        entries?: {
          ".tag"?: string;
          id?: string;
          name?: string;
          path_display?: string;
          client_modified?: string;
        }[];
      };
      const items =
        json.entries
          ?.filter((e) => e[".tag"] === "file" && e.id)
          .map((e) => ({
            sourceItemId: e.id!,
            filename: e.name,
            contentType: "application/octet-stream",
            payloadRef: `dropbox://${e.path_display ?? e.id}`,
            receivedAt: e.client_modified ?? new Date().toISOString(),
          })) ?? [];
      return {
        status: "ok",
        data: {
          items,
          nextCursor: json.has_more ? json.cursor : undefined,
        },
      };
    } catch (err) {
      return networkError(err);
    }
  }

  async ack(
    input: { sourceItemId: string },
    _auth: AuthContext,
    _ctx: AdapterContext,
  ): Promise<AdapterResult<{ acked: true }>> {
    const idx = this.mockQueue.findIndex((i) => i.sourceItemId === input.sourceItemId);
    if (idx >= 0) this.mockQueue.splice(idx, 1);
    return { status: "ok", data: { acked: true } };
  }
}
