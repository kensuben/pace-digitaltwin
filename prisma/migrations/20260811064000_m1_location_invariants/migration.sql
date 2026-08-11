-- Strengthen the location hierarchy with composite foreign keys.
ALTER TABLE "DeviceInstance" DROP CONSTRAINT "DeviceInstance_floorId_fkey";
ALTER TABLE "DeviceInstance" DROP CONSTRAINT "DeviceInstance_rackId_fkey";
ALTER TABLE "DeviceInstance" DROP CONSTRAINT "DeviceInstance_zoneId_fkey";

CREATE UNIQUE INDEX "Rack_id_zoneId_key" ON "Rack"("id", "zoneId");

ALTER TABLE "DeviceInstance"
  ADD CONSTRAINT "DeviceInstance_floorId_buildingId_fkey"
  FOREIGN KEY ("floorId", "buildingId") REFERENCES "Floor"("id", "buildingId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeviceInstance"
  ADD CONSTRAINT "DeviceInstance_zoneId_floorId_fkey"
  FOREIGN KEY ("zoneId", "floorId") REFERENCES "Zone"("id", "floorId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeviceInstance"
  ADD CONSTRAINT "DeviceInstance_rackId_zoneId_fkey"
  FOREIGN KEY ("rackId", "zoneId") REFERENCES "Rack"("id", "zoneId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not currently express these scalar business invariants.
ALTER TABLE "Floor"
  ADD CONSTRAINT "Floor_floorToFloorHeightMeters_positive"
  CHECK ("floorToFloorHeightMeters" IS NULL OR "floorToFloorHeightMeters" > 0);

ALTER TABLE "Rack"
  ADD CONSTRAINT "Rack_rackUnits_positive" CHECK ("rackUnits" > 0);

ALTER TABLE "DeviceModel"
  ADD CONSTRAINT "DeviceModel_rackUnits_positive"
  CHECK ("rackUnits" IS NULL OR "rackUnits" > 0);

ALTER TABLE "PortProfile"
  ADD CONSTRAINT "PortProfile_count_positive" CHECK ("count" > 0),
  ADD CONSTRAINT "PortProfile_startNumber_non_negative" CHECK ("startNumber" >= 0);

ALTER TABLE "DeviceInstance"
  ADD CONSTRAINT "DeviceInstance_rack_requires_zone"
  CHECK ("rackId" IS NULL OR "zoneId" IS NOT NULL),
  ADD CONSTRAINT "DeviceInstance_rackUnitStart_positive"
  CHECK ("rackUnitStart" IS NULL OR "rackUnitStart" > 0);

ALTER TABLE "Port"
  ADD CONSTRAINT "Port_index_positive" CHECK ("index" > 0),
  ADD CONSTRAINT "Port_negotiatedSpeedMbps_positive"
  CHECK ("negotiatedSpeedMbps" IS NULL OR "negotiatedSpeedMbps" > 0);
