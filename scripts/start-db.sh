#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/packages/backend/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" up db -d "$@"

echo "Postgres is starting (postgres://postgres:postgres@localhost:5433/tier_list_league)"
