# PLAN-SC181-001 — Kế hoạch nghiên cứu, phân tích và triển khai CI/CD

**Hệ thống:** PACE Smart Campus 181 Network Digital Twin Web App  
**Nguồn yêu cầu:** `SOP-SC181-001_PACE_Smart_Campus_Network_Digital_Twin_WebApp.md`  
**Ngày lập:** 11/08/2026  
**Trạng thái:** M0, M0.1 và M1 hoàn tất; SP-0 sẵn sàng bắt đầu

## 1. Kết quả cần đạt

Xây dựng hệ thống theo từng milestone có thể kiểm thử và triển khai độc lập, với chuỗi phân phối chuẩn:

```text
Developer local
  -> feature branch / pull request
  -> GitHub Actions: lint + typecheck + unit/integration + build
  -> merge main
  -> Docker build một lần
  -> scan + SBOM + push immutable image lên GHCR
  -> deploy staging
  -> smoke/E2E + phê duyệt production
  -> Ubuntu host pull đúng image digest
  -> migrate database one-shot
  -> health check
  -> hoàn tất hoặc rollback
```

Nguyên tắc quan trọng: production không clone source để build, không dùng `latest` làm định danh triển khai, không nhúng secret vào image, và cùng một image đã kiểm thử ở staging phải được promote sang production.

## 2. Hiện trạng và khoảng trống

Repository đã hoàn tất foundation M0 và đang chốt M0.1 trước domain migration đầu tiên: application shell, test, Docker/Compose, CI/GHCR workflow, ADR xuyên domain và roadmap tích hợp đã có. Không có legacy code hoặc dữ liệu cần migration.

SOP đã xác định tốt domain, module, API, test strategy và Definition of Done. Các nội dung cần bổ sung trước khi vận hành gồm:

- môi trường dev/staging/production và ownership;
- branch protection, review và release convention;
- image registry, tagging, provenance, vulnerability scan và retention;
- secret/configuration matrix;
- database backup, migration, restore và rollback policy;
- reverse proxy, TLS, DNS, health/readiness và observability;
- runbook triển khai/sự cố và tiêu chí go-live.

## 3. Quyết định kiến trúc ban đầu

Các quyết định dưới đây là baseline, cần xác nhận ở Sprint 0:

| Hạng mục | Baseline đề xuất | Lý do |
|---|---|---|
| Runtime | Node.js 22 LTS, pin bằng `.nvmrc`/`.node-version` và Docker base digest | Đáp ứng Next.js 16 và Prisma 7, ổn định cho production |
| Package manager | npm với `package-lock.json` và `npm ci` | Phù hợp command trong SOP, build tái lập |
| Application | Next.js 16 App Router, TypeScript strict | Theo SOP |
| Database | PostgreSQL 17, persistent named volume | RDBMS theo SOP; pin major version |
| ORM | Prisma ORM 7 + PostgreSQL driver adapter | Theo SOP và yêu cầu Prisma 7 |
| Container registry | GitHub Container Registry (`ghcr.io`) | Tích hợp `GITHUB_TOKEN`, quyền package theo repository |
| Host runtime | Ubuntu Server + Docker Engine + Compose plugin | Theo SOP, vận hành đơn giản cho MVP |
| Reverse proxy | Caddy hoặc Nginx; chọn chính thức bằng ADR | TLS termination, routing và security headers |
| Environments | local, CI ephemeral, staging, production | Có bước xác minh trước production |
| Deployment | Pull-based trên host, trigger thủ công có approval | Host không cần build toolchain; kiểm soát production |

Mọi thay đổi lớn về schema, auth, graph library hoặc versioning strategy phải có ADR theo SOP.

## 4. Workstreams nghiên cứu và phân tích

### WS1 — Discovery hạ tầng và vận hành

Thu thập và xác nhận:

- GitHub owner/repository, private hay public, GHCR package visibility;
- hostname/IP staging và production, CPU/RAM/disk, kiến trúc `amd64` hay `arm64`;
- DNS, certificate, outbound access từ host tới `ghcr.io`;
- vị trí lưu Docker volumes và backup ngoài host;
- RTO/RPO, maintenance window, retention log/backup;
- người có quyền approve production và người nhận cảnh báo.

**Đầu ra:** `docs/operations/environment-matrix.md`, ADR deployment topology và checklist host readiness.

### WS2 — Domain/data model

