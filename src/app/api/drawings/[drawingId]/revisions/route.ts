import { apiCreated, apiError } from "@/server/http/apiResponse";
import { uploadPdfRevision } from "@/server/services/pdfIngestionService";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ drawingId: string }> },
) {
  try {
    const { drawingId } = await context.params;
    const form = await request.formData();
    return apiCreated(
      await uploadPdfRevision(
        drawingId,
        form.get("revisionCode"),
        form.get("file"),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
