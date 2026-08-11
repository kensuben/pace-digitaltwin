-- CreateEnum
CREATE TYPE "DeviceCategory" AS ENUM ('FIREWALL', 'CORE_SWITCH', 'DISTRIBUTION_SWITCH', 'ACCESS_SWITCH', 'SERVER', 'NAS', 'NVR', 'AP', 'CAMERA', 'UPS', 'ISP_CPE', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PLANNED', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('BASELINE', 'PROPOSED', 'ALTERNATIVE', 'FAILURE');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('SERVER_ROOM', 'OFFICE', 'CLASSROOM', 'COMMON', 'SECURITY', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('VERIFIED_VENDOR', 'USER_CONFIRMED', 'ESTIMATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PortMedia" AS ENUM ('RJ45', 'SFP', 'SFP_PLUS', 'SFP28', 'QSFP28');

-- CreateEnum
CREATE TYPE "PoeStandard" AS ENUM ('NONE', 'POE', 'POE_PLUS', 'POE_PLUS_PLUS');

-- CreateEnum
CREATE TYPE "PortRoleHint" AS ENUM ('MANAGEMENT', 'DATA', 'UPLINK', 'WAN', 'HA', 'CONSOLE', 'OTHER');

-- CreateEnum
CREATE TYPE "PortAdminStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PortOperationalStatus" AS ENUM ('UP', 'DOWN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "elevationMeters" DOUBLE PRECISION,
    "floorToFloorHeightMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rackUnits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceModel" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" "DeviceCategory" NOT NULL,
    "sku" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "formFactor" TEXT,
    "rackUnits" INTEGER,
    "switchingCapacityGbps" DOUBLE PRECISION,
    "forwardingMpps" DOUBLE PRECISION,
    "firewallGbps" DOUBLE PRECISION,
    "ipsGbps" DOUBLE PRECISION,
    "ngfwGbps" DOUBLE PRECISION,
    "tlsInspectionGbps" DOUBLE PRECISION,
    "maxVlans" INTEGER,
    "maxLagGroups" INTEGER,
    "maxLagMembers" INTEGER,
    "supportsLacp" BOOLEAN NOT NULL DEFAULT false,
    "supportsMlag" BOOLEAN NOT NULL DEFAULT false,
    "supportsStacking" BOOLEAN NOT NULL DEFAULT false,
    "supportsHa" BOOLEAN NOT NULL DEFAULT false,
    "stackBandwidthGbps" DOUBLE PRECISION,
    "managementOs" TEXT,
    "metadataJson" JSONB,
    "sourceUrl" TEXT,
    "specStatus" "SpecStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verifiedAt" TIMESTAMP(3),
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortProfile" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "portGroup" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "media" "PortMedia" NOT NULL,
    "supportedSpeedsMbps" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "poeStandard" "PoeStandard" NOT NULL DEFAULT 'NONE',
    "roleHint" "PortRoleHint" NOT NULL DEFAULT 'DATA',
    "breakoutCapable" BOOLEAN NOT NULL DEFAULT false,
    "namePrefix" TEXT NOT NULL,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScenarioType" NOT NULL,
    "parentScenarioId" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceInstance" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "assetTag" TEXT,
    "hostname" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "managementIp" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PLANNED',
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "zoneId" TEXT,
    "rackId" TEXT,
    "rackUnitStart" INTEGER,
    "notes" TEXT,
    "graphX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "graphY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "deviceInstanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "media" "PortMedia" NOT NULL,
    "supportedSpeedsMbps" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "poeStandard" "PoeStandard" NOT NULL DEFAULT 'NONE',
    "roleHint" "PortRoleHint" NOT NULL DEFAULT 'DATA',
    "breakoutCapable" BOOLEAN NOT NULL DEFAULT false,
    "negotiatedSpeedMbps" INTEGER,
    "adminStatus" "PortAdminStatus" NOT NULL DEFAULT 'ENABLED',
    "operationalStatus" "PortOperationalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "parentBreakoutPortId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campus_code_key" ON "Campus"("code");

-- CreateIndex
CREATE INDEX "Building_campusId_idx" ON "Building"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_campusId_code_key" ON "Building"("campusId", "code");

-- CreateIndex
CREATE INDEX "Floor_buildingId_level_idx" ON "Floor"("buildingId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_buildingId_code_key" ON "Floor"("buildingId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_id_buildingId_key" ON "Floor"("id", "buildingId");

-- CreateIndex
CREATE INDEX "Zone_floorId_idx" ON "Zone"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_floorId_code_key" ON "Zone"("floorId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_id_floorId_key" ON "Zone"("id", "floorId");

-- CreateIndex
CREATE INDEX "Rack_zoneId_idx" ON "Rack"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Rack_zoneId_code_key" ON "Rack"("zoneId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_code_key" ON "Vendor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceModel_sku_key" ON "DeviceModel"("sku");

-- CreateIndex
CREATE INDEX "DeviceModel_vendorId_category_idx" ON "DeviceModel"("vendorId", "category");

-- CreateIndex
CREATE INDEX "PortProfile_modelId_sortOrder_idx" ON "PortProfile"("modelId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PortProfile_modelId_portGroup_key" ON "PortProfile"("modelId", "portGroup");

-- CreateIndex
CREATE INDEX "Scenario_type_isLocked_idx" ON "Scenario"("type", "isLocked");

-- CreateIndex
CREATE INDEX "DeviceInstance_scenarioId_status_idx" ON "DeviceInstance"("scenarioId", "status");

-- CreateIndex
CREATE INDEX "DeviceInstance_buildingId_floorId_idx" ON "DeviceInstance"("buildingId", "floorId");

-- CreateIndex
CREATE INDEX "DeviceInstance_modelId_idx" ON "DeviceInstance"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_id_scenarioId_key" ON "DeviceInstance"("id", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_scenarioId_hostname_key" ON "DeviceInstance"("scenarioId", "hostname");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_scenarioId_assetTag_key" ON "DeviceInstance"("scenarioId", "assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_scenarioId_managementIp_key" ON "DeviceInstance"("scenarioId", "managementIp");

-- CreateIndex
CREATE INDEX "Port_scenarioId_deviceInstanceId_idx" ON "Port"("scenarioId", "deviceInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Port_id_scenarioId_key" ON "Port"("id", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Port_deviceInstanceId_name_key" ON "Port"("deviceInstanceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Port_deviceInstanceId_index_key" ON "Port"("deviceInstanceId", "index");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceModel" ADD CONSTRAINT "DeviceModel_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortProfile" ADD CONSTRAINT "PortProfile_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DeviceModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_parentScenarioId_fkey" FOREIGN KEY ("parentScenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DeviceModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_deviceInstanceId_scenarioId_fkey" FOREIGN KEY ("deviceInstanceId", "scenarioId") REFERENCES "DeviceInstance"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_parentBreakoutPortId_scenarioId_fkey" FOREIGN KEY ("parentBreakoutPortId", "scenarioId") REFERENCES "Port"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
