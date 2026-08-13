import { setTimeout as delay } from "node:timers/promises";

import { PrismaPdfIngestionRepository } from "@/server/repositories/pdfIngestionRepository";
import { getObjectStorage } from "@/server/storage";
import { processPdfJob } from "@/workers/pdfProcessor";

const once = process.argv.includes("--once");
const repository = new PrismaPdfIngestionRepository();
const storage = getObjectStorage();

async function runOne() {
  const job = await repository.claimNextJob();
  if (!job) return false;
  try {
    await processPdfJob(job, repository, storage);
    console.log(`PDF job ${job.id} succeeded.`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown PDF error";
    const code = message.startsWith("PDF_") ? message : "PDF_PROCESSING_FAILED";
    await repository.failJob(job.id, code, message);
    console.error(`PDF job ${job.id} failed: ${message}`);
  }
  return true;
}

async function main() {
  do {
    const processed = await runOne();
    if (once) return;
    if (!processed) await delay(3000);
  } while (true);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
