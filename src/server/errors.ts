export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (typeof error === "object" && error && "code" in error) {
    if (error.code === "P2002") {
      return new AppError(
        "UNIQUE_CONSTRAINT",
        "A record with the same unique value already exists.",
        409,
      );
    }
    if (error.code === "P2003") {
      return new AppError(
        "REFERENCE_CONSTRAINT",
        "The record is still referenced by other data.",
        409,
      );
    }
    if (error.code === "P2025") {
      return new AppError(
        "NOT_FOUND",
        "The requested record was not found.",
        404,
      );
    }
  }

  return new AppError("INTERNAL_ERROR", "Unexpected server error.", 500);
}
