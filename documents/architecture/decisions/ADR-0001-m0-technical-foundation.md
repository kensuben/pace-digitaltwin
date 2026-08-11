# ADR-0001 — M0 technical foundation

- Status: Accepted for M0
- Date: 2026-08-11
- Owners: Project team

## Context

SOP-SC181-001 yêu cầu Next.js 16, Prisma ORM 7, PostgreSQL và Docker Compose. Pipeline cần build image ở GitHub và production host chỉ pull artefact đã kiểm thử.

## Decision

- Node.js 22 LTS, npm lockfile và TypeScript strict.
- Next.js standalone multi-stage image chạy non-root.
- Một Dockerfile tạo hai target bất biến từ cùng commit: `runner` chỉ chứa Next.js standalone và `migrator` chứa Prisma CLI/schema/migration history.
- `next dev` dùng Turbopack mặc định; production dùng `next build --webpack` vì Turbopack PostCSS worker không thể bind cổng nội bộ trong managed build environment hiện tại.
- GHCR image tag immutable theo full commit SHA; SemVer tag chỉ được tạo từ Git tag.
- Local Compose có app + PostgreSQL. Production Compose không có `build:`.
- Host pull cặp tag cùng SHA, chạy migrator one-shot thành công rồi mới nâng application.
- Health endpoint đi qua Route -> Service -> Repository để giữ architecture boundary ngay từ M0.

## Alternatives considered

- Node.js 20 đáp ứng minimum nhưng Node.js 22 được chọn vì là baseline LTS mới hơn.
- Docker Hub không được chọn vì GHCR tích hợp quyền repository và `GITHUB_TOKEN`.
- Build trực tiếp trên production host bị loại vì khó tái lập và làm tăng attack surface.

## Consequences

- Runtime, CI và Docker phải dùng Node.js 22.
- Host cần Docker Compose plugin v2 và quyền read-only với GHCR private package.
- Runtime image không mang Prisma CLI; migration lifecycle độc lập với application process.
- Reverse proxy, remote deploy mechanism và database placement vẫn cần ADR riêng sau infrastructure discovery.

## Rollback / migration impact

Không có database migration domain trong M0/M0.1. Application rollback sẽ pin lại image SHA/digest trước đó; database không tự động downgrade.
