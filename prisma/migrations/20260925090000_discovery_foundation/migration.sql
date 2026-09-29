-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscoveryMode" AS ENUM ('MOCK');

-- CreateTable
CREATE TABLE "DiscoveryCollector" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "DiscoveryMode" NOT NULL DEFAULT 'MOCK',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryCollector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryScope" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "networkDomain" TEXT NOT NULL,
    "mode" "DiscoveryMode" NOT NULL DEFAULT 'MOCK',
    "cidrs" TEXT[],
    "exclusions" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "errorCode" TEXT,
    "resultJson" JSONB,
    "finalizedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryDesignSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "deviceCount" INTEGER NOT NULL,
    "linkCount" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryDesignSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryBatch" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryCollector_campusId_idx" ON "DiscoveryCollector"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCollector_id_campusId_key" ON "DiscoveryCollector"("id", "campusId");

-- CreateIndex
CREATE INDEX "DiscoveryScope_campusId_createdAt_idx" ON "DiscoveryScope"("campusId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryScope_collectorId_campusId_idx" ON "DiscoveryScope"("collectorId", "campusId");

-- CreateIndex
CREATE INDEX "DiscoveryRun_scopeId_status_createdAt_idx" ON "DiscoveryRun"("scopeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryRun_status_leaseExpiresAt_deadlineAt_idx" ON "DiscoveryRun"("status", "leaseExpiresAt", "deadlineAt");

-- CreateIndex
CREATE INDEX "DiscoveryRun_scenarioId_idx" ON "DiscoveryRun"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRun_createdBy_idempotencyKey_key" ON "DiscoveryRun"("createdBy", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryDesignSnapshot_runId_key" ON "DiscoveryDesignSnapshot"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryBatch_runId_batchId_key" ON "DiscoveryBatch"("runId", "batchId");

-- CreateIndex
CREATE INDEX "DiscoveryEvent_runId_createdAt_idx" ON "DiscoveryEvent"("runId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscoveryCollector" ADD CONSTRAINT "DiscoveryCollector_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryScope" ADD CONSTRAINT "DiscoveryScope_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryScope" ADD CONSTRAINT "DiscoveryScope_collectorId_campusId_fkey" FOREIGN KEY ("collectorId", "campusId") REFERENCES "DiscoveryCollector"("id", "campusId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "DiscoveryScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryDesignSnapshot" ADD CONSTRAINT "DiscoveryDesignSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryBatch" ADD CONSTRAINT "DiscoveryBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