- Chuẩn hóa toàn bộ entity và cardinality từ SOP trước migration đầu tiên.
- Làm rõ cách clone immutable Scenario: deep copy, copy-on-write hay versioned records.
- Thiết kế join table cho VLAN membership, redundancy member, LAG member và nguồn chứng cứ catalog.
- Quy định scenario boundary cho mọi foreign key/service mutation.
- Xác định seed nào là `VERIFIED_VENDOR`, `USER_CONFIRMED`, `ESTIMATED`, `UNKNOWN`.

**Đầu ra:** ERD, Prisma schema, data dictionary, ADR scenario versioning, seed evidence register.

### WS3 — Security/threat model

- Phân vùng trust giữa browser, reverse proxy, app, PostgreSQL, GHCR và GitHub runner.
- RBAC `ADMIN/EDITOR/VIEWER`, locked Baseline, audit trail và demo-mode banner.
- Secret inventory; không lưu credential thiết bị mạng production.
- Dependency/image scanning, least-privilege workflow permissions, protected environments.
- Xác định Auth.js local demo trước và Entra ID OIDC ở phase sau.

**Đầu ra:** threat model, security checklist và ADR authentication.

### WS4 — UX và acceptance mapping

- Chuyển từng acceptance criterion trong SOP thành backlog/test case có ID.
- Wireframe Dashboard, Inventory, Catalog, Topology, Model Swap, Scenario Compare, Validation.
- Kiểm tra accessibility: keyboard, focus, label và severity không phụ thuộc màu.

**Đầu ra:** traceability matrix `SOP -> issue -> test -> release`.

### WS5 — Delivery/operations

- Thiết kế CI, image promotion, migration, backup, rollback, health check và alert.
- Định nghĩa SLI cơ bản: availability, HTTP 5xx, latency, container restart, disk và DB health.

**Đầu ra:** workflow, Docker/Compose files, deployment và incident runbook.

## 5. Roadmap triển khai

### M0 — Foundation và CI local/PR

Phạm vi:

- bootstrap Next.js/TypeScript/Tailwind/shadcn, Node 22, npm lockfile;
- ESLint CLI, Prettier, Vitest, Playwright và scripts chuẩn;
- PostgreSQL/Prisma, cấu hình `.env.example`, Compose dành cho local;
- health endpoints `/api/health/live` và `/api/health/ready`;
- kiến trúc thư mục Route -> Service -> Repository;
- `README_DEV.md`, `CHANGELOG_DEV.md`, ADR template.

Quality gate: fresh clone có thể `npm ci`, khởi động DB, migrate/seed, lint, typecheck, test và production build thành công.

### M1 — Inventory và Device Catalog

Thực hiện đúng Phase 1 của SOP: schema location/catalog/scenario/device/port, seed tối thiểu có evidence, CRUD qua service/repository, Inventory, Device Detail và Catalog. Test port generation và scenario isolation.

### M2 — Topology Editor

React Flow custom nodes/edges, port-first connection, lưu graph position, inspector, transaction tạo/sửa link và topology read model.

### M3 — LAG, VLAN và IP Plan

LAG/LACP, VLAN membership, subnet, overlap validation, VLAN matrix và capacity primitives.

### M4 — Model Swap và Validation Engine

Preview/auto-map/manual-map/commit transaction, không xóa silent link, audit log và tối thiểu các validation rules trong SOP.

### M5 — Scenario, Compare và Failure Simulation

Clone/lock/compare, graph traversal, failure actions, SPOF/capacity/risk và validation delta.

### M6 — PACE data, security và UX polish

Full campus seed, dashboard, import/export an toàn, RBAC, authentication đã chọn, accessibility và bốn demo workflow.

### M7 — Production readiness/go-live

Load baseline, backup/restore drill, vulnerability remediation, deploy/rollback rehearsal, UAT, runbook handover và production approval.

Mỗi milestone phải cập nhật `README_DEV.md` và `CHANGELOG_DEV.md`, chạy đủ quality gate, tạo migration có review và không bắt đầu milestone kế tiếp khi acceptance hiện tại chưa đạt.

## 6. Thiết kế CI/CD

### 6.1 Branch và release

- `main` luôn deployable; feature branch ngắn hạn và merge qua pull request.
- Required checks: install, lint, typecheck, unit/integration test, build và migration validation.
- Ít nhất một approval; cấm force-push/xóa `main`; conversation phải resolved.
- Conventional Commits là khuyến nghị; release dùng tag `vX.Y.Z`.
- Hotfix vẫn đi qua PR và cùng quality gate, chỉ rút ngắn UAT.

