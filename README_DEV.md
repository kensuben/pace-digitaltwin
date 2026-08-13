# Developer Guide

## Milestone hiện tại

SP-1 đã triển khai PDF ingestion bằng PDF.js trên nền M1/SP-0/M2. Bước kế tiếp là M3 LAG/VLAN/IP; editor spatial 2D/3D và Model Swap chưa được triển khai.

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
- PhysicalLink cùng composite scenario FK, audit log mutation, topology read model/API và React Flow editor lưu node/link.
- PDF upload bất biến, PostgreSQL job queue, Node PDF worker, WebP preview/thumbnail và page-to-floor mapping.

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

Sau đó mở `http://localhost:3000`. `npm run dev` dùng Webpack HMR để đồng bộ
với production build và tránh lỗi WebSocket của Turbopack trong một số môi
trường local. Chỉ dùng `npm run dev:turbopack` khi cần thử riêng Turbopack.
Endpoint:

- `GET /api/health/live`: process đang chạy;
- `GET /api/health/ready`: ứng dụng kết nối được PostgreSQL.

Filesystem object storage mặc định nằm ngoài source tree tại `/tmp/pace-digitaltwin-objects`. Có thể đổi bằng `OBJECT_STORAGE_ROOT`; adapter này chỉ dành cho local/CI và chủ ý fail-closed khi `APP_ENV=production`.

Chạy PDF worker trong terminal riêng:

```bash
npm run worker:pdf
```

`npm run worker:pdf:once` claim tối đa một job, phù hợp CI và kiểm tra thủ công. Worker dùng PDF.js + `@napi-rs/canvas`, không mở public port và không thực hiện OCR/vector extraction.

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

M1 có hai migration domain; SP-0 bổ sung migration spatial; M2 bổ sung migration topology với PhysicalLink, AuditLog và composite FK liên kết CableRoute cùng scenario. Seed tạo 1 campus, 13 floors, 13 canonical coordinate systems, 13 blank floor maps, 5 vendor models, Baseline/Proposed scenarios, 8 devices và 232 generated ports. Elevation và kích thước tầng vẫn để trống vì chưa có evidence.

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

## Application routes

- UI: `/catalog`, `/catalog/[modelId]`, `/inventory`, `/inventory/[deviceId]?scenarioId=...`;
- API: `GET/POST /api/catalog`, `GET/PATCH/DELETE /api/catalog/[modelId]`;
- API: `GET/POST /api/inventory`, `GET/PATCH/DELETE /api/inventory/[deviceId]?scenarioId=...`.
- SP-0 API: `GET/POST /api/drawings`, `GET/PATCH/DELETE /api/drawings/[drawingId]` (metadata CRUD; chưa upload binary).
- M2 UI: `/topology`, `/topology/[scenarioId]`; API: `GET/PATCH /api/scenarios/[scenarioId]/topology`, `POST /api/links`, `PATCH/DELETE /api/links/[linkId]?scenarioId=...`.
- SP-1 UI: `/drawings`, `/drawings/[drawingId]`; API upload revision, preview/thumbnail và page-to-floor mapping nằm dưới `/api/drawings` và `/api/drawing-pages`.

Vendor model seed là read-only qua M1 API. Custom model được gắn `USER_CONFIRMED`. Mọi mutation inventory bắt buộc scenario context và bị chặn nếu scenario locked.

## Architecture boundaries

- Route Handler chỉ parse request/format response và gọi service.
- Service chứa orchestration/business rules, không phụ thuộc HTTP.
- Repository là lớp duy nhất truy cập Prisma/database.
- Thuật toán thuần đặt ở `src/domain` hoặc `src/lib` để unit test độc lập.
- Prisma database là source of truth; UI graph chỉ là view/editor.
- Physical link luôn có hai Port endpoint trong cùng Scenario; locked Scenario chặn link và position mutation.
- Binary PDF/GLB không lưu trong PostgreSQL; mọi truy cập object đi qua `ObjectStorage`.
- PDF source giới hạn 50 MiB/200 pages, kiểm tra MIME và `%PDF-`; preview giới hạn pixel/bytes và PDF JavaScript evaluation bị tắt.
- Tọa độ spatial persist bằng mét với axis `X_RIGHT/Y_DOWN/Z_UP`; screen/PDF pixels không dùng làm canonical placement.

## CI/CD foundation

- `.github/workflows/ci.yml`: chạy migration trên PostgreSQL sạch, lint, typecheck, coverage, build, E2E smoke và build cả hai Docker target trên PR/push main.
- `.github/workflows/image.yml`: publish cặp `sha-<commit>` và `sha-<commit>-migrator`; SemVer tag chỉ sinh từ release tag.
- `deploy/compose.prod.yaml`: host chỉ pull image; không build source.
- `deploy/scripts/deploy.sh`: pull cả hai image, chạy `prisma migrate deploy` one-shot, sau đó start/health-wait application.
