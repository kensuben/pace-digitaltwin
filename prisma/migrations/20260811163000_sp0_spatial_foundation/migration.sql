-- CreateEnum
CREATE TYPE "DrawingDocumentType" AS ENUM ('FLOOR_PLAN', 'ELV', 'NETWORK', 'CCTV', 'WIFI', 'FIRE_ALARM', 'ACCESS_CONTROL', 'RISER', 'RACK_LAYOUT', 'ARCHITECTURAL', 'THREE_D_PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "DrawingStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'NEEDS_MAPPING', 'NEEDS_CONVERSION', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DrawingPageStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FloorMapSourceType" AS ENUM ('PDF_PAGE', 'IMAGE', 'VECTOR', 'GLTF_FLOOR', 'MANUAL');

-- CreateEnum
CREATE TYPE "SpatialUnit" AS ENUM ('METER');

-- CreateEnum
CREATE TYPE "SpatialAxisConvention" AS ENUM ('X_RIGHT_Y_DOWN_Z_UP');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('UNCALIBRATED', 'CALIBRATED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SpatialGeometryType" AS ENUM ('POLYGON', 'RECTANGLE', 'LINE_STRING', 'POINT');

-- CreateEnum
CREATE TYPE "BuildingFeatureType" AS ENUM ('WALL', 'DOOR', 'WINDOW', 'STAIR', 'ELEVATOR', 'RISER', 'SHAFT', 'CABLE_TRAY', 'PATHWAY', 'COLUMN', 'RESTRICTED_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "MountingType" AS ENUM ('RACK', 'WALL', 'CEILING', 'DESK', 'FLOOR', 'POLE', 'OUTDOOR', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "PlacementAnchorType" AS ENUM ('POINT', 'RACK_U', 'SURFACE');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('PLANNED', 'INSTALLED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "DrawingImportJobType" AS ENUM ('PDF_INSPECT', 'PDF_RENDER', 'PDF_EXTRACT', 'THREE_D_EXTRACT', 'GLB_PROCESS');

-- CreateEnum
CREATE TYPE "DrawingImportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuildingModelSourceFormat" AS ENUM ('GLB', 'GLTF', 'THREE_D_PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingModelStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'NEEDS_CONVERSION', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModelNodeSemanticType" AS ENUM ('BUILDING', 'FLOOR', 'WALL', 'ROOM', 'ROOF', 'STAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "CableRouteType" AS ENUM ('COPPER', 'FIBER', 'DAC', 'AOC', 'POWER', 'OTHER');

-- CreateEnum
CREATE TYPE "CableRouteStatus" AS ENUM ('PLANNED', 'INSTALLED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "RiserType" AS ENUM ('DATA', 'POWER', 'FIRE', 'HVAC', 'MIXED');

-- CreateTable
CREATE TABLE "DrawingDocument" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" "DrawingDocumentType" NOT NULL,
    "status" "DrawingStatus" NOT NULL DEFAULT 'UPLOADING',
    "pageCount" INTEGER,
    "metadataJson" JSONB,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingRevision" (
    "id" TEXT NOT NULL,
    "drawingDocumentId" TEXT NOT NULL,
    "revisionCode" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DrawingStatus" NOT NULL DEFAULT 'UPLOADING',
    "issuedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingPage" (
    "id" TEXT NOT NULL,
    "drawingDocumentId" TEXT NOT NULL,
    "drawingRevisionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "widthPoints" DOUBLE PRECISION,
    "heightPoints" DOUBLE PRECISION,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "previewStorageKey" TEXT,
    "thumbnailStorageKey" TEXT,
    "buildingId" TEXT,
    "floorId" TEXT,
    "titleDetected" TEXT,
    "drawingNumber" TEXT,
    "revisionLabel" TEXT,
    "scaleText" TEXT,
    "status" "DrawingPageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpatialCoordinateSystem" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "unit" "SpatialUnit" NOT NULL DEFAULT 'METER',
    "originX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "axisConvention" "SpatialAxisConvention" NOT NULL DEFAULT 'X_RIGHT_Y_DOWN_Z_UP',
    "unitsPerPdfPoint" DOUBLE PRECISION,
    "calibrationStatus" "CalibrationStatus" NOT NULL DEFAULT 'UNCALIBRATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpatialCoordinateSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorMap" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "name" TEXT NOT NULL,
    "purpose" "DrawingDocumentType" NOT NULL DEFAULT 'FLOOR_PLAN',
    "sourceType" "FloorMapSourceType" NOT NULL,
    "drawingPageId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotationDegrees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coordinateSystemId" TEXT NOT NULL,
    "pdfToFloorTransform" JSONB,
    "cropX" DOUBLE PRECISION,
    "cropY" DOUBLE PRECISION,
    "cropWidth" DOUBLE PRECISION,
    "cropHeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScaleCalibration" (
    "id" TEXT NOT NULL,
    "floorMapId" TEXT NOT NULL,
    "pointAPdfX" DOUBLE PRECISION NOT NULL,
    "pointAPdfY" DOUBLE PRECISION NOT NULL,
    "pointBPdfX" DOUBLE PRECISION NOT NULL,
    "pointBPdfY" DOUBLE PRECISION NOT NULL,
    "realDistanceMeters" DOUBLE PRECISION NOT NULL,
    "calculatedMetersPerPdfPoint" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePlacement" (
    "id" TEXT NOT NULL,
    "deviceInstanceId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "floorMapId" TEXT,
    "xMeters" DOUBLE PRECISION NOT NULL,
    "yMeters" DOUBLE PRECISION NOT NULL,
    "zMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mountingType" "MountingType" NOT NULL DEFAULT 'VIRTUAL',
    "anchorType" "PlacementAnchorType" NOT NULL DEFAULT 'POINT',
    "placementStatus" "PlacementStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpatialZone" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "floorMapId" TEXT NOT NULL,
    "coordinateSystemId" TEXT NOT NULL,
    "geometryType" "SpatialGeometryType" NOT NULL,
    "geometryJson" JSONB NOT NULL,
    "geometryVersion" INTEGER NOT NULL DEFAULT 1,
    "areaM2" DOUBLE PRECISION,
    "labelX" DOUBLE PRECISION,
    "labelY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpatialZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingFeature" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "floorMapId" TEXT NOT NULL,
    "coordinateSystemId" TEXT NOT NULL,
    "type" "BuildingFeatureType" NOT NULL,
    "geometryType" "SpatialGeometryType" NOT NULL,
    "geometryJson" JSONB NOT NULL,
    "geometryVersion" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingImportJob" (
    "id" TEXT NOT NULL,
    "drawingDocumentId" TEXT NOT NULL,
    "type" "DrawingImportJobType" NOT NULL,
    "status" "DrawingImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingModel3D" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "sourceDrawingDocumentId" TEXT,
    "name" TEXT NOT NULL,
    "sourceFormat" "BuildingModelSourceFormat" NOT NULL,
    "runtimeFormat" "BuildingModelSourceFormat" NOT NULL DEFAULT 'GLB',
    "sourceStorageKey" TEXT NOT NULL,
    "runtimeStorageKey" TEXT,
    "status" "BuildingModelStatus" NOT NULL DEFAULT 'UPLOADING',
    "scaleToMeters" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "originX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boundingBoxJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingModel3D_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelNodeMapping" (
    "id" TEXT NOT NULL,
    "buildingModel3DId" TEXT NOT NULL,
    "sceneNodeName" TEXT NOT NULL,
    "semanticType" "ModelNodeSemanticType" NOT NULL,
    "floorId" TEXT,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelNodeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableRoute" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "physicalLinkId" TEXT,
    "routeType" "CableRouteType" NOT NULL,
    "sourceDeviceId" TEXT,
    "targetDeviceId" TEXT,
    "totalLengthMeters" DOUBLE PRECISION,
    "calculatedLengthMeters" DOUBLE PRECISION,
    "status" "CableRouteStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CableRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableRoutePoint" (
    "id" TEXT NOT NULL,
    "cableRouteId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "floorId" TEXT NOT NULL,
    "xMeters" DOUBLE PRECISION NOT NULL,
    "yMeters" DOUBLE PRECISION NOT NULL,
    "zMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "featureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CableRoutePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Riser" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RiserType" NOT NULL,
    "xMeters" DOUBLE PRECISION,
    "yMeters" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Riser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawingDocument_buildingId_documentType_status_idx" ON "DrawingDocument"("buildingId", "documentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingDocument_id_buildingId_key" ON "DrawingDocument"("id", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingRevision_storageKey_key" ON "DrawingRevision"("storageKey");

-- CreateIndex
CREATE INDEX "DrawingRevision_drawingDocumentId_status_idx" ON "DrawingRevision"("drawingDocumentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingRevision_id_drawingDocumentId_key" ON "DrawingRevision"("id", "drawingDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingRevision_drawingDocumentId_revisionCode_key" ON "DrawingRevision"("drawingDocumentId", "revisionCode");

-- CreateIndex
CREATE INDEX "DrawingPage_drawingDocumentId_idx" ON "DrawingPage"("drawingDocumentId");

-- CreateIndex
CREATE INDEX "DrawingPage_buildingId_floorId_idx" ON "DrawingPage"("buildingId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingPage_id_floorId_key" ON "DrawingPage"("id", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingPage_drawingRevisionId_pageNumber_key" ON "DrawingPage"("drawingRevisionId", "pageNumber");

-- CreateIndex
CREATE INDEX "SpatialCoordinateSystem_floorId_calibrationStatus_idx" ON "SpatialCoordinateSystem"("floorId", "calibrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SpatialCoordinateSystem_id_floorId_key" ON "SpatialCoordinateSystem"("id", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "SpatialCoordinateSystem_floorId_name_version_key" ON "SpatialCoordinateSystem"("floorId", "name", "version");

-- CreateIndex
CREATE INDEX "FloorMap_floorId_scenarioId_purpose_isActive_idx" ON "FloorMap"("floorId", "scenarioId", "purpose", "isActive");

-- CreateIndex
CREATE INDEX "FloorMap_drawingPageId_idx" ON "FloorMap"("drawingPageId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorMap_id_floorId_key" ON "FloorMap"("id", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorMap_floorId_scenarioId_purpose_revision_key" ON "FloorMap"("floorId", "scenarioId", "purpose", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ScaleCalibration_floorMapId_key" ON "ScaleCalibration"("floorMapId");

-- CreateIndex
CREATE INDEX "DevicePlacement_scenarioId_floorId_idx" ON "DevicePlacement"("scenarioId", "floorId");

-- CreateIndex
CREATE INDEX "DevicePlacement_floorMapId_floorId_idx" ON "DevicePlacement"("floorMapId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePlacement_deviceInstanceId_scenarioId_key" ON "DevicePlacement"("deviceInstanceId", "scenarioId");

-- CreateIndex
CREATE INDEX "SpatialZone_floorId_floorMapId_idx" ON "SpatialZone"("floorId", "floorMapId");

-- CreateIndex
CREATE UNIQUE INDEX "SpatialZone_zoneId_floorMapId_key" ON "SpatialZone"("zoneId", "floorMapId");

-- CreateIndex
CREATE INDEX "BuildingFeature_floorId_type_idx" ON "BuildingFeature"("floorId", "type");

-- CreateIndex
CREATE INDEX "BuildingFeature_floorMapId_idx" ON "BuildingFeature"("floorMapId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingFeature_id_floorId_key" ON "BuildingFeature"("id", "floorId");

-- CreateIndex
CREATE INDEX "DrawingImportJob_status_availableAt_idx" ON "DrawingImportJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "DrawingImportJob_drawingDocumentId_type_idx" ON "DrawingImportJob"("drawingDocumentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingModel3D_sourceStorageKey_key" ON "BuildingModel3D"("sourceStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingModel3D_runtimeStorageKey_key" ON "BuildingModel3D"("runtimeStorageKey");

-- CreateIndex
CREATE INDEX "BuildingModel3D_buildingId_scenarioId_status_idx" ON "BuildingModel3D"("buildingId", "scenarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingModel3D_id_buildingId_key" ON "BuildingModel3D"("id", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingModel3D_buildingId_scenarioId_name_key" ON "BuildingModel3D"("buildingId", "scenarioId", "name");

-- CreateIndex
CREATE INDEX "ModelNodeMapping_floorId_zoneId_idx" ON "ModelNodeMapping"("floorId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelNodeMapping_buildingModel3DId_sceneNodeName_key" ON "ModelNodeMapping"("buildingModel3DId", "sceneNodeName");

-- CreateIndex
CREATE INDEX "CableRoute_scenarioId_status_idx" ON "CableRoute"("scenarioId", "status");

-- CreateIndex
CREATE INDEX "CableRoute_physicalLinkId_scenarioId_idx" ON "CableRoute"("physicalLinkId", "scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CableRoute_id_scenarioId_key" ON "CableRoute"("id", "scenarioId");

-- CreateIndex
CREATE INDEX "CableRoutePoint_scenarioId_floorId_idx" ON "CableRoutePoint"("scenarioId", "floorId");

-- CreateIndex
CREATE INDEX "CableRoutePoint_featureId_floorId_idx" ON "CableRoutePoint"("featureId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "CableRoutePoint_cableRouteId_sequence_key" ON "CableRoutePoint"("cableRouteId", "sequence");

-- CreateIndex
CREATE INDEX "Riser_buildingId_type_idx" ON "Riser"("buildingId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Riser_buildingId_code_key" ON "Riser"("buildingId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Building_id_campusId_key" ON "Building"("id", "campusId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_id_scenarioId_floorId_key" ON "DeviceInstance"("id", "scenarioId", "floorId");

-- AddForeignKey
ALTER TABLE "DrawingDocument" ADD CONSTRAINT "DrawingDocument_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingDocument" ADD CONSTRAINT "DrawingDocument_buildingId_campusId_fkey" FOREIGN KEY ("buildingId", "campusId") REFERENCES "Building"("id", "campusId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingRevision" ADD CONSTRAINT "DrawingRevision_drawingDocumentId_fkey" FOREIGN KEY ("drawingDocumentId") REFERENCES "DrawingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingRevision" ADD CONSTRAINT "DrawingRevision_supersedesId_drawingDocumentId_fkey" FOREIGN KEY ("supersedesId", "drawingDocumentId") REFERENCES "DrawingRevision"("id", "drawingDocumentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_drawingDocumentId_fkey" FOREIGN KEY ("drawingDocumentId") REFERENCES "DrawingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_drawingRevisionId_drawingDocumentId_fkey" FOREIGN KEY ("drawingRevisionId", "drawingDocumentId") REFERENCES "DrawingRevision"("id", "drawingDocumentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingPage" ADD CONSTRAINT "DrawingPage_floorId_buildingId_fkey" FOREIGN KEY ("floorId", "buildingId") REFERENCES "Floor"("id", "buildingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpatialCoordinateSystem" ADD CONSTRAINT "SpatialCoordinateSystem_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorMap" ADD CONSTRAINT "FloorMap_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorMap" ADD CONSTRAINT "FloorMap_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorMap" ADD CONSTRAINT "FloorMap_drawingPageId_floorId_fkey" FOREIGN KEY ("drawingPageId", "floorId") REFERENCES "DrawingPage"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorMap" ADD CONSTRAINT "FloorMap_coordinateSystemId_floorId_fkey" FOREIGN KEY ("coordinateSystemId", "floorId") REFERENCES "SpatialCoordinateSystem"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScaleCalibration" ADD CONSTRAINT "ScaleCalibration_floorMapId_fkey" FOREIGN KEY ("floorMapId") REFERENCES "FloorMap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePlacement" ADD CONSTRAINT "DevicePlacement_deviceInstanceId_scenarioId_floorId_fkey" FOREIGN KEY ("deviceInstanceId", "scenarioId", "floorId") REFERENCES "DeviceInstance"("id", "scenarioId", "floorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePlacement" ADD CONSTRAINT "DevicePlacement_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePlacement" ADD CONSTRAINT "DevicePlacement_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePlacement" ADD CONSTRAINT "DevicePlacement_floorMapId_floorId_fkey" FOREIGN KEY ("floorMapId", "floorId") REFERENCES "FloorMap"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpatialZone" ADD CONSTRAINT "SpatialZone_zoneId_floorId_fkey" FOREIGN KEY ("zoneId", "floorId") REFERENCES "Zone"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpatialZone" ADD CONSTRAINT "SpatialZone_floorMapId_floorId_fkey" FOREIGN KEY ("floorMapId", "floorId") REFERENCES "FloorMap"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpatialZone" ADD CONSTRAINT "SpatialZone_coordinateSystemId_floorId_fkey" FOREIGN KEY ("coordinateSystemId", "floorId") REFERENCES "SpatialCoordinateSystem"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingFeature" ADD CONSTRAINT "BuildingFeature_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingFeature" ADD CONSTRAINT "BuildingFeature_floorMapId_floorId_fkey" FOREIGN KEY ("floorMapId", "floorId") REFERENCES "FloorMap"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingFeature" ADD CONSTRAINT "BuildingFeature_coordinateSystemId_floorId_fkey" FOREIGN KEY ("coordinateSystemId", "floorId") REFERENCES "SpatialCoordinateSystem"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingImportJob" ADD CONSTRAINT "DrawingImportJob_drawingDocumentId_fkey" FOREIGN KEY ("drawingDocumentId") REFERENCES "DrawingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingModel3D" ADD CONSTRAINT "BuildingModel3D_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingModel3D" ADD CONSTRAINT "BuildingModel3D_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingModel3D" ADD CONSTRAINT "BuildingModel3D_sourceDrawingDocumentId_buildingId_fkey" FOREIGN KEY ("sourceDrawingDocumentId", "buildingId") REFERENCES "DrawingDocument"("id", "buildingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelNodeMapping" ADD CONSTRAINT "ModelNodeMapping_buildingModel3DId_fkey" FOREIGN KEY ("buildingModel3DId") REFERENCES "BuildingModel3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelNodeMapping" ADD CONSTRAINT "ModelNodeMapping_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelNodeMapping" ADD CONSTRAINT "ModelNodeMapping_zoneId_floorId_fkey" FOREIGN KEY ("zoneId", "floorId") REFERENCES "Zone"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoute" ADD CONSTRAINT "CableRoute_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoute" ADD CONSTRAINT "CableRoute_sourceDeviceId_scenarioId_fkey" FOREIGN KEY ("sourceDeviceId", "scenarioId") REFERENCES "DeviceInstance"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoute" ADD CONSTRAINT "CableRoute_targetDeviceId_scenarioId_fkey" FOREIGN KEY ("targetDeviceId", "scenarioId") REFERENCES "DeviceInstance"("id", "scenarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoutePoint" ADD CONSTRAINT "CableRoutePoint_cableRouteId_scenarioId_fkey" FOREIGN KEY ("cableRouteId", "scenarioId") REFERENCES "CableRoute"("id", "scenarioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoutePoint" ADD CONSTRAINT "CableRoutePoint_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRoutePoint" ADD CONSTRAINT "CableRoutePoint_featureId_floorId_fkey" FOREIGN KEY ("featureId", "floorId") REFERENCES "BuildingFeature"("id", "floorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Riser" ADD CONSTRAINT "Riser_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL constraints that Prisma cannot express.
ALTER TABLE "DrawingDocument"
  ADD CONSTRAINT "DrawingDocument_pageCount_check" CHECK ("pageCount" IS NULL OR "pageCount" >= 0),
  ADD CONSTRAINT "DrawingDocument_name_check" CHECK (length(btrim("name")) >= 2);

ALTER TABLE "DrawingRevision"
  ADD CONSTRAINT "DrawingRevision_fileSize_check" CHECK ("fileSize" >= 0),
  ADD CONSTRAINT "DrawingRevision_checksumSha256_check" CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "DrawingRevision_storageKey_check" CHECK (length(btrim("storageKey")) > 0),
  ADD CONSTRAINT "DrawingRevision_not_self_superseding_check" CHECK ("supersedesId" IS NULL OR "supersedesId" <> "id");

ALTER TABLE "DrawingPage"
  ADD CONSTRAINT "DrawingPage_pageNumber_check" CHECK ("pageNumber" > 0),
  ADD CONSTRAINT "DrawingPage_dimensions_check" CHECK (("widthPoints" IS NULL OR "widthPoints" > 0) AND ("heightPoints" IS NULL OR "heightPoints" > 0)),
  ADD CONSTRAINT "DrawingPage_rotation_check" CHECK ("rotation" IN (0, 90, 180, 270)),
  ADD CONSTRAINT "DrawingPage_location_pair_check" CHECK (("buildingId" IS NULL) = ("floorId" IS NULL));

ALTER TABLE "SpatialCoordinateSystem"
  ADD CONSTRAINT "SpatialCoordinateSystem_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "SpatialCoordinateSystem_pdf_scale_check" CHECK ("unitsPerPdfPoint" IS NULL OR "unitsPerPdfPoint" > 0);

ALTER TABLE "FloorMap"
  ADD CONSTRAINT "FloorMap_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "FloorMap_opacity_check" CHECK ("opacity" >= 0 AND "opacity" <= 1),
  ADD CONSTRAINT "FloorMap_crop_check" CHECK (
    ("cropX" IS NULL AND "cropY" IS NULL AND "cropWidth" IS NULL AND "cropHeight" IS NULL)
    OR ("cropX" IS NOT NULL AND "cropY" IS NOT NULL AND "cropWidth" > 0 AND "cropHeight" > 0)
  ),
  ADD CONSTRAINT "FloorMap_source_page_check" CHECK (
    ("sourceType" = 'PDF_PAGE' AND "drawingPageId" IS NOT NULL)
    OR ("sourceType" <> 'PDF_PAGE' AND "drawingPageId" IS NULL)
  );

CREATE UNIQUE INDEX "FloorMap_active_shared_scope_key"
  ON "FloorMap" ("floorId", "purpose")
  WHERE "isActive" = true AND "scenarioId" IS NULL;

CREATE UNIQUE INDEX "FloorMap_active_scenario_scope_key"
  ON "FloorMap" ("floorId", "scenarioId", "purpose")
  WHERE "isActive" = true AND "scenarioId" IS NOT NULL;

ALTER TABLE "ScaleCalibration"
  ADD CONSTRAINT "ScaleCalibration_distance_check" CHECK ("realDistanceMeters" > 0 AND "calculatedMetersPerPdfPoint" > 0),
  ADD CONSTRAINT "ScaleCalibration_points_check" CHECK ("pointAPdfX" <> "pointBPdfX" OR "pointAPdfY" <> "pointBPdfY");

ALTER TABLE "SpatialZone"
  ADD CONSTRAINT "SpatialZone_geometryVersion_check" CHECK ("geometryVersion" > 0),
  ADD CONSTRAINT "SpatialZone_area_check" CHECK ("areaM2" IS NULL OR "areaM2" >= 0);

ALTER TABLE "BuildingFeature"
  ADD CONSTRAINT "BuildingFeature_geometryVersion_check" CHECK ("geometryVersion" > 0);

ALTER TABLE "DrawingImportJob"
  ADD CONSTRAINT "DrawingImportJob_progress_check" CHECK ("progressPercent" >= 0 AND "progressPercent" <= 100),
  ADD CONSTRAINT "DrawingImportJob_attempts_check" CHECK ("attempts" >= 0);

ALTER TABLE "BuildingModel3D"
  ADD CONSTRAINT "BuildingModel3D_scale_check" CHECK ("scaleToMeters" > 0),
  ADD CONSTRAINT "BuildingModel3D_runtimeFormat_check" CHECK ("runtimeFormat" = 'GLB');

CREATE UNIQUE INDEX "BuildingModel3D_shared_name_key"
  ON "BuildingModel3D" ("buildingId", "name")
  WHERE "scenarioId" IS NULL;

ALTER TABLE "ModelNodeMapping"
  ADD CONSTRAINT "ModelNodeMapping_zone_floor_check" CHECK ("zoneId" IS NULL OR "floorId" IS NOT NULL);

ALTER TABLE "CableRoute"
  ADD CONSTRAINT "CableRoute_device_pair_check" CHECK ("sourceDeviceId" IS NULL OR "targetDeviceId" IS NULL OR "sourceDeviceId" <> "targetDeviceId"),
  ADD CONSTRAINT "CableRoute_lengths_check" CHECK (("totalLengthMeters" IS NULL OR "totalLengthMeters" >= 0) AND ("calculatedLengthMeters" IS NULL OR "calculatedLengthMeters" >= 0)),
  ADD CONSTRAINT "CableRoute_physicalLink_deferred_check" CHECK ("physicalLinkId" IS NULL);

ALTER TABLE "CableRoutePoint"
  ADD CONSTRAINT "CableRoutePoint_sequence_check" CHECK ("sequence" >= 0);

ALTER TABLE "Riser"
  ADD CONSTRAINT "Riser_coordinate_pair_check" CHECK (("xMeters" IS NULL) = ("yMeters" IS NULL));
