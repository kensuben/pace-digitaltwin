# SOP-SC181-002 — Building Spatial Digital Twin & PDF Drawing Import

**System:** PACE Smart Campus 181 Cô Giang  
**Parent document:** SOP-SC181-001 — PACE Smart Campus 181 Network Digital Twin Web App  
**Purpose:** Technical implementation specification for Codex  
**Version:** 1.0  
**Date:** 2026-08-11  

---

## 0. Executive decision

SOP-SC181-001 quản lý **network digital twin** theo graph: Campus → Building → Floor → Zone → Rack → Device → Port → Link.

SOP-SC181-002 bổ sung **spatial digital twin**:

```text
Technical PDF / Architectural Drawing / 3D Asset
                     ↓
               Drawing Import
                     ↓
       Building → Floor → Spatial Map
                     ↓
             Room / Zone / Rack
                     ↓
        Physical Device Placement
                     ↓
 AP / Camera / Switch / Rack / Sensor
                     ↓
        Cable / Fiber / Logical Links
```

Mục tiêu: user có thể upload bản vẽ điện nhẹ PDF hoặc bản vẽ kiến trúc, chọn từng tầng, hiệu chỉnh tỷ lệ, tạo/trace room-zone, sau đó kéo-thả thiết bị của Inventory lên đúng vị trí vật lý của building.

### Kiến trúc bắt buộc

Không đồng nhất 2D PDF và 3D PDF thành một parser.

- **2D drawing PDF:** render và inspect bằng PDF.js ở client, xử lý/extract metadata/vector bằng service backend.
- **3D PDF:** không lấy native Acrobat 3D annotation làm runtime viewer của web app. Nếu PDF có embedded 3D PRC/U3D, ingestion service cố gắng nhận diện/extract; runtime web chuẩn hóa asset về **glTF/GLB**.
- **3D viewer:** Three.js + React Three Fiber, load GLB/glTF.
- **Source PDF luôn được giữ nguyên** để audit và đối chiếu.
- Mọi tọa độ placement lưu trong hệ tọa độ building/floor độc lập với pixel màn hình.

---

# 1. Use cases

## UC-01 — Upload bản vẽ điện nhẹ PDF

User upload:

- ELV drawing
- Network drawing
- CCTV plan
- Wi-Fi plan
- Fire alarm drawing
- Access control drawing
- Cable tray / containment drawing
- Rack room drawing

Hệ thống:

1. Tạo `DrawingDocument`.
2. Đọc số trang, kích thước trang và metadata.
3. Sinh thumbnails.
4. User map page → building/floor.
5. User calibrate tỷ lệ.
6. User trace hoặc xác nhận room/zone.
7. User đặt thiết bị.
8. User tạo cable route hoặc liên kết topology.

---

## UC-02 — Upload architectural floor plan

User upload PDF kiến trúc.

Hệ thống cho phép:

- chọn floor plan;
- hide/show PDF background;
- opacity;
- rotate;
- crop;
- align;
- calibrate bằng 2 điểm;
- tạo room polygons;
- tạo restricted area;
- đặt network rack;
- đặt AP/camera/sensor;
- annotate door/elevator/stair/riser.

---

## UC-03 — Import 3D building

User upload:

- 3D PDF;
- hoặc GLB/glTF do AutoCAD/Revit/BIM workflow export.

Hệ thống:

- lưu source;
- detect asset type;
- convert/extract sang web 3D asset nếu pipeline hỗ trợ;
- user map mesh/group → Floor;
- user đặt device marker theo X/Y/Z;
- chọn floor isolation;
- click thiết bị trong 3D → mở Device Inspector;
- sync placement giữa 2D và 3D.

---

## UC-04 — Device placement

User kéo một `DeviceInstance` từ Inventory vào floor.

Ví dụ:

```text
AP-T03-01
CAM-T03-HALL-01
SW-T03-01
RACK-T03-IDF-01
IOT-T03-TEMP-01
```

Khi đặt:

- DeviceInstance không bị duplicate.
- Tạo `DevicePlacement`.
- X/Y hoặc X/Y/Z gắn với Floor.
- Có rotation, mounting type, elevation.
- Có visual icon theo category.
- Có link về topology.

---

## UC-05 — Cabling

User có thể hiển thị:

- backbone fiber;
- horizontal copper;
- AP cable;
- CCTV cable;
- server room connection;
- riser đường trục.

Một `PhysicalLink` trong SOP-001 có thể có:

- zero cable route: logic-only;
- one cable route;
- nhiều segment route.

---

# 2. Technical feasibility & constraints

## 2.1 2D PDF

PDF.js dùng để:

- render page;
- zoom;
- page navigation;
- thumbnail;
- coordinate conversion;
- overlay canvas/SVG layer.

Backend dùng PyMuPDF cho:

- metadata;
- page size;
- render thumbnail;
- extract text;
- extract vector drawings;
- inspect links/annotations;
- generate canonical previews.

Không giả định mọi PDF kỹ thuật đều vector.

Có ba loại input:

### A. Vector PDF

Có khả năng extract:

- line;
- rectangle;
- bezier;
- text;
- drawing paths.

Có thể hỗ trợ assisted tracing.

### B. Raster/scanned PDF

Chỉ dùng như floor background.

MVP không bắt buộc OCR/CAD reconstruction.

### C. Hybrid PDF

Có cả vector + raster.

Pipeline giữ cả PDF renderer và extracted primitives.

---

## 2.2 Native 3D PDF

3D PDF thường lưu 3D annotation với stream PRC hoặc U3D.

Không dùng native 3D PDF trực tiếp làm runtime building viewer vì:

- browser compatibility không đồng nhất;
- interactive 3D phụ thuộc Acrobat ecosystem;
- Web app cần unified selection, device overlay, floor filter, raycast và camera control;
- topology/spatial app cần format web-native.

