# SOP-SC181-001 — PACE Smart Campus 181 Network Digital Twin Web App

**Technical Implementation Specification for Codex**  
**Version 1.0 — 11 Aug 2026**

## 1. Mục tiêu và phạm vi

Tài liệu này định nghĩa kiến trúc, data model, UI/UX, API, business rules, seed data và acceptance criteria để Codex triển khai một web app mô phỏng quản lý thiết bị và cấu trúc vận hành mạng của PACE Smart Campus 181 Cô Giang.

Mục tiêu MVP:
- Hiển thị digital twin logic của hạ tầng mạng theo Building > Floor > Zone > Rack > Device > Port > Link.
- Quản lý catalog thiết bị chuẩn theo hãng/model và cho phép thay đổi model thiết bị mà không phải vẽ lại topology.
- Mô phỏng Firewall, Core, Distribution/Access Switch, Server, NAS, Wi-Fi AP, Camera/NVR, UPS, ISP/WAN và các endpoint quan trọng.
- Biểu diễn VLAN, subnet, trunk/access, LAG/LACP, uplink, HA/stack/MLAG và logical services.
- Tự động kiểm tra compatibility khi user thay model thiết bị.
- Cho phép Scenario/What-if: Baseline, Proposed, Alternative A/B, Failure Simulation.
- Có Dashboard, Topology, Inventory, Device Catalog, VLAN/IP Plan, Link/LAG Matrix, Scenario Compare, Alerts/Validation.
- Demo data bám sát PACE Smart Campus 181 hiện có nhưng cấu trúc phải đủ generic để tái sử dụng.

Ngoài phạm vi MVP:
- Không cấu hình trực tiếp production devices.
- Không thay thế NMS/SIEM.
- Không cần SNMP polling realtime ở phase đầu.
- Không cần CMDB enterprise đầy đủ; chỉ chuẩn bị schema để mở rộng.

## 2. Nguyên tắc kiến trúc cốt lõi

2.1 Tách “Catalog Model” khỏi “Installed Device Instance”
- DeviceModel: mô tả model chuẩn (FortiGate 200G, Sophos XGS3100, C9300X-24Y, M4350-24F4V, CRS518...).
- DeviceInstance: thiết bị logic/installed tại campus (CORE-01, FW-01, SW-T03-01...).
- DeviceInstance chỉ tham chiếu modelId. Khi đổi modelId, identity, vị trí và các quan hệ topology được giữ nguyên.

2.2 Topology là graph độc lập
- Node = DeviceInstance hoặc logical node (ISP, Internet, VLAN/Service).
- Edge = PhysicalLink hoặc LogicalLink.
- React Flow chỉ là view/editor; database mới là source of truth.

2.3 Port-first modeling
- Mọi physical connection phải gắn sourcePortId và targetPortId.
- Không cho phép link “device-to-device” mơ hồ trong data layer.
- LAG là logical group của nhiều Port membership.
- VLAN assignment áp trên Port/LAG/Interface logical.

2.4 Validation thay vì silent mutation
Khi user thay model thiết bị, hệ thống không tự xóa link. Hệ thống chạy validation và trả:
- ERROR: cấu hình không thể tồn tại.
- WARNING: vẫn chạy nhưng giảm năng lực/redundancy.
- INFO: thay đổi không ảnh hưởng.
User quyết định sửa topology hoặc rollback model.

2.5 Scenario immutable snapshot
Baseline không bị chỉnh trực tiếp. Mỗi phương án thiết kế tạo Scenario riêng; dữ liệu topology được clone/reference theo version để compare.

## 3. Stack kỹ thuật đề xuất

Frontend / Full-stack:
- Next.js 16 + TypeScript + App Router.
- React Server Components cho read-heavy pages; Client Components cho topology editor.
- React Flow (@xyflow/react) cho graph editor, custom device nodes, ports/handles, selection, drag/drop, edges.
- Tailwind CSS + shadcn/ui cho design system.
- Lucide icons.
- Zustand cho UI/editor state ngắn hạn; server state lấy từ API/Server Actions.

Backend:
- Next.js Route Handlers cho API MVP.
- Service layer riêng trong src/server/services để tránh nhồi business logic vào route.
- Zod validation cho DTO.
- PostgreSQL.
- Prisma ORM 7 cho schema/migration/type-safe queries.