### 6.2 Workflow `ci.yml`

Trigger trên pull request và push `main`:

1. checkout action theo major version đã duyệt;
2. setup Node 22 + npm cache;
3. `npm ci`;
4. Prisma generate, validate và `migrate deploy` trên PostgreSQL sạch;
5. chạy PostgreSQL service container cho integration test;
6. `npm run lint`;
7. `npm run typecheck`;
8. `npm run test -- --coverage`;
9. `npm run build`;
10. build application và migrator Docker targets nhưng không push trên PR;
11. upload test/coverage report khi thất bại.

Các job độc lập được chạy song song khi bootstrap hoàn tất. Không coi `next build` là lint gate vì Next.js 16 không tự chạy lint.

### 6.3 Workflow `image.yml`

Chỉ chạy sau CI thành công trên `main` hoặc release tag:

- đăng nhập `ghcr.io` bằng `GITHUB_TOKEN` với `packages: write`;
- BuildKit multi-stage, cache GitHub Actions, image runtime non-root;
- tạo OCI labels, SBOM và provenance attestation;
- scan image; không publish/promote khi có lỗ hổng vượt policy;
- push tag immutable `sha-<full_commit_sha>`;
- release thêm `vX.Y.Z`, `vX.Y`, `vX`; không deploy bằng mutable `latest`;
- ghi image digest vào release/deployment metadata.

Nếu host chỉ là `amd64`, MVP build `linux/amd64`; chỉ thêm multi-arch khi discovery xác nhận cần thiết.

### 6.4 Staging và production

Staging tự động hoặc bán tự động sau image publish:

1. host xác thực GHCR bằng read-only token;
2. cập nhật `APP_IMAGE` thành digest/tag SHA đã chọn;
3. `docker compose pull app`;
4. backup DB theo policy;
5. chạy migrator target one-shot được build từ cùng commit với application image;
6. `docker compose up -d --no-build`;
7. đợi readiness, chạy smoke test và bốn E2E demo khi milestone hỗ trợ;
8. ghi deployment SHA/digest/migration/time/result.

Production dùng GitHub Environment có required approver. Chỉ promote image đã qua staging; không rebuild. Với một host, chấp nhận maintenance window ngắn ở MVP. Nếu yêu cầu zero-downtime, phải thiết kế thêm blue/green và có ADR.

### 6.5 Migration và rollback

- CI chỉ kiểm tra migration; production dùng `prisma migrate deploy`, tuyệt đối không dùng `migrate dev`.
- Migration production phải ưu tiên expand/contract và backward-compatible với image trước.
- Trước migration rủi ro cao phải có backup đã kiểm tra restore.
- Rollback application: pin lại digest trước và `compose up -d`; không tự động rollback database schema.
- Nếu migration phá tương thích, rollout phải chia nhiều release hoặc có forward-fix/runbook riêng.
- Giữ tối thiểu N image release gần nhất; giá trị N chốt theo RTO và storage policy.

## 7. Container và host layout

Artefact dự kiến:

```text
Dockerfile
.dockerignore
compose.yaml                  # local app + postgres
deploy/compose.prod.yaml      # app + reverse proxy; DB theo quyết định hạ tầng
deploy/env.example
deploy/scripts/deploy.sh
deploy/scripts/rollback.sh
deploy/scripts/backup-db.sh
.github/workflows/ci.yml
.github/workflows/image.yml
.github/workflows/deploy.yml
docs/operations/deploy-runbook.md
docs/operations/rollback-runbook.md
docs/operations/backup-restore-runbook.md
```

Docker image dùng Next.js standalone output, multi-stage build, read-only-friendly filesystem, non-root user và `HEALTHCHECK`. Persistent data chỉ nằm ở PostgreSQL volume/backup; app container là stateless.

Production Compose phải:

- tham chiếu image qua `${APP_IMAGE}` và không có `build:`;
- có restart policy, health check và log rotation;
- PostgreSQL không public port ra Internet;
- tách secrets khỏi Git và đặt file quyền tối thiểu trên host;
- pin version/digest của image database và reverse proxy;
- định nghĩa network nội bộ và volume cụ thể.

## 8. Configuration và secrets