### Normalized target

```text
3D PDF / Revit export / CAD export
                ↓
        ingestion / conversion
                ↓
             GLB/glTF
                ↓
       Three.js Web Viewer
```

MVP phải **ưu tiên GLB/glTF import trực tiếp**.

3D PDF import ở phase sau được thiết kế theo best-effort extraction/conversion.

Nếu hệ thống không extract được PRC/U3D:

```text
status = NEEDS_CONVERSION
```

và UI yêu cầu user upload `.glb` / `.gltf` tương ứng.

Không silently fail.

---

# 3. Technology additions

Bổ sung vào stack SOP-001.

## Client

```text
pdfjs-dist
@xyflow/react
three
@react-three/fiber
@react-three/drei
zustand
zod
```

Optional:

```text
konva / react-konva
```

Chỉ thêm Konva nếu annotation editor bằng SVG/HTML overlay trở nên khó quản lý.

MVP ưu tiên:

- PDF canvas background
- SVG overlay layer

để coordinate chính xác và export dễ.

---

## Backend spatial/PDF worker

Khuyến nghị tách worker service:

```text
services/
  pdf-worker/
```

Python:

```text
FastAPI
PyMuPDF
Pillow
```

Optional phase:

```text
OpenCV
Shapely
ezdxf
trimesh
```

Không bắt buộc các package optional trong MVP.

---

## Object storage

Không lưu PDF/GLB binary trong PostgreSQL.

Dùng abstraction:

```ts
interface ObjectStorage {
  put(...)
  getSignedUrl(...)
  delete(...)
}
```

Dev:

```text
local filesystem or MinIO
```

Production:

```text
S3-compatible object storage
```

---

# 4. New domain entities

## 4.1 DrawingDocument

```ts
DrawingDocument {
  id
  campusId
  buildingId
  name
  originalFileName
  mimeType
  fileSize
  checksumSha256

  documentType:
    FLOOR_PLAN
    ELV
    NETWORK
    CCTV
    WIFI
    FIRE_ALARM
    ACCESS_CONTROL
    RISER
    RACK_LAYOUT
    ARCHITECTURAL
    THREE_D_PDF
    OTHER

  storageKey
  status:
    UPLOADED
    PROCESSING
    READY
    NEEDS_MAPPING
    NEEDS_CONVERSION
    FAILED

  pageCount
  metadataJson
  uploadedBy
  createdAt
}
```

---

## 4.2 DrawingPage

```ts
DrawingPage {
  id
  drawingDocumentId
  pageNumber

  widthPoints
  heightPoints
  rotation

  previewStorageKey
  thumbnailStorageKey

  buildingId?
  floorId?

  titleDetected?
  drawingNumber?
  revision?
  scaleText?

  status
}
```

---

## 4.3 FloorMap

Một Floor có thể có nhiều map/revision.

```ts
FloorMap {
  id
  floorId
  scenarioId?

  name
  sourceType:
    PDF_PAGE
    IMAGE
    VECTOR
    GLTF_FLOOR
    MANUAL

  drawingPageId?

  revision
  isActive

  opacity
  rotationDegrees

  coordinateSystemId

  cropX
  cropY
  cropWidth
  cropHeight
}
```

---

## 4.4 SpatialCoordinateSystem

Không lưu device bằng browser pixels.

```ts
SpatialCoordinateSystem {
  id
  floorId

  unit:
    MILLIMETER
    CENTIMETER
    METER

  originX
  originY
  originZ

  axisConvention
  unitsPerPdfPoint

  calibrationStatus
}
```

---

## 4.5 ScaleCalibration

```ts
ScaleCalibration {
  id
  floorMapId

  pointA_PdfX
  pointA_PdfY

  pointB_PdfX
  pointB_PdfY

  realDistanceMeters

  calculatedMetersPerPdfPoint

  createdBy
}
```

Algorithm:

```ts
pdfDistance = sqrt(
  (Bx - Ax)^2 +
  (By - Ay)^2
)

metersPerPdfPoint =
  realDistanceMeters / pdfDistance
```

---

# 5. Coordinate model

Đây là phần critical.

Phải phân biệt 4 coordinate spaces:

```text
PDF Space
   ↓ transform
Floor Local Space
   ↓ transform
Building World Space
   ↓ camera projection
Screen Space
```

## PDF space

Đơn vị PDF point.

Không lưu device placement trực tiếp ở đây.

---

## Floor local space

Canonical unit:

```text
meters
```

Ví dụ:

```text
origin = top-left usable plan
X = East/right
Y = South/down hoặc North/up theo config
Z = elevation
```

Phải ghi rõ axis convention.

---

## Screen space

Chỉ phục vụ render.

Không persist:

```text
screenX
screenY
```

---

# 6. Spatial primitives

## 6.1 SpatialZone

Mở rộng `Zone` của SOP-001.

```ts
SpatialZone {
  id
  zoneId
  floorMapId

  geometryType:
    POLYGON
    RECTANGLE

  geometryGeoJson

  areaM2
  labelX
  labelY
}
```

GeoJSON dùng local coordinates, không phải geographic lat/long.

---

## 6.2 BuildingFeature

```ts
BuildingFeature {
  id
  floorId
  floorMapId

  type:
    WALL
    DOOR
    WINDOW
    STAIR
    ELEVATOR
    RISER
    SHAFT
    CABLE_TRAY
    PATHWAY
    COLUMN
    RESTRICTED_AREA
    OTHER

  geometry
  metadataJson
}
```

---

# 7. DevicePlacement

Bổ sung relation cho `DeviceInstance`.