Infra:
- Docker Compose: app + postgres.
- Optional Redis ở phase 2 cho queue/cache.
- Auth: Auth.js/Entra ID OIDC ở phase 2; MVP có local admin/demo user.
- Deployment target: Ubuntu Server + Docker; reverse proxy Nginx/Traefik.
- Testing: Vitest + React Testing Library + Playwright.
- Lint/format: ESLint + Prettier.

## 4. Kiến trúc module ứng dụng

Route tree đề xuất:

/dashboard
/topology
/topology/[scenarioId]
/inventory
/inventory/[deviceId]
/catalog
/catalog/[modelId]
/vlans
/ip-plan
/lags
/links
/scenarios
/scenarios/compare
/validation
/settings

Domain modules:
1. Campus & Location
2. Device Catalog
3. Inventory / Device Instance
4. Ports & Interfaces
5. Physical Links
6. LAG/LACP & Stack/MLAG/HA
7. VLAN/Subnet/IP Plan
8. Topology Graph
9. Scenarios & Versioning
10. Validation Engine
11. Capacity & Risk Scoring
12. Import/Export
13. Audit Log

## 5. Data model chi tiết

Các entity bắt buộc:

Campus
- id, code, name, address, description

Building
- id, campusId, code, name

Floor
- id, buildingId, code, level, name

Zone
- id, floorId, code, name, type

Rack
- id, zoneId, code, name, rackUnits

Vendor
- id, code, name, website

DeviceCategory
- FIREWALL, CORE_SWITCH, DISTRIBUTION_SWITCH, ACCESS_SWITCH, SERVER, NAS, NVR, AP, CAMERA, UPS, ISP_CPE, OTHER

DeviceModel
- id, vendorId, category
- sku, modelName
- formFactor, rackUnits
- switchingCapacityGbps
- forwardingMpps
- firewallGbps, ipsGbps, ngfwGbps, tlsInspectionGbps
- maxVlans, maxLagGroups, maxLagMembers
- supportsLacp, supportsMlag, supportsStacking, supportsHa
- stackBandwidthGbps
- managementOs
- metadataJson

PortProfile
- id, modelId, portGroup, count
- media: RJ45/SFP/SFP+/SFP28/QSFP28
- supportedSpeedsMbps[]
- poeStandard
- roleHint
- breakoutCapable

DeviceInstance
- id, scenarioId, assetTag, hostname, displayName
- modelId
- serialNumber, managementIp
- status
- buildingId/floorId/zoneId/rackId
- rackUnitStart
- notes
- graphX, graphY

Port
- id, deviceInstanceId
- name, index
- media
- supportedSpeedsMbps[]
- negotiatedSpeedMbps
- adminStatus, operationalStatus
- description
- parentBreakoutPortId nullable

PhysicalLink
- id, scenarioId
- sourcePortId, targetPortId
- linkType: ETHERNET/FIBER/DAC/AOC
- speedMbps
- duplex
- status
- cableLabel
- lengthMeters

LagGroup
- id, scenarioId
- deviceInstanceId
- name
- protocol: STATIC/LACP
- mode: ACTIVE/PASSIVE/ON
- minLinks
- logicalSpeedPolicy

LagMember
- lagGroupId, portId

Vlan
- id, scenarioId
- vlanId, name, purpose
- colorKey
- subnetId nullable

Subnet
- id, scenarioId
- cidr, gateway, dhcpStart, dhcpEnd
- dnsServers[]
- vrf

PortVlanMembership
- portId or lagGroupId
- mode: ACCESS/TRUNK/HYBRID
- nativeVlanId nullable
- allowedVlanIds[]

RedundancyGroup
- id, scenarioId
- type: FIREWALL_HA/STACK/MLAG/VRRP/OTHER
- name
- memberDeviceIds[]
- peerLinkLagIds[]

Scenario
- id, name, type: BASELINE/PROPOSED/ALTERNATIVE/FAILURE
- parentScenarioId
- isLocked
- createdBy, createdAt

ValidationFinding
- id, scenarioId
- severity
- ruleCode
- entityType/entityId
- message
- remediation
- metadataJson

