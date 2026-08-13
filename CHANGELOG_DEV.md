# Development Changelog

## 2026-08-13 — Phase SP-1 PDF ingestion

### Added

- ADR-0005 chọn PDF.js Apache-2.0 và `@napi-rs/canvas` MIT, thay thế lựa chọn PyMuPDF/Python bị chặn license.
- Upload PDF revision bất biến với MIME, magic bytes, 50 MiB limit, SHA-256 và rollback object khi database transaction thất bại.
- PostgreSQL job claim dùng `FOR UPDATE SKIP LOCKED`; Node worker riêng render WebP preview/thumbnail, persist page dimensions và trạng thái job/document.
- Drawing UI cho document creation, revision upload, job/error status, page previews và mapping page vào Floor; document chuyển READY khi mọi page đã map.
- Asset streaming endpoint có content type, length, private cache, ETag và `nosniff`.
- PDF worker Docker target/service, CI image build/publish/provenance và unit/E2E workflow upload → process → preview → map.

### Decisions and limitations

- Worker không OCR, không extract vector và không chạy PDF JavaScript/external resources; advanced extraction thuộc SP-6.
- PostgreSQL queue phù hợp khối lượng hiện tại dưới 100 lượt; Redis vẫn deferred.
- Filesystem ObjectStorage vẫn chỉ dành cho local/CI. Production cần S3-compatible adapter, malware-scanner integration và retention/backup policy trước khi nhận upload thật.
- SP-1 tái sử dụng schema SP-0 nên không cần migration mới.

## 2026-08-13 — Milestone M2 Network Topology

### Added

- `PhysicalLink`, link enums và `AuditLog`; composite foreign keys bắt buộc hai endpoint Port và CableRoute thuộc cùng Scenario.
- Topology repository/service/API với read model, locked-scenario enforcement, port occupancy, endpoint/speed validation và transaction audit cho create/update/delete/move.
- React Flow editor tại `/topology/[scenarioId]`: custom device/port nodes, persisted positions, port-first connection, link inspector, update/delete và read-only mode.
- Device Detail hiển thị physical links và điều hướng trực tiếp đến topology scenario.
- Unit tests cho scenario isolation, locked scenario, missing/cross-scenario port, occupied port, same-device link, speed compatibility và position persistence.

### Decisions and limitations

- Database là source of truth; React Flow chỉ giữ editor state tạm thời và ghi vị trí qua API rõ ràng.
- LAG/VLAN vẫn thuộc M3; validation findings đầy đủ và model swap thuộc M4.
- SP-1 là bước tích hợp kế tiếp nhưng vẫn blocked cho đến khi giải quyết license PDF processing trong ADR-0004.
- Next 16.3 dùng TypeScript compiler API trong production build vì CLI `--showConfig` không trả JSON ổn định trên managed Node runtime hiện tại.

## 2026-08-11 — Phase SP-0 Spatial schema & storage

### Added

- Prisma models cho drawing/revision/page, floor map, coordinate/calibration, placement, local geometry, import job, 3D model mapping, cable route và riser.
- Composite foreign keys enforce cùng campus/building, document/revision, floor/coordinate system và device/scenario/floor.
- PostgreSQL CHECK constraints cùng partial unique indexes bảo đảm active shared/scenario floor map không trùng.
- `ObjectStorage` port và filesystem adapter development/CI: immutable generated key, traversal protection, streaming write/read, byte limit, SHA-256 verification và idempotent delete.
- DrawingDocument metadata CRUD qua Route -> Service -> Repository; document có revision/derived asset không bị xóa trực tiếp.
- Pure affine coordinate/calibration functions, Zod spatial DTOs và unit/E2E tests.
- Seed idempotent tạo canonical coordinate system và blank manual floor map cho B2/B1/T1-T11, không giả định elevation hoặc dimensions.

### Decisions and limitations

- SP-0 không có PDF/GLB upload endpoint, rendering, worker hoặc UI; các phần này bắt đầu từ SP-1/SP-2.
- Filesystem storage bị chặn trong production; S3-compatible provider vẫn cần quyết định và triển khai trước production upload.
- `CableRoute.physicalLinkId` luôn null bằng DB CHECK cho đến khi M2 tạo PhysicalLink và bổ sung composite FK cùng scenario.
- `uploadedBy` hiện là DTO field vì authentication/RBAC chưa có; phải lấy từ authenticated principal khi security phase được triển khai.

## 2026-08-11 — Milestone M1 Inventory & Catalog

### Added