```ts
DevicePlacement {
  id
  deviceInstanceId
  scenarioId
  floorId
  floorMapId?

  xMeters
  yMeters
  zMeters

  rotationX
  rotationY
  rotationZ

  elevationMeters

  mountingType:
    RACK
    WALL
    CEILING
    DESK
    FLOOR
    POLE
    OUTDOOR
    VIRTUAL

  anchorType:
    POINT
    RACK_U
    SURFACE

  rackId?
  rackUnitStart?

  placementStatus:
    PLANNED
    INSTALLED
    VERIFIED

  notes
}
```

Unique constraint:

```text
(deviceInstanceId, scenarioId)
```

một device chỉ có một placement active trong một scenario.

---

# 8. Equipment placement UX

## Main Floor Map screen

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Campus > VP181 > T03       Scenario: Proposed         [2D] [3D]    │
├──────────────┬──────────────────────────────────────┬───────────────┤
│ Layers       │                                      │ Inspector     │
│              │          FLOOR PLAN                  │               │
│ ☑ Architecture                                     │ AP-T03-01     │
│ ☑ Network    │       [AP]              [CAM]        │ Model         │
│ ☑ CCTV       │                                      │ IP            │
│ ☑ Wi-Fi      │              [RACK]                  │ VLAN          │
│ ☑ Cable      │                                      │ Links         │
│ ☑ Devices    │    [SW]                              │ Coordinates   │
│              │                                      │               │
├──────────────┴──────────────────────────────────────┴───────────────┤
│ Validation: 0 Error | 2 Warning      Selected: AP-T03-01           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Device palette

Không tạo device mới mặc định khi drag.

Palette có 2 tab:

```text
Unplaced Inventory
Catalog
```

### Unplaced Inventory

Kéo ra map → tạo placement.

### Catalog

Kéo ra map → mở dialog:

```text
Create New Device Instance?
Hostname
Model
Asset tag
Management IP
```

Sau submit:

1. tạo DeviceInstance;
2. tạo DevicePlacement.

---

# 9. Floor layers

Mỗi map support layer toggles:

```text
ARCHITECTURE
ROOMS
WALLS
ELECTRICAL
NETWORK
CCTV
WIFI
FIRE_ALARM
ACCESS_CONTROL
CABLE_TRAY
FIBER
COPPER
DEVICES
LABELS
VALIDATION
COVERAGE
```

Layer config:

```ts
FloorLayerConfig {
  id
  floorMapId
  layerType
  visible
  opacity
  zIndex
  locked
}
```

---

# 10. PDF import pipeline

## API

```text
POST /api/drawings/upload
```

Return:

```json
{
  "documentId": "...",
  "status": "PROCESSING"
}
```

Worker pipeline:

```text
UPLOAD
  ↓
checksum
  ↓
virus scan hook
  ↓
PDF preflight
  ↓
metadata
  ↓
page enumeration
  ↓
thumbnail render
  ↓
page preview
  ↓
text extraction
  ↓
vector extraction
  ↓
classification
  ↓
READY
```

---

# 11. PDF page classification

MVP rule-based.

Signals:

- extracted text count;
- vector drawing count;
- raster image coverage;
- page aspect ratio.

Example:

```ts
if vectorCount > VECTOR_THRESHOLD:
  contentType = VECTOR_DOMINANT
else if imageCoverage > 0.8:
  contentType = RASTER_DOMINANT
else:
  contentType = HYBRID
```

Không dùng AI bắt buộc trong MVP.

Phase AI có thể classify:

- floor name;
- drawing title;
- drawing code;
- discipline;
- revision.

---

# 12. Drawing-to-floor mapping

UI:

```text
Uploaded PDF: ELV_181_CoGiang_RevC.pdf

Page 1  Cover            → Ignore
Page 2  Basement B2      → B2
Page 3  Basement B1      → B1
Page 4  Floor 1          → T1
...
Page 14 Floor 11         → T11
Page 15 Riser Diagram    → Building / RISER
```

Support:

- auto suggestion;
- manual mapping;
- one page → one floor;
- one page → multiple map layers only if user explicitly chooses;
- multiple pages → same floor with different disciplines.

---

# 13. Revision handling

Không overwrite source drawings.

```ts
DrawingRevision {
  id
  drawingSeriesKey
  revisionCode
  drawingDocumentId
  issuedAt?
  supersedesId?
}
```

UI:

```text
Rev A
Rev B
Rev C [ACTIVE]
```

Khi đổi active revision:

- placement không mất;
- calibration có thể reuse nếu dimension/page coordinate equivalent;
- nếu transform khác, user cần re-align;
- show drift warning.

---

# 14. 2D drawing editor

## Toolbar

```text
Select
Pan
Measure
Calibrate
Room Polygon
Zone
Rack
Device
Cable Route
Riser
Annotation
Delete
Undo
Redo
```

---

## Measure tool

User click Point A / Point B.

Show:

```text
PDF distance
Real distance
Scale
```

Sau calibration:

```text
Length: 12.42 m
```

---

## Snap modes

```text
NONE
GRID
VECTOR_VERTEX
VECTOR_LINE
ROOM_EDGE
DEVICE
```

MVP:

```text
NONE
GRID
DEVICE
```

Vector snap phase sau.

---

# 15. Assisted vector extraction

PyMuPDF `Page.get_drawings()` output được lưu thành normalized primitives.

```ts
ExtractedVectorPrimitive {
  id
  drawingPageId

  type:
    LINE
    RECT
    CURVE
    QUAD
    PATH

  pointsJson
  bboxJson

  strokeColor?
  fillColor?
  strokeWidth?

  sourceObjectIndex
}
```

Không tự động biến tất cả vector thành walls.

User có thể:

```text
select vector paths
→ Convert to WALL
→ Convert to ROOM BOUNDARY
→ Convert to CABLE TRAY
→ Ignore
```

Phase AI/CV sau mới làm automatic semantic extraction.

---

# 16. 3D asset domain

## BuildingModel3D

