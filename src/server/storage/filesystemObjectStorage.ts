import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import {
  link,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  assertSafeObjectKey,
  type ObjectStorage,
  type PutObjectInput,
  type StorageInstruction,
  type StoredObjectMetadata,
} from "@/server/storage/objectStorage";

interface PersistedMetadata {
  contentType: string;
  size: number;
  checksumSha256: string;
  createdAt: string;
}

export interface FilesystemObjectStorageOptions {
  rootDirectory: string;
  applicationBaseUrl?: string;
  instructionTtlSeconds?: number;
  signingSecret?: string;
}

function isAlreadyExists(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export class FilesystemObjectStorage implements ObjectStorage {
  private readonly rootDirectory: string;
  private readonly applicationBaseUrl: string;
  private readonly instructionTtlSeconds: number;
  private readonly signingSecret: string;

  constructor(options: FilesystemObjectStorageOptions) {
    this.rootDirectory = path.resolve(options.rootDirectory);
    const sourceRoot = path.resolve(process.cwd());
    if (
      this.rootDirectory === sourceRoot ||
      this.rootDirectory.startsWith(`${sourceRoot}${path.sep}`)
    ) {
      throw new Error(
        "Filesystem object storage must be outside the source tree.",
      );
    }
    this.applicationBaseUrl = (
      options.applicationBaseUrl ?? "http://127.0.0.1:3000"
    ).replace(/\/$/, "");
    this.instructionTtlSeconds = options.instructionTtlSeconds ?? 900;
    this.signingSecret =
      options.signingSecret ?? randomBytes(32).toString("base64url");
  }

  private resolveKey(key: string) {
    assertSafeObjectKey(key);
    const resolved = path.resolve(this.rootDirectory, key);
    if (!resolved.startsWith(`${this.rootDirectory}${path.sep}`)) {
      throw new Error("Object key escapes the storage root.");
    }
    return resolved;
  }

  private metadataPath(objectPath: string) {
    return `${objectPath}.metadata.json`;
  }

  async put(input: PutObjectInput): Promise<StoredObjectMetadata> {
    const objectPath = this.resolveKey(input.key);
    const metadataPath = this.metadataPath(objectPath);
    await mkdir(path.dirname(objectPath), { recursive: true });
    const temporaryObjectPath = `${objectPath}.${randomUUID()}.tmp`;
    const temporaryMetadataPath = `${metadataPath}.${randomUUID()}.tmp`;
    const handle = await open(temporaryObjectPath, "wx", 0o600);
    const hash = createHash("sha256");
    let size = 0;

    try {
      for await (const rawChunk of input.body) {
        const chunk = Buffer.from(rawChunk);
        size += chunk.byteLength;
        if (input.maxBytes !== undefined && size > input.maxBytes) {
          throw new Error(`Object exceeds the ${input.maxBytes} byte limit.`);
        }
        hash.update(chunk);
        await handle.write(chunk);
      }
      await handle.sync();
      await handle.close();

      const checksumSha256 = hash.digest("hex");
      if (
        input.expectedChecksumSha256 &&
        checksumSha256 !== input.expectedChecksumSha256.toLowerCase()
      ) {
        throw new Error(
          "Object checksum does not match the declared checksum.",
        );
      }

      const createdAt = new Date();
      const metadata: PersistedMetadata = {
        contentType: input.contentType,
        size,
        checksumSha256,
        createdAt: createdAt.toISOString(),
      };
      await writeFile(temporaryMetadataPath, JSON.stringify(metadata), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });

      let objectLinked = false;
      let metadataLinked = false;
      try {
        await link(temporaryObjectPath, objectPath);
        objectLinked = true;
        await link(temporaryMetadataPath, metadataPath);
        metadataLinked = true;
      } catch (error) {
        if (objectLinked) await rm(objectPath, { force: true });
        if (metadataLinked) await rm(metadataPath, { force: true });
        if (isAlreadyExists(error)) {
          throw new Error(`Object key already exists: ${input.key}`);
        }
        throw error;
      }

      return { key: input.key, ...metadata, createdAt };
    } finally {
      await handle.close().catch(() => undefined);
      await rm(temporaryObjectPath, { force: true });
      await rm(temporaryMetadataPath, { force: true });
    }
  }

  async inspect(key: string): Promise<StoredObjectMetadata | null> {
    const objectPath = this.resolveKey(key);
    try {
      const [metadataText, objectStat] = await Promise.all([
        readFile(this.metadataPath(objectPath), "utf8"),
        stat(objectPath),
      ]);
      const metadata = JSON.parse(metadataText) as PersistedMetadata;
      if (objectStat.size !== metadata.size) {
        throw new Error(`Stored object metadata is inconsistent: ${key}`);
      }
      return {
        key,
        contentType: metadata.contentType,
        size: metadata.size,
        checksumSha256: metadata.checksumSha256,
        createdAt: new Date(metadata.createdAt),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async openRead(key: string): Promise<ReadStream> {
    const objectPath = this.resolveKey(key);
    await stat(objectPath);
    return createReadStream(objectPath);
  }

  createUploadInstruction(key: string): Promise<StorageInstruction> {
    return Promise.resolve(this.createInstruction(key, "upload"));
  }

  createDownloadInstruction(key: string): Promise<StorageInstruction> {
    return Promise.resolve(this.createInstruction(key, "download"));
  }

  private createInstruction(key: string, operation: "upload" | "download") {
    assertSafeObjectKey(key);
    const expires = Math.floor(Date.now() / 1000) + this.instructionTtlSeconds;
    const signature = this.signInstruction(operation, key, expires);
    return {
      strategy: "APPLICATION_STREAM" as const,
      url: `${this.applicationBaseUrl}/api/storage/${operation}?key=${encodeURIComponent(key)}&expires=${expires}&signature=${signature}`,
      expiresAt: new Date(expires * 1000),
    };
  }

  private signInstruction(
    operation: "upload" | "download",
    key: string,
    expires: number,
  ) {
    return createHmac("sha256", this.signingSecret)
      .update(`${operation}\n${key}\n${expires}`)
      .digest("base64url");
  }

  verifyInstruction(
    operation: "upload" | "download",
    key: string,
    expires: number,
    signature: string,
    now = new Date(),
  ) {
    assertSafeObjectKey(key);
    if (
      !Number.isInteger(expires) ||
      expires < Math.floor(now.getTime() / 1000)
    ) {
      return false;
    }
    const expected = Buffer.from(
      this.signInstruction(operation, key, expires),
      "utf8",
    );
    const provided = Buffer.from(signature, "utf8");
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  }

  async delete(key: string): Promise<void> {
    const objectPath = this.resolveKey(key);
    await Promise.all([
      unlink(objectPath).catch((error: unknown) => {
        if (!isNotFound(error)) throw error;
      }),
      unlink(this.metadataPath(objectPath)).catch((error: unknown) => {
        if (!isNotFound(error)) throw error;
      }),
    ]);
  }
}
