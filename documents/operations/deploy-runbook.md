# Deployment Runbook — Foundation

## Host prerequisites

- Ubuntu Server được patch;
- Docker Engine và Docker Compose plugin v2;
- outbound HTTPS tới `ghcr.io`;
- GHCR token chỉ có quyền đọc package nếu image private;
- thư mục deployment riêng, file `.env` mode `600`;
- backup ngoài host trước migration có rủi ro.

## First-time setup

1. Copy `deploy/compose.prod.yaml`, `deploy/env.example` và `deploy/scripts/deploy.sh` lên host.
2. Tạo `deploy/.env`, thay toàn bộ placeholder và chạy `chmod 600 deploy/.env`.
3. Login GHCR bằng service account/read-only token.
4. Đặt `APP_IMAGE` và `MIGRATOR_IMAGE` thành cặp tag cùng full commit SHA đã qua staging.
5. Hoàn thành backup/restore check theo mức rủi ro của migration trước khi deploy.

## Deploy

```bash
bash deploy/scripts/deploy.sh /absolute/path/to/deploy
```

Script pull application/migrator image, chạy `prisma migrate deploy` one-shot, start stack không build và đợi Docker health checks. Nếu migration thất bại, script dừng trước khi thay application đang chạy.

## Verify

```bash
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
docker compose --env-file deploy/.env -f deploy/compose.prod.yaml ps
```

Không public cổng 3000 trực tiếp; reverse proxy/TLS sẽ được chốt bằng ADR hạ tầng.

## Rollback M0

1. Xác nhận schema hiện tại còn tương thích với release trước; không tự động downgrade database.
2. Đặt cả `APP_IMAGE` và `MIGRATOR_IMAGE` trong `deploy/.env` về cặp SHA/digest đã duyệt.
3. Chạy lại deploy script.
4. Kiểm tra liveness/readiness và log.

Không rollback schema tự động. Khi M1 có migration, mọi release phải ghi rõ database compatibility và forward-fix procedure.
