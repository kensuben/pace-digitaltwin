CREATE TABLE "RackPlacement" (
  "id" TEXT NOT NULL,
  "rackId" TEXT NOT NULL,
  "zoneId" TEXT NOT NULL,
  "floorId" TEXT NOT NULL,
  "floorMapId" TEXT,
  "scenarioId" TEXT NOT NULL,
  "xMeters" DOUBLE PRECISION NOT NULL,
  "yMeters" DOUBLE PRECISION NOT NULL,
  "zMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "widthMeters" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  "depthMeters" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "heightMeters" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "rotationDegrees" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RackPlacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RackPlacement_positive_dimensions" CHECK ("widthMeters" > 0 AND "depthMeters" > 0 AND "heightMeters" > 0)
);

CREATE UNIQUE INDEX "RackPlacement_rackId_scenarioId_key" ON "RackPlacement"("rackId", "scenarioId");
CREATE INDEX "RackPlacement_scenarioId_floorId_idx" ON "RackPlacement"("scenarioId", "floorId");
CREATE INDEX "RackPlacement_floorMapId_floorId_idx" ON "RackPlacement"("floorMapId", "floorId");

ALTER TABLE "RackPlacement" ADD CONSTRAINT "RackPlacement_rackId_zoneId_fkey"
  FOREIGN KEY ("rackId", "zoneId") REFERENCES "Rack"("id", "zoneId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RackPlacement" ADD CONSTRAINT "RackPlacement_zoneId_floorId_fkey"
  FOREIGN KEY ("zoneId", "floorId") REFERENCES "Zone"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RackPlacement" ADD CONSTRAINT "RackPlacement_floorId_fkey"
  FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RackPlacement" ADD CONSTRAINT "RackPlacement_floorMapId_floorId_fkey"
  FOREIGN KEY ("floorMapId", "floorId") REFERENCES "FloorMap"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RackPlacement" ADD CONSTRAINT "RackPlacement_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CableRoutePoint" ADD COLUMN "riserId" TEXT;
CREATE INDEX "CableRoutePoint_riserId_idx" ON "CableRoutePoint"("riserId");
ALTER TABLE "CableRoutePoint" ADD CONSTRAINT "CableRoutePoint_riserId_fkey"
  FOREIGN KEY ("riserId") REFERENCES "Riser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
