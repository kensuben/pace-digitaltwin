# Development Changelog

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