AuditLog
- id, actorId, action, entityType, entityId, beforeJson, afterJson, timestamp

## 6. Prisma schema skeleton

Codex phải triển khai schema đầy đủ từ data model trên. Skeleton tối thiểu:

```prisma
model DeviceModel {
  id                     String   @id @default(cuid())
  vendorId               String
  category               DeviceCategory
  sku                    String   @unique
  modelName              String
  switchingCapacityGbps  Float?
  forwardingMpps         Float?
  firewallGbps           Float?
  ipsGbps                Float?
  ngfwGbps               Float?
  tlsInspectionGbps      Float?
  maxLagGroups           Int?
  maxLagMembers          Int?
  supportsLacp           Boolean  @default(false)
  supportsMlag           Boolean  @default(false)
  supportsStacking       Boolean  @default(false)
  supportsHa             Boolean  @default(false)
  stackBandwidthGbps     Float?
  metadataJson           Json?
  vendor                 Vendor   @relation(fields: [vendorId], references: [id])
  portProfiles           PortProfile[]
  instances              DeviceInstance[]
}

model DeviceInstance {
  id             String      @id @default(cuid())
  scenarioId     String
  hostname       String
  displayName    String
  assetTag       String?
  modelId        String
  managementIp   String?
  status         DeviceStatus @default(PLANNED)
  graphX         Float        @default(0)
  graphY         Float        @default(0)
  model          DeviceModel @relation(fields: [modelId], references: [id])
  scenario       Scenario    @relation(fields: [scenarioId], references: [id])
  ports          Port[]
  @@unique([scenarioId, hostname])
}

model PhysicalLink {
  id            String @id @default(cuid())
  scenarioId    String
  sourcePortId  String
  targetPortId  String
  speedMbps     Int
  linkType      LinkType
  status        LinkStatus @default(PLANNED)
  sourcePort    Port @relation("SourcePort", fields: [sourcePortId], references: [id])
  targetPort    Port @relation("TargetPort", fields: [targetPortId], references: [id])
  @@unique([scenarioId, sourcePortId, targetPortId])
}
```

Yêu cầu:
- Dùng enum thay vì string tự do cho trạng thái, category, link type.
- Unique/foreign key rõ ràng.
- Không lưu array phức tạp nếu cần query quan hệ thường xuyên; dùng join table.
- metadataJson chỉ chứa vendor-specific fields không phải business-critical.

## 7. Device Catalog và seed data PACE

Seed catalog tối thiểu:

Firewall:
- Fortinet FortiGate 200G
- Sophos XGS 3100

Core/Aggregation:
- Cisco Catalyst C9300X-24Y
- NETGEAR M4350-24F4V / XSM4328FV
- MikroTik CRS518-16XS-2XQ-RM

Access:
- Cisco C1300-24T-4X
- Cisco C1300-48T-4X
- Cisco C1300-16P-4X
- Generic Maipu 8-port PoE nếu chưa có exact SKU

Wi-Fi:
- Cambium XV2-21X
- Cambium cnPilot e410 hoặc model legacy đang reuse

Security/IoT:
- Camera PTZ 4MP generic
- Dome 4MP generic
- NVR AI generic
- Tuya/Aqara sensor generic classes

Server/Storage:
- Generic 1U/2U Server model
- Generic NAS model; cho phép tạo custom model từ UI.

Seed spec fields cần ghi source/evidence URL và `specStatus`:
- VERIFIED_VENDOR
- USER_CONFIRMED
- ESTIMATED
- UNKNOWN

Không hardcode số liệu không chắc chắn thành “verified”.

Ví dụ:
- M4350-24F4V: 24 x 10G SFP+, 4 x 10/25G SFP28, switching fabric 680 Gbps.
- CRS518: 16 x 25G SFP28, 2 x 100G QSFP28, switching capacity 1.2 Tbps.
- C9300X-24Y: 24 x 1/10/25G SFP28, modular uplinks.
- FortiGate 200G: populate security-throughput fields từ vendor source.

## 8. Logic thay đổi mã thiết bị (Model Swap)

Đây là use case quan trọng nhất.

