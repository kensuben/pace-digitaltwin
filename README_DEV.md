# Developer Guide

## Milestone hiện tại

SP-0 đã triển khai schema/storage foundation cho Building Spatial Digital Twin trên nền M1. PDF upload/rendering, worker, editor 2D/3D, topology, LAG/VLAN và Model Swap chưa được triển khai.

Đã có:

- Next.js 16 App Router, React 19, TypeScript strict và Tailwind CSS 4;
- shadcn/ui foundation, token màu dùng chung và component smoke test;
- Prisma ORM 7/PostgreSQL adapter và schema scaffold;
- ranh giới Route -> Service -> Repository qua health check;
- Vitest unit test và Playwright smoke test;
- Docker multi-stage với application image và one-shot migrator image;
- GitHub Actions cho quality gate và publish image lên GHCR.
- Prisma migrations M1, seed idempotent có evidence, Catalog/Inventory CRUD API và UI.
- Prisma spatial schema, canonical coordinate/calibration functions, DrawingDocument CRUD và filesystem ObjectStorage adapter cho development/CI.

## Yêu cầu máy phát triển

- Node.js 22 (xem `.nvmrc`);
- npm 10+;
- Docker Engine và Docker Compose plugin v2;
- PostgreSQL 17 nếu không dùng container.

Máy tạo M0 hiện có Docker Engine, Compose v2 và Buildx ở cấp user. User hiện tại được cấp ACL truy cập `/var/run/docker.sock`; ACL cần được cấu hình lại sau khi Docker socket được tạo lại nếu host chưa có policy cấp quyền bền vững.

## Chạy bằng Node.js

```bash
cp .env.example .env
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Nếu PostgreSQL chạy bằng Docker, có thể chỉ bật database:

```bash
docker compose up -d postgres
```

Sau đó mở `http://localhost:3000`. Endpoint:

- `GET /api/health/live`: process đang chạy;
- `GET /api/health/ready`: ứng dụng kết nối được PostgreSQL.

Filesystem object storage mặc định nằm ngoài source tree tại `/tmp/pace-digitaltwin-objects`. Có thể đổi bằng `OBJECT_STORAGE_ROOT`; adapter này chỉ dành cho local/CI và chủ ý fail-closed khi `APP_ENV=production`.

## Chạy toàn bộ bằng Compose

```bash
docker compose up --build
```

Compose local dùng credential development cố định và chỉ bind PostgreSQL/app vào loopback; không dùng file này cho production.

Chạy migration bằng đúng target container dùng trong CI/CD:

```bash
docker compose --profile tools run --rm --build migrate
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:e2e
docker build --target runner -t pace-digitaltwin:local .
docker build --target migrator -t pace-digitaltwin:local-migrator .
```

Playwright cần Chromium được cài một lần bằng `npx playwright install chromium`.

## Database

M1 có hai migration domain; SP-0 bổ sung một migration spatial với composite FK, CHECK constraint và partial unique index. Seed tạo 1 campus, 13 floors, 13 canonical coordinate systems, 13 blank floor maps, 5 vendor models, Baseline/Proposed scenarios, 8 devices và 232 generated ports. Elevation và kích thước tầng vẫn để trống vì chưa có evidence.

Các lệnh mục tiêu:

```bash
npm run db:migrate   # local development only
npm run db:deploy    # staging/production only
npm run db:seed
```

Không dùng `prisma migrate dev` trên staging hoặc production.

Seed có thể chạy lặp mà không xóa/recreate Port của device đã tồn tại. Production không tự động seed trong deploy thường lệ; lần khởi tạo dữ liệu được thực hiện có kiểm soát bằng migrator image:

```bash
docker compose --env-file deploy/.env -f deploy/compose.prod.yaml --profile tools run --rm migrate npm run db:seed
```

## M1 routes

- UI: `/catalog`, `/catalog/[modelId]`, `/inventory`, `/inventory/[deviceId]?scenarioId=...`;
- API: `GET/POST /api/catalog`, `GET/PATCH/DELETE /api/catalog/[modelId]`;
- API: `GET/POST /api/inventory`, `GET/PATCH/DELETE /api/inventory/[deviceId]?scenarioId=...`.
- SP-0 API: `GET/POST /api/drawings`, `GET/PATCH/DELETE /api/drawings/[drawingId]` (metadata CRUD; chưa upload binary).

Vendor model seed là read-only qua M1 API. Custom model được gắn `USER_CONFIRMED`. Mọi mutation inventory bắt buộc scenario context và bị chặn nếu scenario locked.

## Architecture boundaries

- Route Handler chỉ parse request/format response và gọi service.
- Service chứa orchestration/business rules, không phụ thuộc HTTP.
- Repository là lớp duy nhất truy cập Prisma/database.
- Thuật toán thuần đặt ở `src/domain` hoặc `src/lib` để unit test độc lập.
- Prisma database là source of truth; UI graph chỉ là view/editor.
- Binary PDF/GLB không lưu trong PostgreSQL; mọi truy cập object đi qua `ObjectStorage`.
- Tọa độ spatial persist bằng mét với axis `X_RIGHT/Y_DOWN/Z_UP`; screen/PDF pixels không dùng làm canonical placement.

## CI/CD foundation

- `.github/workflows/ci.yml`: chạy migration trên PostgreSQL sạch, lint, typecheck, coverage, build, E2E smoke và build cả hai Docker target trên PR/push main.
- `.github/workflows/image.yml`: publish cặp `sha-<commit>` và `sha-<commit>-migrator`; SemVer tag chỉ sinh từ release tag.
- `deploy/compose.prod.yaml`: host chỉ pull image; không build source.
- `deploy/scripts/deploy.sh`: pull cả hai image, chạy `prisma migrate deploy` one-shot, sau đó start/health-wait application.
