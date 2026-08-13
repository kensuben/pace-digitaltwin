import { apiError } from "@/server/http/apiResponse";
import { getDrawingPageAsset } from "@/server/services/pdfIngestionService";

export const dynamic = "force-dynamic";

function asyncIterableResponse(body: AsyncIterable<Uint8Array>) {
  const iterator = body[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await iterator.next();
      if (result.done) controller.close();
      else controller.enqueue(result.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const { pageId } = await context.params;
    const variant =
      new URL(request.url).searchParams.get("variant") === "thumbnail"
        ? "thumbnail"
        : "preview";
    const asset = await getDrawingPageAsset(pageId, variant);
    return new Response(asyncIterableResponse(asset.body), {
      headers: {
        "Content-Type": asset.metadata.contentType,
        "Content-Length": String(asset.metadata.size),
        "Cache-Control": "private, max-age=3600",
        ETag: `"${asset.metadata.checksumSha256}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