Flow:
1. User chọn DeviceInstance, ví dụ CORE-01.
2. Bấm “Change Model”.
3. Chọn model mới từ catalog.
4. Hệ thống tạo Swap Preview:
   - Current model vs Target model.
   - Port count/media/speed comparison.
   - Existing links mapped vào target port candidates.
   - LAG requirements.
   - Required features: stacking/MLAG/HA/L3.
   - Capacity delta.
5. Validation engine chạy nhưng chưa commit.
6. User chọn:
   - Auto-map ports.
   - Manual map.
   - Commit with warnings.
   - Cancel.
7. Commit transaction:
   - Update modelId.
   - Regenerate physical Port rows theo target PortProfile.
   - Preserve old port IDs qua mapping table tạm hoặc rebind links trong cùng transaction.
   - Unmapped links chuyển INVALID, không xóa.
   - Ghi AuditLog.
8. Re-run scenario validation.

Auto-map priority:
A. Same port name/index nếu compatible.
B. Same media + negotiated speed.
C. Higher compatible speed.
D. Free compatible port.
E. Không map được => ERROR.

Compatibility:
- SFP+ 10G link có thể map vào SFP28 nếu model/vendor support 10G.
- 25G link không được map vào 10G-only port.
- QSFP28 100G không được giả lập như SFP28 nếu không có breakout profile.
- Copper/fiber mismatch => ERROR trừ khi user thêm media converter/transceiver entity.

## 9. Validation Engine

Thiết kế rule-based, mỗi rule trả Finding[].

Interface:
```ts
type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

interface ValidationRule {
  code: string;
  evaluate(ctx: ScenarioContext): Promise<ValidationFinding[]>;
}
```

Rule MVP:
NET-PORT-001: Link speed vượt max speed của source/target port.
NET-PORT-002: Media mismatch.
NET-PORT-003: Một physical port gắn >1 physical link nếu không phải breakout.
NET-LAG-001: LAG member count vượt maxLagMembers.
NET-LAG-002: LAG chứa port không đồng tốc độ / không tương thích.
NET-LAG-003: Device không support LACP nhưng LAG protocol=LACP.
NET-HA-001: Firewall HA group có <2 members.
NET-HA-002: HA pair dùng cùng single upstream path => cảnh báo SPOF.
NET-STACK-001: Redundancy type STACK nhưng model không support stacking.
NET-MLAG-001: MLAG được cấu hình trên model không support.
NET-VLAN-001: Access port có >1 untagged VLAN.
NET-VLAN-002: Trunk thiếu VLAN cần thiết theo downstream dependency.
NET-IP-001: Subnet overlap.
NET-IP-002: Management IP duplicate.
NET-CAP-001: Tổng uplink demand vượt configured uplink capacity.
NET-CAP-002: Oversubscription ratio vượt threshold user-configurable.
NET-RES-001: Core/firewall/server path có single point of failure.
NET-MODEL-001: Model swap làm mất connected port.
NET-MODEL-002: Model swap làm giảm link speed.
NET-MODEL-003: Model swap thiếu required feature.

Output phải click được để focus node/link trong topology.

## 10. Capacity model

Không cố xây simulator packet-level. MVP dùng deterministic capacity model.

Link capacity:
effectiveCapacityMbps = speedMbps * activeMemberCount đối với LAG.
Không cộng double nếu topology ở trạng thái active/standby và policy không load-share.

Device capacity:
- Switch: min(switching fabric budget, aggregate port capacity) chỉ để cảnh báo cấp cao.
- Firewall: hiển thị nhiều profile: Raw Firewall, IPS, NGFW/Threat, TLS Inspection. User chọn “security profile” để capacity dashboard dùng đúng metric.
- Server/NAS: dùng NIC capacity và user-defined workload.

Oversubscription:
downstreamCommittedBandwidth / upstreamEffectiveCapacity.

Threshold mặc định:
- <= 1.0 Green
- >1.0 đến 2.0 Yellow
- >2.0 Red
Threshold được cấu hình tại Scenario Settings.

Failure simulation:
- disable device
- disable link
- disable LAG member
- disable ISP
Sau mỗi action, graph traversal tìm nodes mất đường tới Core/Internet và tính lại capacity/redundancy.

## 11. Topology UI/UX specification

