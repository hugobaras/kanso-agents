export function workerHeartbeat() {
  return {
    ok: true,
    service: "document-worker",
    at: new Date().toISOString(),
  };
}
