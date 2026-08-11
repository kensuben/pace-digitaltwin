import { FilesystemObjectStorage } from "@/server/storage/filesystemObjectStorage";
import type { ObjectStorage } from "@/server/storage/objectStorage";

let storage: ObjectStorage | undefined;

export function getObjectStorage(): ObjectStorage {
  if (storage) return storage;
  const driver = process.env.OBJECT_STORAGE_DRIVER ?? "filesystem";
  if (driver !== "filesystem") {
    throw new Error(`Unsupported object storage driver: ${driver}`);
  }
  if (process.env.APP_ENV === "production") {
    throw new Error(
      "Filesystem object storage is development-only; configure an approved production adapter.",
    );
  }
  storage = new FilesystemObjectStorage({
    rootDirectory:
      process.env.OBJECT_STORAGE_ROOT ?? "/tmp/pace-digitaltwin-objects",
    applicationBaseUrl: process.env.APP_BASE_URL,
    signingSecret: process.env.OBJECT_STORAGE_SIGNING_SECRET,
  });
  return storage;
}