Layout desktop:
- Left sidebar: module navigation.
- Top bar: campus/scenario selector, search, validation summary.
- Center: React Flow canvas.
- Right inspector: selected node/link details.
- Bottom optional drawer: validation/capacity events.

Custom Device Node:
- Icon theo category.
- Hostname + model.
- Status badge.
- Key ports hiển thị dưới dạng handles.
- Badge HA/Stack/MLAG.
- Capacity badge (10G/25G/100G).
- Warning counter.

Interactions:
- Drag device từ catalog palette vào canvas.
- Connect port-to-port bằng handles.
- Multi-select và align.
- Zoom/pan/minimap.
- Auto-layout theo layers: Internet > Firewall > Core > Distribution/Access > Endpoint/Server.
- Filter theo VLAN, floor, device type, link speed, status.
- Highlight path từ endpoint tới Internet/server.
- Toggle Physical / Logical view.
- Toggle Baseline / Proposed overlay.
- Click edge => show source port, target port, optics/cable, speed, LAG membership, VLANs.

Color:
Không phụ thuộc màu để truyền severity; luôn có icon/text.

## 12. Screen acceptance criteria

Dashboard:
- Cards: device count, online/planned, links by speed, warnings/errors, capacity headroom.
- Campus hierarchy summary by floor.
- “Core & Security” summary.
- Recent changes.

Inventory:
- Table filter/sort/search.
- Columns: hostname, category, vendor/model, location, mgmt IP, status, scenario.
- Bulk import CSV/JSON phase 1.1.

Device Detail:
- Overview, ports, links, LAGs, VLANs, model spec, audit history.
- Change Model action.

Catalog:
- Vendor/category filtering.
- Compare up to 3 models.
- Create Custom Model.

VLAN/IP:
- VLAN matrix by device/LAG/port.
- CIDR overlap validation.

Scenario Compare:
- Added/removed/replaced devices.
- Port/link differences.
- Capacity delta.
- Validation delta.
- Estimated cost field optional/manual.

Validation:
- Severity filter.
- “Locate in topology”.
- “Suggested remediation”.

## 13. API contract

REST-like Route Handlers MVP:

GET    /api/scenarios
POST   /api/scenarios
POST   /api/scenarios/:id/clone
GET    /api/scenarios/:id/topology
POST   /api/scenarios/:id/validate

GET    /api/device-models
POST   /api/device-models
GET    /api/device-models/:id

GET    /api/devices?scenarioId=
POST   /api/devices
GET    /api/devices/:id
PATCH  /api/devices/:id
POST   /api/devices/:id/swap-model
POST   /api/devices/:id/swap-model/preview

GET    /api/devices/:id/ports

POST   /api/links
PATCH  /api/links/:id
DELETE /api/links/:id

POST   /api/lags
PATCH  /api/lags/:id
POST   /api/lags/:id/members

GET    /api/vlans?scenarioId=
POST   /api/vlans

POST   /api/failure-simulations

Response envelope:
```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

Mutations phải:
- validate Zod input;
- chạy transaction;
- ghi audit log;
- trả validation findings liên quan nếu mutation ảnh hưởng topology.

## 14. Codebase structure

```text
src/
  app/
    (app)/
      dashboard/
      topology/[scenarioId]/
      inventory/
      catalog/
      vlans/
      scenarios/
      validation/
    api/
  components/
    topology/
      TopologyCanvas.tsx
      DeviceNode.tsx
      PhysicalLinkEdge.tsx
      DeviceInspector.tsx
      ModelSwapDialog.tsx
    inventory/
    catalog/
    shared/
  domain/
    device/
    port/
    link/
    lag/
    vlan/
    scenario/
    validation/
  server/
    db/
    repositories/
    services/
    validators/
  lib/
    topology/
      autoLayout.ts
      pathFinding.ts
      capacity.ts
      portMapping.ts
  types/
  seed/
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/
  integration/
  e2e/
