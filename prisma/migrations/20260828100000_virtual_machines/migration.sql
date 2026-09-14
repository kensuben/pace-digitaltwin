CREATE TYPE "VirtualMachineStatus" AS ENUM ('PLANNED', 'RUNNING', 'STOPPED', 'SUSPENDED', 'DECOMMISSIONED');

CREATE TABLE "VirtualMachine" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "hostDeviceId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" TEXT,
  "operatingSystem" TEXT,
  "vcpuCount" INTEGER NOT NULL DEFAULT 1,
  "memoryMb" INTEGER NOT NULL DEFAULT 1024,
  "storageGb" INTEGER NOT NULL DEFAULT 20,
  "ipAddress" TEXT,
  "status" "VirtualMachineStatus" NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualMachine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VirtualMachine_positive_resources" CHECK ("vcpuCount" > 0 AND "memoryMb" > 0 AND "storageGb" > 0)
);

CREATE UNIQUE INDEX "VirtualMachine_id_scenarioId_key" ON "VirtualMachine"("id", "scenarioId");
CREATE UNIQUE INDEX "VirtualMachine_scenarioId_hostname_key" ON "VirtualMachine"("scenarioId", "hostname");
CREATE INDEX "VirtualMachine_hostDeviceId_scenarioId_idx" ON "VirtualMachine"("hostDeviceId", "scenarioId");
CREATE INDEX "VirtualMachine_scenarioId_status_idx" ON "VirtualMachine"("scenarioId", "status");

ALTER TABLE "VirtualMachine" ADD CONSTRAINT "VirtualMachine_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualMachine" ADD CONSTRAINT "VirtualMachine_hostDeviceId_scenarioId_fkey"
  FOREIGN KEY ("hostDeviceId", "scenarioId") REFERENCES "DeviceInstance"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
