ALTER TABLE "DeviceInstance" ADD COLUMN "rackUnitsOverride" INTEGER;
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_rackUnitsOverride_positive"
CHECK ("rackUnitsOverride" IS NULL OR "rackUnitsOverride" > 0);