```ts
BuildingModel3D {
  id
  buildingId
  scenarioId?

  sourceDrawingDocumentId?

  name

  sourceFormat:
    GLB
    GLTF
    THREE_D_PDF
    OTHER

  runtimeFormat:
    GLB

  sourceStorageKey
  runtimeStorageKey?

  status:
    UPLOADED
    PROCESSING
    READY
    NEEDS_CONVERSION
    FAILED

  scaleToMeters
  originX
  originY
  originZ

  boundingBoxJson
  metadataJson
}
```

---

## ModelNodeMapping

Three.js scene nodes cần map về domain.

```ts
ModelNodeMapping {
  id
  buildingModel3DId

  sceneNodeName
  semanticType:
    BUILDING
    FLOOR
    WALL
    ROOM
    ROOF
    STAIR
    OTHER

  floorId?
  zoneId?
}
```

---

# 17. 3D viewer

React component:

```text
Building3DViewer
```

Subcomponents:

```text
Scene
BuildingModel
FloorVisibilityController
DeviceMarkerLayer
CableRoute3DLayer
SelectionManager
CameraControls
SpatialGrid
MeasurementTool
```

---

## Core interactions

- orbit;
- pan;
- zoom;
- fit building;
- isolate floor;
- explode floors;
- transparency;
- wireframe optional;
- click mesh;
- click device;
- search device → focus camera;
- 2D/3D synchronized selection.

---

# 18. Floor isolation

Scene graph phải support:

```text
VP181
  B2
  B1
  T01
  T02
  ...
  T11
```

Nếu GLB không có semantic groups:

User mở **3D Mapping Wizard**:

```text
Select Meshes → Assign Floor T03
```

Lưu `ModelNodeMapping`.

---

# 19. Exploded building view

Feature:

```text
B2
 ↑
B1
 ↑
T01
 ↑
T02
 ↑
...
```

Algorithm:

```ts
displayY =
  originalY +
  floorIndex * explodeDistance
```

Không thay world coordinates persisted.

Chỉ transform presentation group.

---

# 20. 2D ↔ 3D synchronization

Một placement sử dụng building local coordinates.

2D:

```text
(x, y)
```

3D:

```text
(x, elevation, y)
```

Mapping convention example:

```ts
threeX = xMeters
threeY = floorElevationMeters + zMeters
threeZ = yMeters
```

Phải encapsulate trong:

```text
SpatialTransformService
```

Không scatter transform formulas trong React components.

---

# 21. Floor elevation

Bổ sung `Floor`:

```ts
Floor {
  ...
  elevationMeters
  floorToFloorHeightMeters?
}
```

Ví dụ chỉ seed khi đã xác nhận.

Không invent building heights.

---

# 22. Device visualization 3D

MVP không cần accurate 3D model của từng thiết bị.

Dùng icon/billboard hoặc primitive.

Examples:

```text
AP       → ceiling disc marker
Camera   → camera marker
Switch   → rack marker
Firewall → rack marker
NAS      → rack marker
Sensor   → small cube
```

User click marker:

```text
Device Inspector
Model
Status
Floor
Zone
Rack
Management IP
Ports
Links
VLAN
Validation
```

Phase sau mới hỗ trợ vendor 3D assets.

---

# 23. Rack spatial model

Rack là both logical + physical.

```ts
RackPlacement {
  rackId
  floorId

  xMeters
  yMeters
  zMeters

  widthMeters
  depthMeters
  heightMeters

  rotationDegrees
}
```

Device trong rack vẫn dùng:

```text
rackUnitStart
rackUnits
```

3D viewer có thể render simple rack tower.

---

# 24. CableRoute

Bổ sung physical routing.

```ts
CableRoute {
  id
  scenarioId
  physicalLinkId?

  routeType:
    COPPER
    FIBER
    DAC
    AOC
    POWER
    OTHER

  sourceDeviceId?
  targetDeviceId?

  totalLengthMeters
  calculatedLengthMeters

  status:
    PLANNED
    INSTALLED
    VERIFIED
}
```

---

## CableRoutePoint

```ts
CableRoutePoint {
  id
  cableRouteId
  sequence

  floorId

  xMeters
  yMeters
  zMeters

  featureId?
}
```

---

# 25. Multi-floor cable route

Fiber backbone:

```text
B2 Core Rack
   ↓
Vertical Riser
   ↓
T03 IDF
```

Route có thể đi qua nhiều floor.

Mỗi segment:

```ts
CableRouteSegment {
  id
  cableRouteId
  sequence

  fromFloorId
  toFloorId

  geometryJson
  riserId?
}
```

---

# 26. Riser model

```ts
Riser {
  id
  buildingId
  code
  name

  type:
    DATA
    POWER
    FIRE
    HVAC
    MIXED

  xMeters
  yMeters
}
```

Map có vertical riser indicator.

---

# 27. Link topology ↔ cable map

SOP-001:

```text
PhysicalLink
CORE-01 Te1/0/1
   ↕
SW-T03-01 Ten1/1
```

SOP-002:

```text
PhysicalLink
   ↓
CableRoute
   ↓
B2 rack
   ↓
Cable Tray
   ↓
Riser R-01
   ↓
T03 IDF
```

UI Device inspector có:

```text
Logical
Physical
Spatial Route
```

---

# 28. Wi-Fi planning layer

MVP:

- placement only;
- manually configured coverage radius;
- coverage circle.

```ts
WirelessCoverageConfig {
  devicePlacementId

  band:
    2_4_GHZ
    5_GHZ
    6_GHZ

  txPowerDbm?
  estimatedRadiusMeters

  confidence:
    MANUAL
    ESTIMATED
    SURVEY
}
```

Không gọi đây là RF simulation chính xác.

Phase sau:

- wall attenuation;
- AP power;
- floor material;
- predictive heatmap.

