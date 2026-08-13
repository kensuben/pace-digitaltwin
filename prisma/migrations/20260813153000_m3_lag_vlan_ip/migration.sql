CREATE TYPE "LagProtocol" AS ENUM ('STATIC', 'LACP');
CREATE TYPE "LagMode" AS ENUM ('ACTIVE', 'PASSIVE', 'ON');
CREATE TYPE "LogicalSpeedPolicy" AS ENUM ('SUM_MEMBERS', 'MIN_MEMBER', 'MANUAL');
CREATE TYPE "VlanMembershipMode" AS ENUM ('ACCESS', 'TRUNK', 'HYBRID');

CREATE TABLE "LagGroup" (
  "id" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "deviceInstanceId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "protocol" "LagProtocol" NOT NULL DEFAULT 'LACP',
  "mode" "LagMode" NOT NULL DEFAULT 'ACTIVE', "minLinks" INTEGER NOT NULL DEFAULT 1,
  "logicalSpeedPolicy" "LogicalSpeedPolicy" NOT NULL DEFAULT 'SUM_MEMBERS',
  "manualSpeedMbps" INTEGER, "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LagGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LagGroup_minLinks_check" CHECK ("minLinks" > 0),
  CONSTRAINT "LagGroup_manualSpeed_check" CHECK (("logicalSpeedPolicy" = 'MANUAL' AND "manualSpeedMbps" > 0) OR ("logicalSpeedPolicy" <> 'MANUAL' AND "manualSpeedMbps" IS NULL))
);
CREATE TABLE "LagMember" (
  "lagGroupId" TEXT NOT NULL, "portId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LagMember_pkey" PRIMARY KEY ("lagGroupId", "portId")
);
CREATE TABLE "Vlan" (
  "id" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "vlanId" INTEGER NOT NULL,
  "name" TEXT NOT NULL, "purpose" TEXT, "colorKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vlan_id_check" CHECK ("vlanId" BETWEEN 1 AND 4094)
);
CREATE TABLE "Subnet" (
  "id" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "vlanId" TEXT, "name" TEXT NOT NULL,
  "cidr" TEXT NOT NULL, "gateway" TEXT, "dhcpStart" TEXT, "dhcpEnd" TEXT,
  "dnsServers" TEXT[] DEFAULT ARRAY[]::TEXT[], "vrf" TEXT, "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subnet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VlanMembership" (
  "id" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "portId" TEXT, "lagGroupId" TEXT,
  "mode" "VlanMembershipMode" NOT NULL, "nativeVlanId" TEXT, "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VlanMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VlanMembership_target_xor_check" CHECK (("portId" IS NOT NULL)::int + ("lagGroupId" IS NOT NULL)::int = 1)
);
CREATE TABLE "VlanMembershipAllowed" (
  "membershipId" TEXT NOT NULL, "vlanId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL,
  CONSTRAINT "VlanMembershipAllowed_pkey" PRIMARY KEY ("membershipId", "vlanId")
);

CREATE UNIQUE INDEX "LagGroup_id_scenarioId_key" ON "LagGroup"("id", "scenarioId");
CREATE UNIQUE INDEX "LagGroup_scenarioId_deviceInstanceId_name_key" ON "LagGroup"("scenarioId", "deviceInstanceId", "name");
CREATE INDEX "LagGroup_scenarioId_deviceInstanceId_idx" ON "LagGroup"("scenarioId", "deviceInstanceId");
CREATE UNIQUE INDEX "LagMember_portId_key" ON "LagMember"("portId");
CREATE UNIQUE INDEX "LagMember_portId_scenarioId_key" ON "LagMember"("portId", "scenarioId");
CREATE INDEX "LagMember_scenarioId_portId_idx" ON "LagMember"("scenarioId", "portId");
CREATE UNIQUE INDEX "Vlan_id_scenarioId_key" ON "Vlan"("id", "scenarioId");
CREATE UNIQUE INDEX "Vlan_scenarioId_vlanId_key" ON "Vlan"("scenarioId", "vlanId");
CREATE INDEX "Vlan_scenarioId_name_idx" ON "Vlan"("scenarioId", "name");
CREATE UNIQUE INDEX "Subnet_id_scenarioId_key" ON "Subnet"("id", "scenarioId");
CREATE UNIQUE INDEX "Subnet_scenarioId_cidr_vrf_key" ON "Subnet"("scenarioId", "cidr", "vrf");
CREATE INDEX "Subnet_scenarioId_vlanId_idx" ON "Subnet"("scenarioId", "vlanId");
CREATE UNIQUE INDEX "VlanMembership_portId_key" ON "VlanMembership"("portId");
CREATE UNIQUE INDEX "VlanMembership_lagGroupId_key" ON "VlanMembership"("lagGroupId");
CREATE UNIQUE INDEX "VlanMembership_id_scenarioId_key" ON "VlanMembership"("id", "scenarioId");
CREATE UNIQUE INDEX "VlanMembership_portId_scenarioId_key" ON "VlanMembership"("portId", "scenarioId");
CREATE UNIQUE INDEX "VlanMembership_lagGroupId_scenarioId_key" ON "VlanMembership"("lagGroupId", "scenarioId");
CREATE INDEX "VlanMembership_scenarioId_mode_idx" ON "VlanMembership"("scenarioId", "mode");
CREATE INDEX "VlanMembershipAllowed_scenarioId_vlanId_idx" ON "VlanMembershipAllowed"("scenarioId", "vlanId");

ALTER TABLE "LagGroup" ADD CONSTRAINT "LagGroup_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LagGroup" ADD CONSTRAINT "LagGroup_deviceInstanceId_scenarioId_fkey" FOREIGN KEY ("deviceInstanceId", "scenarioId") REFERENCES "DeviceInstance"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LagMember" ADD CONSTRAINT "LagMember_lagGroupId_scenarioId_fkey" FOREIGN KEY ("lagGroupId", "scenarioId") REFERENCES "LagGroup"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LagMember" ADD CONSTRAINT "LagMember_portId_scenarioId_fkey" FOREIGN KEY ("portId", "scenarioId") REFERENCES "Port"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vlan" ADD CONSTRAINT "Vlan_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subnet" ADD CONSTRAINT "Subnet_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subnet" ADD CONSTRAINT "Subnet_vlanId_scenarioId_fkey" FOREIGN KEY ("vlanId", "scenarioId") REFERENCES "Vlan"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VlanMembership" ADD CONSTRAINT "VlanMembership_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VlanMembership" ADD CONSTRAINT "VlanMembership_portId_scenarioId_fkey" FOREIGN KEY ("portId", "scenarioId") REFERENCES "Port"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VlanMembership" ADD CONSTRAINT "VlanMembership_lagGroupId_scenarioId_fkey" FOREIGN KEY ("lagGroupId", "scenarioId") REFERENCES "LagGroup"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VlanMembership" ADD CONSTRAINT "VlanMembership_nativeVlanId_scenarioId_fkey" FOREIGN KEY ("nativeVlanId", "scenarioId") REFERENCES "Vlan"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VlanMembershipAllowed" ADD CONSTRAINT "VlanMembershipAllowed_membershipId_scenarioId_fkey" FOREIGN KEY ("membershipId", "scenarioId") REFERENCES "VlanMembership"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VlanMembershipAllowed" ADD CONSTRAINT "VlanMembershipAllowed_vlanId_scenarioId_fkey" FOREIGN KEY ("vlanId", "scenarioId") REFERENCES "Vlan"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;
