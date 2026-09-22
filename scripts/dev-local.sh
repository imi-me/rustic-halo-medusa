#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.local/node-v22.23.2-darwin-arm64/bin:$ROOT/.local/pnpm/node_modules/.bin:$ROOT/.local/postgres/bin:$PATH"
export MEDUSA_DISABLE_TELEMETRY=true
export NEXT_TELEMETRY_DISABLED=1
export XDG_CONFIG_HOME="$ROOT/.local/config"
export XDG_CACHE_HOME="$ROOT/.local/cache"
cd "$ROOT"
case "${1:-help}" in
  db-start)
    if pg_ctl -D "$ROOT/.local/pgdata" status >/dev/null 2>&1; then
      echo "Project PostgreSQL is already running."
    else
      pg_ctl -D "$ROOT/.local/pgdata" -l "$ROOT/.local/logs/postgres.log" -w start
    fi
    ;;
  db-stop) pg_ctl -D "$ROOT/.local/pgdata" -m fast -w stop ;;
  backend)
    bash "$0" db-start
    cd apps/backend
    exec pnpm exec medusa develop --host 127.0.0.1
    ;;
  storefront)
    cd apps/storefront
    exec pnpm exec next dev --turbopack -p 8000 --hostname 127.0.0.1
    ;;
  pnpm) shift; exec pnpm "$@" ;;
  *) echo "Usage: bash scripts/dev-local.sh {db-start|db-stop|backend|storefront|pnpm ...}" ;;
esac