| Biến/secret | Local | CI | Staging/Production |
|---|---|---|---|
| `DATABASE_URL` | `.env.local`, không commit | GitHub secret/service DB | secret file hoặc secret manager trên host |
| `AUTH_SECRET` | giá trị dev | secret test riêng | secret ngẫu nhiên riêng từng môi trường |
| `APP_URL` | localhost | test URL | URL canonical |
| `GHCR_PULL_TOKEN` | không cần | `GITHUB_TOKEN` để push | read-only package token trên host |
| demo-mode flag | true | true | quyết định rõ; production phải hiển thị trạng thái dữ liệu |

Không truyền secret bằng Docker build args. `.env.example` chỉ chứa tên biến và mô tả, không chứa giá trị thật.

## 9. Quality gates và Definition of Ready/Done

Một milestone chỉ Ready khi có scope, acceptance, schema impact, migration/rollback impact, seed evidence và test cases. Một milestone chỉ Done khi:

- lint và typecheck không lỗi;
- unit/integration test đạt; coverage domain validation/capacity/port mapping >= 80%;
- production build và Docker build đạt;
- không có lỗ hổng vượt policy chưa được accept bằng văn bản;
- migration chạy được trên DB sạch và DB từ release trước;
- smoke/E2E phù hợp milestone đạt;
- tài liệu, ADR và changelog cập nhật;
- image SHA có thể deploy và rollback trên staging.

## 10. Rủi ro chính và kiểm soát

| Rủi ro | Kiểm soát |
|---|---|
| Model thiết bị seed sai | Evidence URL, `specStatus`, `verifiedAt`; không gắn VERIFIED nếu chưa xác minh |
| Clone scenario tạo dữ liệu chéo | Repository filter bắt buộc theo scenario, composite constraints, integration tests |
| Model swap làm mất link | Preview + transaction + invalid finding; không silent delete |
| Migration làm downtime/mất dữ liệu | Expand/contract, backup/restore drill, maintenance window |
| Mutable image gây khó rollback | Deploy SHA/digest, release metadata và retention |
| GHCR/Internet không truy cập được từ host | Host readiness test; mirror/export image là phương án dự phòng có runbook |
| Một host là SPOF | Backup ngoài host; ghi nhận giới hạn MVP; HA hạ tầng là phase riêng |
| Secret lộ trong Git/log/image | Secret scan, least privilege, masked secrets và image inspection |

## 11. Các quyết định cần chủ hệ thống xác nhận

1. GitHub organization/repository và GHCR image sẽ private hay public.
2. Thông số host staging/production, kiến trúc CPU, DNS và quyền SSH.
3. PostgreSQL chạy cùng host bằng Compose hay dùng máy/dịch vụ DB riêng.
4. Reverse proxy lựa chọn Caddy hay Nginx.
5. Cơ chế production deployment: GitHub-hosted runner SSH vào host, self-hosted runner, hay admin chạy pull script thủ công. Baseline an toàn cho MVP là admin-triggered deploy với GitHub Environment approval và credential tối thiểu.
6. RTO/RPO, lịch backup, nơi lưu backup ngoài host và maintenance window.
7. MVP dùng local demo auth đến M6 hay cần Entra ID sớm hơn.

## 12. Trình tự bắt đầu đề xuất

1. Review và chốt bảy quyết định ở mục 11.
2. Tạo ADR-001 cho deployment topology và ADR-002 cho scenario versioning.
3. Tạo backlog/traceability matrix từ SOP.
4. Triển khai M0, chỉ bootstrap và CI foundation.
5. Chạy toàn bộ gate trên local và pull request mẫu.
6. Publish image thử lên GHCR và deploy staging hello/health build.
7. Khi pipeline foundation ổn định mới bắt đầu M1 Inventory + Catalog.

## 13. Tài liệu kỹ thuật chính thức đã đối chiếu

- Next.js 16 installation/runtime: https://nextjs.org/docs/app/getting-started/installation
- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
- Prisma ORM 7 requirements: https://docs.prisma.io/docs/orm/reference/system-requirements
- Prisma 7 upgrade/ESM/driver adapter: https://docs.prisma.io/docs/orm/v6/more/upgrades/to-v7
- GitHub Actions publish container images: https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Docker Compose production guidance: https://docs.docker.com/compose/how-tos/production/

## 14. Tích hợp SOP-SC181-002

Trình tự network/spatial thống nhất được quản lý tại `documents/roadmap/SC181-integrated-roadmap.md`. Trước migration M1, các quyết định scenario ownership, canonical spatial coordinates và object-storage/worker boundary được khóa bằng ADR-0002, ADR-0003 và ADR-0004.