---

# 29. CCTV field-of-view

```ts
CameraCoverageConfig {
  devicePlacementId

  headingDegrees
  tiltDegrees

  horizontalFovDegrees
  verticalFovDegrees

  maxDistanceMeters
}
```

2D:

```text
sector / cone
```

3D:

```text
view frustum
```

User rotate camera marker → FOV cập nhật.

---

# 30. Sensor / IoT coverage

Optional:

- leak sensor cable;
- occupancy sensor radius;
- environmental sensor zone.

Không implement complex physics trong MVP.

---

# 31. Spatial validation rules

Thêm vào Validation Engine SOP-001.

```text
SPATIAL-001 Device has no placement
SPATIAL-002 Device placement outside floor boundary
SPATIAL-003 Device assigned to wrong floor/map
SPATIAL-004 Duplicate placement
SPATIAL-005 Rack device has no rack placement
SPATIAL-006 Rack U position exceeds rack capacity
SPATIAL-007 Cable route endpoint mismatch
SPATIAL-008 Cable route not connected to source/target device
SPATIAL-009 Floor map not calibrated
SPATIAL-010 Active floor map revision changed after placement
SPATIAL-011 3D model has unmapped floor nodes
SPATIAL-012 2D/3D transform unavailable
SPATIAL-013 Camera FOV outside configured range
SPATIAL-014 AP coverage config missing for coverage view
SPATIAL-015 Cross-floor cable has no riser/pathway
```

---

# 32. Import job architecture

Không xử lý PDF lớn synchronous trong HTTP request.

```text
Next.js
  ↓
create DrawingImportJob
  ↓
Job Queue
  ↓
PDF Worker
  ↓
Object Storage
  ↓
PostgreSQL status
```

MVP nếu chưa Redis:

```text
database-backed job table
```

Phase 2:

```text
Redis + BullMQ
```

---

## DrawingImportJob

```ts
DrawingImportJob {
  id
  drawingDocumentId

  type:
    PDF_INSPECT
    PDF_RENDER
    PDF_EXTRACT
    THREE_D_EXTRACT
    GLB_PROCESS

  status:
    QUEUED
    RUNNING
    SUCCEEDED
    FAILED

  progressPercent
  currentStep

  errorCode?
  errorMessage?

  startedAt?
  completedAt?
}
```

---

# 33. Processing safety

Upload:

- max file size configurable;
- allowed MIME whitelist;
- checksum;
- filename normalization;
- no executable processing from PDF JS;
- sandbox worker;
- timeout;
- memory limit.

3D:

- GLTF/GLB resource limits;
- texture dimension limits;
- triangle count warning;
- reject external URI loading by default;
- package assets locally.

---

# 34. API additions

## Drawing

```text
POST   /api/drawings
POST   /api/drawings/:id/upload
GET    /api/drawings
GET    /api/drawings/:id
DELETE /api/drawings/:id

GET    /api/drawings/:id/pages
POST   /api/drawing-pages/:id/map-floor
POST   /api/drawing-pages/:id/extract
```

---

## Floor map

```text
GET    /api/floors/:id/maps
POST   /api/floors/:id/maps
PATCH  /api/floor-maps/:id

POST   /api/floor-maps/:id/calibrate
POST   /api/floor-maps/:id/activate
```

---

## Spatial

```text
GET    /api/floors/:id/spatial
POST   /api/device-placements
PATCH  /api/device-placements/:id
DELETE /api/device-placements/:id

POST   /api/spatial-zones
PATCH  /api/spatial-zones/:id
```

---

## 3D

```text
POST   /api/building-models
GET    /api/building-models/:id
POST   /api/building-models/:id/process
POST   /api/building-models/:id/node-mappings
```

---

## Cable

```text
POST   /api/cable-routes
PATCH  /api/cable-routes/:id
DELETE /api/cable-routes/:id
```

---

# 35. UI routes

Add:

```text
/buildings
/buildings/[buildingId]
/buildings/[buildingId]/3d

/floors/[floorId]/map
/floors/[floorId]/drawings

/drawings
/drawings/[drawingId]
/drawings/[drawingId]/mapping

/spatial-validation
```

---

# 36. Building dashboard

Building page:

```text
PACE Smart Campus 181
────────────────────────────────

Floors        13
Devices       xxx
Placed        xxx
Unplaced      xx
Drawings      xx
Map Revision  Rev C

[Open 3D Building]

B2  [Map] [Devices] [Warnings]
B1  [Map] [Devices] [Warnings]
T1  [Map] [Devices] [Warnings]
...
T11 [Map] [Devices] [Warnings]
```

---

# 37. 2D floor-map acceptance criteria

User phải làm được:

1. Upload PDF.
2. Xem thumbnails.
3. Map PDF page → T03.
4. Open T03 floor map.
5. Calibrate tỷ lệ bằng two-point distance.
6. Pan/zoom.
7. Change PDF opacity.
8. Place AP.
9. Place camera.
10. Place rack/switch.
11. Move/rotate device.
12. Save.
13. Refresh browser → placement giữ nguyên.
14. Click device → open Device Inspector.
15. Navigate từ device → network topology.
16. Navigate từ topology → locate device trên floor map.

---

# 38. 3D acceptance criteria

1. Upload GLB.
2. Render building.
3. Orbit/pan/zoom.
4. Assign model nodes to floor.
5. Isolate T03.
6. Show T03 devices.
7. Click AP marker.
8. Inspector opens.
9. Search `AP-T03-01`.
10. Camera focuses marker.
11. Toggle exploded floor mode.
12. Placement coordinates consistent với 2D.

---

# 39. PDF import acceptance criteria

Vector PDF:

- page count đúng;
- page preview đúng;
- vector count > 0 khi document thực sự có line art;
- no coordinate inversion after display transform.

