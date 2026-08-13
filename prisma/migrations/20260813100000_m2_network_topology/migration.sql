CREATE TYPE "LinkType" AS ENUM ('ETHERNET', 'FIBER', 'DAC', 'AOC');
CREATE TYPE "LinkStatus" AS ENUM ('PLANNED', 'ACTIVE', 'INACTIVE', 'INVALID');
CREATE TYPE "LinkDuplex" AS ENUM ('FULL', 'HALF', 'AUTO');

CREATE TABLE "PhysicalLink" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "sourcePortId" TEXT NOT NULL,
  "targetPortId" TEXT NOT NULL,
  "linkType" "LinkType" NOT NULL,
  "speedMbps" INTEGER NOT NULL,
  "duplex" "LinkDuplex" NOT NULL DEFAULT 'FULL',
  "status" "LinkStatus" NOT NULL DEFAULT 'PLANNED',
  "cableLabel" TEXT,
  "lengthMeters" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhysicalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhysicalLink_id_scenarioId_key" ON "PhysicalLink"("id", "scenarioId");
CREATE UNIQUE INDEX "PhysicalLink_scenarioId_sourcePortId_targetPortId_key" ON "PhysicalLink"("scenarioId", "sourcePortId", "targetPortId");
CREATE INDEX "PhysicalLink_scenarioId_status_idx" ON "PhysicalLink"("scenarioId", "status");
CREATE INDEX "PhysicalLink_sourcePortId_scenarioId_idx" ON "PhysicalLink"("sourcePortId", "scenarioId");
CREATE INDEX "PhysicalLink_targetPortId_scenarioId_idx" ON "PhysicalLink"("targetPortId", "scenarioId");
CREATE INDEX "AuditLog_scenarioId_timestamp_idx" ON "AuditLog"("scenarioId", "timestamp");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE UNIQUE INDEX "CableRoute_physicalLinkId_scenarioId_key" ON "CableRoute"("physicalLinkId", "scenarioId");

ALTER TABLE "PhysicalLink"
  ADD CONSTRAINT "PhysicalLink_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PhysicalLink_sourcePortId_scenarioId_fkey" FOREIGN KEY ("sourcePortId", "scenarioId") REFERENCES "Port"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PhysicalLink_targetPortId_scenarioId_fkey" FOREIGN KEY ("targetPortId", "scenarioId") REFERENCES "Port"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PhysicalLink_different_ports_check" CHECK ("sourcePortId" <> "targetPortId"),
  ADD CONSTRAINT "PhysicalLink_speed_check" CHECK ("speedMbps" > 0),
  ADD CONSTRAINT "PhysicalLink_length_check" CHECK ("lengthMeters" IS NULL OR "lengthMeters" >= 0);

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CableRoute" DROP CONSTRAINT "CableRoute_physicalLink_deferred_check";
ALTER TABLE "CableRoute"
  ADD CONSTRAINT "CableRoute_physicalLinkId_scenarioId_fkey" FOREIGN KEY ("physicalLinkId", "scenarioId") REFERENCES "PhysicalLink"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