- Prisma schema cho Campus, Building, Floor, Zone, Rack, Vendor, DeviceModel, PortProfile, Scenario, DeviceInstance và Port.
- Composite scenario/location foreign keys và database CHECK constraints cho hierarchy, rack units, profile count và port index/speed.
- Hai reviewed migrations: `m1_inventory_catalog` và `m1_location_invariants`.
- Idempotent PACE 181 seed: 13 floors, 5 vendor models có evidence, 2 scenarios, 8 devices và 232 generated ports.
- Pure deterministic PortProfile → Port generation cùng tests cho ordering, speed normalization và invalid/duplicate definitions.
- Catalog/Inventory repository-service-route boundaries với CRUD API, custom model policy, locked Baseline và explicit scenario isolation.
- UI cho Catalog, Catalog Detail, Inventory và Device Detail; form tạo custom model/device; status/delete action cho mutable scenario.
- E2E smoke cho seeded Inventory/Catalog và CI seed trên ephemeral PostgreSQL.

### Decisions and limitations

- Vendor seed chỉ populate field đã đối chiếu; field chưa chắc chắn để `null`. Evidence register nằm tại `documents/references/M1-catalog-evidence.md`.
- Optional uplink/Flexi Port modules không được giả định là fixed ports.
- Seed lặp không overwrite seeded DeviceInstance và không xóa Port, tránh phá PhysicalLink khi M2 được bổ sung.
- Device Detail hiển thị Links/LAG/VLAN/Model Swap là deferred: lần lượt thuộc M2, M3 và M4; M1 không tạo các bảng này.
- Authentication/RBAC UI enforcement chưa thuộc M1; locked scenario được enforce trong service và composite ownership được enforce ở database.

## 2026-08-11 — Milestone M0.1 architecture alignment

### Added

- ADR cho scenario/cross-domain versioning, canonical spatial coordinates/location ownership và object storage/upload/worker boundary.
- Mô hình dữ liệu tích hợp cùng roadmap xen kẽ milestone network và spatial.
- shadcn/ui foundation với Tailwind 4 design tokens, `cn`, Button/Card và component unit test.
- Docker `migrator` target tách khỏi application runtime; local/production Compose hỗ trợ migration one-shot.
- CI migration gate trên PostgreSQL sạch và GHCR publishing cho cặp application/migrator image cùng commit SHA.

### Migrations

- Chưa có domain migration. `prisma migrate deploy` đã được nối vào CI/deploy và hiện xác nhận trạng thái rỗng an toàn; migration đầu tiên thuộc M1.

### Decisions before M1

- Shared building evidence và scenario-owned design data có ownership/clone boundary rõ ràng.
- Tọa độ chuẩn dùng mét với gốc trái-trên; administrative location là nguồn sự thật, placement là spatial projection.
- Storage đi qua abstraction; local filesystem cho dev/CI và S3-compatible service được phê duyệt cho production. Python extraction worker bị trì hoãn đến SP-1 và cần đóng license gate.

## 2026-08-11 — Milestone M0 foundation

### Added

- Next.js 16/React 19/TypeScript strict/Tailwind 4 application shell.
- Prisma ORM 7 configuration using the PostgreSQL driver adapter.
- Liveness and database-backed readiness endpoints through Route -> Service -> Repository.
- Vitest coverage gates and Playwright foundation smoke tests.
- Multi-stage, non-root Next.js standalone Docker image.
- Local and production-foundation Compose definitions.
- Pull-based host deployment script and environment template.
- GitHub Actions CI and GHCR image publishing with SBOM/provenance.
- Developer guide, deployment runbook and ADR template.
- Webpack production build fallback because Turbopack's PostCSS worker cannot bind its internal loopback port in the current managed execution environment; development still uses Turbopack.

### Migrations

- None. The first domain migration is intentionally deferred to M1 pending ERD and scenario-versioning ADR review.

### Known limitations at M0

- Inventory, Catalog, Topology and domain seed data are not part of M0.
- Production reverse proxy/TLS and automated remote deployment await infrastructure decisions from plan section 11.
- Docker Compose v2.40.3 and Buildx v0.30.1 were installed as user-level CLI plugins on the development host.
- Docker daemon access was granted to the current development account through a socket ACL.
- Local production image build and the full Compose app + PostgreSQL stack were verified healthy; liveness and database readiness both passed.
- Added OpenSSL and CA certificates to the pinned Node.js base image after Docker validation exposed Prisma's runtime detection warning.
- Automated vulnerability policy enforcement and remote production deployment remain for the infrastructure/security workstream.