Raster PDF:

- preview vẫn hoạt động;
- calibration hoạt động;
- placement hoạt động;
- extraction failure không block workflow.

Large PDF:

- background processing;
- progress state;
- retry job;
- no request timeout dependency.

---

# 40. Data consistency rules

Không xóa FloorMap nếu có placements trừ khi:

```text
forceDelete=true
```

và admin explicit confirm.

Nếu DrawingDocument bị delete:

- source asset deleted;
- FloorMap reference phải được xử lý;
- placement canonical coordinates không bị mất.

Device placement không phụ thuộc trực tiếp vào source PDF pixel coordinates.

Đây là lý do bắt buộc canonical floor coordinates.

---

# 41. Version control / audit

Audit:

```text
DRAWING_UPLOADED
DRAWING_MAPPED_TO_FLOOR
FLOOR_MAP_CALIBRATED
FLOOR_MAP_ACTIVATED
DEVICE_PLACED
DEVICE_MOVED
DEVICE_ROTATED
DEVICE_REMOVED_FROM_MAP
CABLE_ROUTE_CREATED
MODEL_3D_UPLOADED
MODEL_NODE_MAPPED
```

---

# 42. Codebase structure additions

```text
src/
  app/
    buildings/
    floors/
    drawings/

  components/
    spatial/
      FloorMapViewer.tsx
      PdfFloorLayer.tsx
      SvgSpatialOverlay.tsx
      DeviceMarker2D.tsx
      CableRouteLayer.tsx
      CalibrationTool.tsx
      MeasureTool.tsx
      LayerPanel.tsx

    building3d/
      Building3DViewer.tsx
      BuildingModel.tsx
      DeviceMarker3D.tsx
      FloorIsolation.tsx
      ExplodedFloorView.tsx
      ModelNodeMapper.tsx

  domain/
    drawing/
    spatial/
    cable/
    building3d/

  lib/
    spatial/
      transforms.ts
      calibration.ts
      geometry.ts
      coordinateMapping.ts

  server/
    services/
      drawingService.ts
      floorMapService.ts
      spatialPlacementService.ts
      buildingModelService.ts
      cableRouteService.ts

services/
  pdf-worker/
    app/
      main.py
      inspect_pdf.py
      render_pages.py
      extract_vectors.py
      extract_text.py
      detect_3d.py
      jobs.py
```

---

# 43. Service boundaries

## DrawingService

Không xử lý binary.

Chịu trách nhiệm:

- metadata records;
- storage references;
- job creation;
- mapping.

---

## PdfWorker

Chịu trách nhiệm:

- read PDF;
- render;
- extract;
- preflight;
- detect 3D annotation;
- write processed outputs.

---

## SpatialPlacementService

Chịu trách nhiệm:

- coordinate validation;
- placement CRUD;
- floor-boundary validation;
- audit.

---

## SpatialTransformService

Pure functions.

Không DB.

Unit test bắt buộc.

---

# 44. 3D PDF detection

Worker inspect annotation/object structures.

Khi detect:

```text
Subtype /3D
```

ghi:

```json
{
  "has3D": true,
  "embeddedFormat": "PRC|U3D|UNKNOWN"
}
```

Không bắt buộc phase đầu phải decode PRC/U3D.

Pipeline:

```text
3D PDF detected
     ↓
Can Extract/Convert?
   ↙        ↘
 YES        NO
 ↓           ↓
GLB    NEEDS_CONVERSION
```

---

# 45. 3D import priority

Codex phải implement theo thứ tự:

### P0

```text
GLB
```

### P1

```text
glTF
```

### P2

```text
3D PDF detection
```

### P3

```text
3D PDF embedded asset extraction / external converter integration
```

Không đảo thứ tự.

---

# 46. Do not build

MVP không build:

- full BIM authoring;
- IFC editor;
- DWG editor;
- Revit plugin;
- photorealistic rendering;
- exact RF propagation;
- full ray-traced camera analysis;
- automatic electrical engineering design;
- automatic wall recognition guaranteed;
- browser-native Acrobat 3D engine clone.

---

# 47. Phase implementation plan

## Phase SP-0 — Schema & storage

Deliver:

- Prisma entities;
- object storage abstraction;
- DrawingDocument CRUD;
- migration;
- seed.

---

## Phase SP-1 — 2D PDF ingestion

Deliver:

- upload;
- processing job;
- worker;
- thumbnails;
- page list;
- page preview;
- floor mapping.

---

## Phase SP-2 — Floor map editor

Deliver:

- PDF background;
- zoom/pan;
- calibration;
- device markers;
- placement persistence;
- layers.

---

## Phase SP-3 — Spatial zones & cable routes

Deliver:

- polygons;
- rack;
- room/zone;
- cable routes;
- risers;
- measurement.

---

## Phase SP-4 — 3D GLB viewer

Deliver:

- Three.js/R3F;
- GLB import;
- scene node list;
- floor mapping;
- floor isolation;
- device markers;
- selection sync.

---

## Phase SP-5 — 2D/3D synchronization

Deliver:

- canonical transforms;
- device focus;
- placement sync;
- exploded building.

---

## Phase SP-6 — Advanced PDF

Deliver:

- vector primitives;
- assisted semantic conversion;
- revision compare;
- 3D PDF detect;
- converter adapter.

---

# 48. Codex rule: one phase at a time

Codex không được implement SP-0 → SP-6 trong một pass.

Mỗi phase:

1. Read SOP-SC181-001.
2. Read SOP-SC181-002.
3. Check current codebase.
4. Create ADR if architecture changes.
5. Update Prisma.
6. Write tests.
7. Implement.
8. Run:
   - lint
   - typecheck
   - unit test
   - integration test
   - build
9. Update `CHANGELOG_DEV.md`.
10. Stop.

---

# 49. Testing requirements