```

Rule:
- UI không gọi Prisma trực tiếp.
- Route -> Service -> Repository/Prisma.
- Pure algorithms ở lib/domain để unit-test dễ.

## 15. Seed topology PACE Smart Campus 181

Baseline seed đề xuất:
- Campus: PACE Smart Campus 181 Cô Giang.
- Building: VP181.
- Floors: B2, B1, T1..T11.
- Server room/Core zone: B2.
- Firewall pair logical: FW-01/FW-02; initial model selectable FortiGate 200G hoặc Sophos XGS3100.
- Core pair: CORE-01/CORE-02; initial model selectable C9300X-24Y, M4350-24F4V hoặc CRS518.
- Access/distribution switch instances theo tầng từ danh mục hiện có.
- Wi-Fi: 2 AP/tầng T1–T11; B1/B2 có thể seed legacy AP.
- Camera: seed theo floor/zone; NVR ở B2.
- Logical ISP nodes: ISP-01..ISP-n.
- VLAN examples:
  VLAN10 Management
  VLAN20 Staff
  VLAN30 Learner/Student
  VLAN40 Server
  VLAN50 Voice
  VLAN60 Camera
  VLAN70 IoT
  VLAN80 Guest
  VLAN90 AV/Streaming
  VLAN999 Native/Blackhole hoặc policy tùy thiết kế
- Không ép subnet nếu chưa xác nhận; seed với trạng thái DRAFT.

Core variants:
A. C9300X-24Y pair.
B. M4350-24F4V pair.
C. CRS518 pair.
User có thể clone scenario và swap core model để so capacity/port fit/risk.

## 16. Workflow demo bắt buộc

Demo 1 — Change Core Model
1. Open Proposed Scenario.
2. CORE-01/CORE-02 đang là M4350-24F4V.
3. Change Model -> C9300X-24Y.
4. Preview cho thấy 10G access links tương thích với SFP28 1/10/25G.
5. Stack capability thay đổi; user chọn RedundancyGroup STACK nếu appropriate.
6. Commit và validation cập nhật.

Demo 2 — Change to CRS518
1. Clone scenario.
2. Swap CORE pair sang CRS518.
3. 10G links được auto-map vào SFP28 compatible ports.
4. 100G uplink option hiển thị.
5. Nếu scenario đang dùng Cisco StackWise rule thì báo ERROR/WARNING và yêu cầu chuyển redundancy type sang MLAG.

Demo 3 — Firewall Swap
1. FortiGate 200G -> Sophos XGS3100.
2. Existing physical links preserved nếu port mapping phù hợp.
3. Capacity dashboard chuyển security profile values theo target model.
4. Nếu số 10G ports không đủ cho thiết kế hiện tại, link chưa map phải hiển thị ERROR.

Demo 4 — Link Failure
Disable một core uplink hoặc một LAG member; dashboard phải chỉ ra degraded capacity nhưng không mất service nếu còn path.

## 17. Security & governance

MVP:
- Role: ADMIN, EDITOR, VIEWER.
- Viewer không mutation.
- Editor không xóa Baseline locked scenario.
- Admin quản lý catalog/custom spec.
- Audit mọi topology mutation.
- CSRF/session protection theo auth framework.
- Validate toàn bộ IDs và ownership/scenario boundary.
- Không lưu password thiết bị production.
- Management IP chỉ là metadata; không tự động connect.
- Export JSON phải loại secrets.
- Có demo-mode flag để tránh nhầm dữ liệu mô phỏng với production.

## 18. Testing strategy

Unit:
- port compatibility
- model swap mapping
- LAG capacity
- VLAN membership validation
- subnet overlap
- path finding
- SPOF detection

Integration:
- swap model transaction
- clone scenario
- create link with incompatible speed must fail or return finding theo policy
- validation rerun after mutation

E2E:
- create scenario
- drag device
- connect ports
- create LAG
- assign VLAN
- change model
- compare scenarios
- failure simulation

Minimum quality gate:
- TypeScript noImplicitAny.
- Zero ESLint errors.
- Unit coverage >= 80% cho validation/capacity/portMapping modules.
- Playwright smoke test cho 4 demo workflow.

## 19. Phân kỳ triển khai cho Codex

Phase 0 — Bootstrap
- Next.js/TS/Tailwind/shadcn
- PostgreSQL/Prisma
- seed minimal
- basic navigation

Phase 1 — Inventory + Catalog
- DeviceModel/PortProfile
- DeviceInstance/Port
- inventory/catalog CRUD
- Device Detail

Phase 2 — Topology Editor
- React Flow custom nodes
- physical links
- persist graph positions
- inspector

Phase 3 — LAG/VLAN/IP
- LAG/LACP
- VLAN membership
- subnet plan

Phase 4 — Model Swap + Validation
- preview/commit transaction
- mapping algorithm
- findings UI

Phase 5 — Scenario & Simulation
- clone/compare
- failure simulation
- capacity/risk

Phase 6 — PACE polish
- seed full campus
- dashboard
- export/import
- print/share topology

## 20. Codex execution instructions

Codex phải làm theo từng milestone, không build toàn bộ trong một prompt.

Mỗi milestone:
1. Đọc SOP.
2. Tóm tắt phạm vi milestone trong README_DEV.md.
3. Tạo/đổi schema trước nếu có.
4. Viết test cho pure business logic trước hoặc song song.
5. Implement.
6. Chạy: lint, typecheck, unit tests, build.
7. Ghi CHANGELOG_DEV.md: files changed, migrations, known limitations.
8. Không tự ý đổi domain model nếu chưa ghi ADR.

ADR bắt buộc khi:
- đổi DB schema lớn;
- đổi graph library;
- đổi auth;
- thay REST-like API bằng khác;
- thay scenario versioning strategy.

Các command mục tiêu:
```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npx prisma migrate dev
npx prisma db seed
```

## 21. Prompt khởi động cho Codex

Copy prompt này vào Codex sau khi đưa SOP vào repository:

“Read SOP-SC181-001 completely. Implement Phase 0 and Phase 1 only. Use Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, PostgreSQL and Prisma ORM 7. Preserve the architecture boundaries Route -> Service -> Repository. Create the schema for Campus, Building, Floor, Zone, Rack, Vendor, DeviceModel, PortProfile, Scenario, DeviceInstance and Port. Seed PACE Smart Campus 181, FortiGate 200G, Sophos XGS3100, Cisco C9300X-24Y, NETGEAR M4350-24F4V and MikroTik CRS518-16XS-2XQ-RM. Build Inventory, Device Detail and Catalog pages. Add tests for device-model/port-profile generation. Run lint, typecheck, tests and production build. Record all implementation decisions and limitations in CHANGELOG_DEV.md. Do not start Phase 2.”

## 22. Definition of Done — MVP

MVP đạt DONE khi:
- User mở campus PACE 181 và xem hierarchy B2/B1/T1-T11.
- Có catalog model và custom model.
- Có inventory device instances.
- Topology editor persist được node/link/port.
- Tạo được LAG/LACP và VLAN membership.
- Swap model có preview + auto-map + validation.
- Có ít nhất 3 Core alternatives (C9300X, M4350, CRS518) và 2 Firewall alternatives (FG-200G, XGS3100).
- Scenario clone/compare hoạt động.
- Failure simulation link/device hoạt động.
- Validation hiển thị tối thiểu 12 rule.
- Dashboard capacity/risk cập nhật theo scenario.
- Unit/integration/e2e quality gates đạt.
- Docker Compose chạy app + DB trên Ubuntu Server.

## 23. Nguồn kỹ thuật tham khảo

Các nguồn vendor/framework nên lưu trong repository docs/references.md và dùng khi seed/update spec:
- Next.js official documentation — https://nextjs.org/docs
- React Flow official documentation — https://reactflow.dev/
- Prisma official documentation — https://www.prisma.io/docs
- Fortinet FortiGate 200G Series official data sheet — https://www.fortinet.com/resources/data-sheets/fortigate-200g-series
- Cisco Catalyst 9300 Series official data sheet — https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html
- NETGEAR M4350 official data sheet — https://www.downloads.netgear.com/files/GDC/M4350/M4350_Datasheet.pdf
- MikroTik CRS518 official product data sheet — https://cdn.mikrotik.com/web-assets/product_files/CRS518-16XS-2XQ-RM_220739.pdf
- Sophos XGS 1U official product page — https://www.sophos.com/en-us/products/next-gen-firewall/xgs-1u-distributed-edge-firewalls

Quan trọng: khi import spec mới, app phải lưu sourceUrl, verifiedAt, specStatus; không biến mọi dữ liệu catalog thành sự thật tuyệt đối nếu chưa vendor-verified.

