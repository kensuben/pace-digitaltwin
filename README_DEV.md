# Developer Guide

## Milestone hiện tại

M0.1 đã hoàn thiện foundation và chốt ranh giới kiến trúc giữa network/spatial trước migration domain đầu tiên. Chưa triển khai Inventory, Catalog, Topology hoặc spatial domain.

Đã có:

- Next.js 16 App Router, React 19, TypeScript strict và Tailwind CSS 4;
- shadcn/ui foundation, token màu dùng chung và component smoke test;
- Prisma ORM 7/PostgreSQL adapter và schema scaffold;
- ranh giới Route -> Service -> Repository qua health check;
- Vitest unit test và Playwright smoke test;
- Docker multi-stage với application image và one-shot migrator image;
- GitHub Actions cho quality gate và publish image lên GHCR.

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
npm run dev
```

Nếu PostgreSQL chạy bằng Docker, có thể chỉ bật database:

```bash
docker compose up -d postgres
```

Sau đó mở `http://localhost:3000`. Endpoint:

- `GET /api/health/live`: process đang chạy;
- `GET /api/health/ready`: ứng dụng kết nối được PostgreSQL.

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

M0.1 chỉ tạo Prisma scaffold; domain schema/migration đầu tiên thuộc M1. ADR scenario/versioning, tọa độ và storage/worker đã được chốt trước bước đó.

Các lệnh mục tiêu:

```bash
npm run db:migrate   # local development only
npm run db:deploy    # staging/production only
npm run db:seed
```

Không dùng `prisma migrate dev` trên staging hoặc production.

## Architecture boundaries

- Route Handler chỉ parse request/format response và gọi service.
- Service chứa orchestration/business rules, không phụ thuộc HTTP.
- Repository là lớp duy nhất truy cập Prisma/database.
- Thuật toán thuần đặt ở `src/domain` hoặc `src/lib` để unit test độc lập.
- Prisma database là source of truth; UI graph chỉ là view/editor.

## CI/CD foundation

- `.github/workflows/ci.yml`: chạy migration trên PostgreSQL sạch, lint, typecheck, coverage, build, E2E smoke và build cả hai Docker target trên PR/push main.
- `.github/workflows/image.yml`: publish cặp `sha-<commit>` và `sha-<commit>-migrator`; SemVer tag chỉ sinh từ release tag.
- `deploy/compose.prod.yaml`: host chỉ pull image; không build source.
- `deploy/scripts/deploy.sh`: pull cả hai image, chạy `prisma migrate deploy` one-shot, sau đó start/health-wait application.