## Unit tests

```text
calibration.test.ts
coordinateMapping.test.ts
spatialTransform.test.ts
placementValidation.test.ts
cableRouteLength.test.ts
```

---

## Integration

- upload PDF;
- worker output;
- floor mapping;
- placement transaction;
- delete drawing retains canonical placement;
- GLB metadata creation.

---

## E2E

Scenario:

```text
Upload floor plan
→ map to T03
→ calibrate
→ place AP
→ place camera
→ move AP
→ refresh
→ locate AP from Inventory
→ open topology
→ return to map
```

3D:

```text
Upload GLB
→ map floor mesh T03
→ isolate floor
→ locate AP
→ click AP
→ open inspector
```

---

# 50. Performance targets

2D:

- floor map interactive at 60 fps target on desktop;
- overlays virtualized where appropriate;
- no re-render whole PDF when moving marker;
- PDF canvas and SVG overlay separate.

3D:

- warn at configurable triangle threshold;
- GLB Draco optional;
- lazy-load model;
- dispose Three.js resources;
- texture max-size policy.

---

# 51. Offline/demo mode

Demo mode phải chạy không cần kết nối production network.

Seed:

```text
PACE Smart Campus 181
B2 / B1 / T1 ... T11
```

Có sample blank floor maps nếu chưa upload actual drawing.

Không ship copyrighted/proprietary customer drawing trong public repo.

---

# 52. Security

PDF upload là untrusted input.

Worker:

- isolated process/container;
- read-only input;
- restricted output dir;
- no network by default;
- CPU/memory/time limit.

3D:

- disable external URLs;
- sanitize glTF;
- no execution from imported asset;
- verify content size.

---

# 53. Backup/export

Export scenario:

```text
scenario.json
inventory.json
placements.json
zones.geojson
cable-routes.geojson
drawing-manifest.json
```

Không bắt buộc export source PDFs trong default bundle.

Optional:

```text
includeAssets=true
```

---

# 54. Future extension: BIM / IFC

Không implement hiện tại nhưng schema phải không chặn.

Future:

```text
IFC
Revit
BIM element ID
Room GUID
MEP element
Cable tray
Equipment family
```

Potential entity:

```ts
ExternalModelReference {
  entityType
  entityId
  sourceSystem
  externalId
}
```

---

# 55. Future extension: AI drawing assistant

Chỉ phase sau.

Potential actions:

```text
Detect floor name
Detect room labels
Detect rack room
Detect AP symbol
Detect CCTV symbol
Detect cable tray
Suggest wall polygons
Suggest room boundaries
```

Mọi AI suggestion:

```text
status = SUGGESTED
```

User phải approve trước khi thành canonical spatial object.

---

# 56. Architecture summary

```text
                             ┌─────────────────────────────┐
                             │       Next.js Web App       │
                             │                             │
                             │ Inventory / Topology        │
                             │ Floor Map / 3D Building     │
                             └─────────────┬───────────────┘
                                           │
                   ┌───────────────────────┼──────────────────────┐
                   │                       │                      │
                   ▼                       ▼                      ▼
            PostgreSQL              Object Storage        Import Job Queue
                   │                       │                      │
                   │                       │                      ▼
                   │                       │               PDF / Asset Worker
                   │                       │                 PyMuPDF
                   │                       │                 processors
                   │                       │
                   └──────────────┬────────┘
                                  │
                         canonical domain data
                                  │
        ┌─────────────────────────┴────────────────────────┐
        ▼                                                  ▼
  2D Floor Viewer                                     3D Viewer
 PDF.js + SVG Overlay                              Three.js / R3F
        │                                                  │
        └──────────────── DevicePlacement ─────────────────┘
```

---

# 57. Codex prompt — SP-0

Use this prompt first:

```text
Read docs/SOP-SC181-001.md and docs/SOP-SC181-002.md completely.

Implement Phase SP-0 only: schema and storage foundation for Building Spatial Digital Twin.

Add Prisma models for:
DrawingDocument,
DrawingPage,
FloorMap,
SpatialCoordinateSystem,
ScaleCalibration,
DevicePlacement,
SpatialZone,
BuildingFeature,
DrawingImportJob,
BuildingModel3D,
ModelNodeMapping,
CableRoute,
CableRoutePoint,
Riser.

Integrate them with the existing Campus, Building, Floor, Zone, Rack, DeviceInstance, Scenario and PhysicalLink models.

Requirements:
- Device placement uses canonical meter-based floor coordinates.
- Do not store binary PDF/GLB in PostgreSQL.
- Create ObjectStorage interface with local filesystem implementation for development.
- Add Zod DTO schemas.
- Add domain/service/repository boundaries consistent with SOP-SC181-001.
- Add migrations and seed data for VP181 B2/B1/T1-T11.
- Do not invent floor elevations or dimensions.
- Write unit tests for coordinate/calibration pure functions.
- Run lint, typecheck, tests and build.
- Update CHANGELOG_DEV.md.
- Do not implement PDF rendering or UI yet.
Stop after SP-0.
```

---

# 58. Codex prompt — SP-1

Run only after SP-0 passes.

```text
Implement Phase SP-1 only from SOP-SC181-002.

Goal:
Upload and inspect technical PDF drawings, process them asynchronously, render thumbnails/previews and allow page-to-floor mapping.

Implement:
1. Drawing upload UI.
2. DrawingDocument records.
3. DB-backed DrawingImportJob queue.
4. Python FastAPI pdf-worker using PyMuPDF.
5. PDF page count and metadata extraction.
6. Page preview and thumbnail rendering.
7. Text and vector-drawing count extraction.
8. DrawingPage records.
9. Page classification VECTOR_DOMINANT / RASTER_DOMINANT / HYBRID.
10. UI mapping drawing page to B2/B1/T1-T11.
11. Job progress and error state.

Do not implement room recognition.
Do not implement OCR.
Do not implement 3D PDF conversion.
Do not place devices yet.

Security:
Treat PDFs as untrusted files.
Worker must not execute PDF JavaScript.
No external network access from worker.
Apply file-size and processing timeout limits.

Tests:
PDF with vector page.
PDF with raster page.
Multi-page document.
Failed/corrupt PDF.
Page-to-floor mapping.

Run lint, typecheck, tests and build.
Update CHANGELOG_DEV.md.
Stop after SP-1.
```

