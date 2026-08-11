export interface StoredObjectMetadata {
  key: string;
  contentType: string;
  size: number;
  checksumSha256: string;
  createdAt: Date;
}

export interface PutObjectInput {
  key: string;
  contentType: string;
  body: AsyncIterable<Uint8Array>;
  expectedChecksumSha256?: string;
  maxBytes?: number;
}

export interface StorageInstruction {
  strategy: "APPLICATION_STREAM";
  url: string;
  expiresAt: Date;
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<StoredObjectMetadata>;
  inspect(key: string): Promise<StoredObjectMetadata | null>;
  openRead(key: string): Promise<AsyncIterable<Uint8Array>>;
  createUploadInstruction(key: string): Promise<StorageInstruction>;
  createDownloadInstruction(key: string): Promise<StorageInstruction>;
  delete(key: string): Promise<void>;
}

const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const safeExtension = /^[a-z0-9]{1,10}$/;

function assertKeyPart(value: string, label: string) {
  if (!safeIdentifier.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
}

export function createDrawingObjectKey(input: {
  campusId: string;
  documentId: string;
  revisionId: string;
  extension: string;
}): string {
  assertKeyPart(input.campusId, "campusId");
  assertKeyPart(input.documentId, "documentId");
  assertKeyPart(input.revisionId, "revisionId");
  const extension = input.extension.toLowerCase().replace(/^\./, "");
  if (!safeExtension.test(extension)) {
    throw new Error("extension contains unsupported characters.");
  }
  return `campuses/${input.campusId}/drawings/${input.documentId}/revisions/${input.revisionId}/source.${extension}`;
}

export function assertSafeObjectKey(key: string) {
  if (
    !key ||
    key.startsWith("/") ||
    key.endsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error("Object key is not safe.");
  }
}
