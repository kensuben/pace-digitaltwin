import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FilesystemObjectStorage } from "@/server/storage/filesystemObjectStorage";
import {
  assertSafeObjectKey,
  createDrawingObjectKey,
  createDrawingPageObjectKey,
} from "@/server/storage/objectStorage";

const temporaryDirectories: string[] = [];

async function temporaryStorage() {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "pace-storage-"));
  temporaryDirectories.push(rootDirectory);
  return new FilesystemObjectStorage({
    rootDirectory,
    applicationBaseUrl: "http://localhost:3000/",
    instructionTtlSeconds: 60,
    signingSecret: "unit-test-signing-secret",
  });
}

async function* bytes(value: string) {
  yield Buffer.from(value);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("FilesystemObjectStorage", () => {
  it("stores immutable content and returns verified metadata", async () => {
    const storage = await temporaryStorage();
    const key = createDrawingObjectKey({
      campusId: "campus-1",
      documentId: "document-1",
      revisionId: "revision-1",
      extension: ".pdf",
    });
    const checksumSha256 = createHash("sha256")
      .update("safe pdf")
      .digest("hex");

    const stored = await storage.put({
      key,
      contentType: "application/pdf",
      body: bytes("safe pdf"),
      expectedChecksumSha256: checksumSha256,
      maxBytes: 1024,
    });
    expect(stored).toMatchObject({ key, size: 8, checksumSha256 });
    await expect(storage.inspect(key)).resolves.toMatchObject({ size: 8 });

    const stream = await storage.openRead(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("safe pdf");

    await expect(
      storage.put({
        key,
        contentType: "application/pdf",
        body: bytes("again"),
      }),
    ).rejects.toThrow("already exists");
    const preserved = await storage.openRead(key);
    const preservedChunks: Buffer[] = [];
    for await (const chunk of preserved)
      preservedChunks.push(Buffer.from(chunk));
    expect(Buffer.concat(preservedChunks).toString()).toBe("safe pdf");
  });

  it("rejects traversal, mismatched checksums and oversized content", async () => {
    const storage = await temporaryStorage();
    expect(() => assertSafeObjectKey("../secret")).toThrow("not safe");
    expect(() =>
      createDrawingObjectKey({
        campusId: "../campus",
        documentId: "document",
        revisionId: "revision",
        extension: "pdf",
      }),
    ).toThrow("unsupported");
    await expect(
      storage.put({
        key: "safe/checksum.pdf",
        contentType: "application/pdf",
        body: bytes("value"),
        expectedChecksumSha256: "0".repeat(64),
      }),
    ).rejects.toThrow("checksum");
    await expect(
      storage.put({
        key: "safe/large.pdf",
        contentType: "application/pdf",
        body: bytes("too large"),
        maxBytes: 2,
      }),
    ).rejects.toThrow("byte limit");
  });

  it("creates deterministic derived page keys", () => {
    expect(
      createDrawingPageObjectKey({
        campusId: "campus-1",
        documentId: "document-1",
        revisionId: "revision-1",
        pageNumber: 2,
        variant: "thumbnail",
        extension: "webp",
      }),
    ).toBe(
      "campuses/campus-1/drawings/document-1/revisions/revision-1/pages/2/thumbnail.webp",
    );
  });

  it("creates application-stream instructions and deletes idempotently", async () => {
    const storage = await temporaryStorage();
    const key = "campuses/campus/documents/source.pdf";
    const instruction = await storage.createUploadInstruction(key);
    expect(instruction.strategy).toBe("APPLICATION_STREAM");
    expect(instruction.url).toContain(encodeURIComponent(key));
    const instructionUrl = new URL(instruction.url);
    const expires = Number(instructionUrl.searchParams.get("expires"));
    const signature = instructionUrl.searchParams.get("signature") ?? "";
    expect(storage.verifyInstruction("upload", key, expires, signature)).toBe(
      true,
    );
    expect(
      storage.verifyInstruction("upload", key, expires, `${signature}x`),
    ).toBe(false);
    expect(
      storage.verifyInstruction(
        "upload",
        key,
        expires,
        signature,
        new Date((expires + 1) * 1000),
      ),
    ).toBe(false);

    await storage.put({
      key,
      contentType: "application/pdf",
      body: bytes("content"),
    });
    await storage.delete(key);
    await storage.delete(key);
    await expect(storage.inspect(key)).resolves.toBeNull();
  });

  it("refuses a storage root inside the source tree", () => {
    expect(
      () =>
        new FilesystemObjectStorage({
          rootDirectory: path.join(process.cwd(), "objects"),
        }),
    ).toThrow("outside the source tree");
  });
});