---

# 59. Codex prompt — SP-2

```text
Implement Phase SP-2 only from SOP-SC181-002.

Build the interactive 2D Floor Map editor.

Use:
- PDF.js/pdfjs-dist for PDF floor background rendering.
- SVG overlay layer for devices, calibration and annotations.
- canonical floor coordinates in meters.

Features:
- zoom/pan;
- floor/page selector;
- PDF opacity;
- two-point calibration;
- distance measurement;
- unplaced inventory palette;
- drag/drop DeviceInstance onto floor;
- move/rotate DevicePlacement;
- save/reload placement;
- selected device inspector;
- layer panel;
- link from Inventory -> Locate on Map;
- link Map -> Open Network Topology.

Do not persist screen pixels.
Implement a SpatialTransformService converting:
PDF point <-> floor meter <-> screen coordinate.

Add tests for transforms at multiple zoom, pan and rotation states.
Stop after SP-2.
```

---

# 60. Codex prompt — SP-4 3D viewer

```text
Implement Phase SP-4 only from SOP-SC181-002.

Goal:
Add web-native 3D Building Digital Twin using GLB/glTF.

Use:
- three
- @react-three/fiber
- @react-three/drei
- GLTFLoader

Implement:
- GLB upload and storage;
- model metadata;
- 3D building viewer;
- orbit/pan/zoom;
- model tree;
- user maps model nodes/groups to Floor records;
- floor isolate/show/hide;
- basic exploded floor view;
- DevicePlacement markers;
- click marker -> Device Inspector;
- search device -> focus camera;
- 2D canonical coordinate to Three.js coordinate transform.

Do not implement PRC/U3D decoding.
Do not implement BIM/IFC.
Do not build photorealistic vendor models for network devices.

Warn on excessive triangle count and texture sizes.
Dispose Three.js resources correctly.

Add e2e test:
open building -> isolate T03 -> locate device -> click marker.

Run lint, typecheck, tests and build.
Update CHANGELOG_DEV.md.
Stop after SP-4.
```

---

# 61. Codex prompt — Advanced 3D PDF adapter

Only implement after the GLB pipeline is stable.

```text
Implement the 3D PDF adapter from SOP-SC181-002.

Scope:
- Detect /3D annotations in uploaded PDFs.
- Inspect the 3D stream subtype.
- Classify embedded content as PRC, U3D or UNKNOWN.
- Save detection metadata.
- Add a pluggable ThreeDConversionProvider interface.
- If no conversion provider is configured, mark the document NEEDS_CONVERSION and instruct the user to upload GLB/glTF.
- Do not pretend the browser can render the native 3D PDF.
- Never silently rasterize a 3D building and call it a 3D model.

The runtime output contract is GLB/glTF only.
Stop after adapter/detection is complete.
```

---

# 62. Definition of Done

SOP-SC181-002 đạt MVP DONE khi:

- Technical PDF upload works.
- PDF pages map to PACE floors.
- Floor plan can be calibrated.
- DeviceInstance can be placed on a floor.
- Placement persists in meters.
- User can navigate Inventory ↔ Map ↔ Network Topology.
- Rooms/zones can be manually drawn.
- Rack can be positioned.
- Cable routes can be drawn.
- Multi-floor route can use riser.
- GLB building can be rendered.
- GLB model groups can map to floors.
- A floor can be isolated.
- Device markers render in 3D.
- 2D and 3D select the same DeviceInstance.
- Validation rules work.
- Drawing revision history is preserved.
- No direct dependency on native browser 3D PDF support.

---

# 63. Official technical references

Use official/primary references when implementing or updating dependencies:

1. Mozilla PDF.js documentation  
   https://mozilla.github.io/pdf.js/

2. PyMuPDF documentation — vector extraction and PDF rendering  
   https://pymupdf.readthedocs.io/

3. Adobe Acrobat SDK — Working with 3D Annotations  
   https://opensource.adobe.com/dc-acrobat-sdk-docs/library/plugin/Plugins_3D_samples.html

4. Adobe Acrobat SDK — JS 3D API  
   https://opensource.adobe.com/dc-acrobat-sdk-docs/library/js3dapi/index.html

5. Three.js GLTFLoader  
   https://threejs.org/docs/pages/GLTFLoader.html

---

# 64. Critical implementation rules

Codex MUST NOT:

1. Persist screen coordinates as building coordinates.
2. Tie DeviceInstance lifecycle to one PDF revision.
3. Delete placements when a drawing revision changes.
4. Assume every technical PDF is vector.
5. Assume every architectural PDF is to-scale.
6. Automatically trust detected scale text.
7. Render 3D PDF poster image and label it as interactive 3D.
8. Mix React Flow topology coordinates with building spatial coordinates.
9. Put imported binary files in PostgreSQL.
10. Make external network calls while processing untrusted PDF files.
11. Hardcode PACE building dimensions that have not been confirmed.
12. Implement an AI/CV auto-detection pipeline before the manual workflow works correctly.

The system source of truth remains:

```text
Network domain:
DeviceInstance + Port + PhysicalLink + VLAN + LAG

Spatial domain:
Floor + canonical coordinate system + DevicePlacement + geometry

Drawing:
reference/background/evidence

3D:
visualization/runtime asset
```

This separation is mandatory.
