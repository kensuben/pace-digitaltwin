#!/usr/bin/env bash
set -euo pipefail

deploy_dir="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
env_file="${deploy_dir}/.env"
compose_file="${deploy_dir}/compose.prod.yaml"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}; copy env.example and provide production values." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin v2 is required." >&2
  exit 1
fi

docker compose --env-file "${env_file}" -f "${compose_file}" --profile tools pull app migrate
docker compose --env-file "${env_file}" -f "${compose_file}" --profile tools run --rm migrate
docker compose --env-file "${env_file}" -f "${compose_file}" up -d --no-build --wait --wait-timeout 120
docker compose --env-file "${env_file}" -f "${compose_file}" ps
