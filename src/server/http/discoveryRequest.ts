import { MAX_BATCH_BYTES } from "@/domain/discovery/contracts";
import { AppError } from "@/server/errors";

// Enforce the actual streamed byte count, including requests without Content-Length.
export async function readDiscoveryJson(request: Request, limit = MAX_BATCH_BYTES): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new AppError("INVALID_CONTENT_TYPE", "Expected application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_JSON", "A JSON body is required.", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("PAYLOAD_TOO_LARGE", "Discovery payload exceeds the size limit.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("INVALID_JSON", "Invalid JSON body.", 400);
  }
}
