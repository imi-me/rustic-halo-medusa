#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "$(id -u)" != 0 ]; then
  echo 'Run this script with sudo.' >&2
  exit 1
fi
umask 077
exec > deployment.log 2>&1
trap 'echo "Deployment stopped; review deployment.log"' 0
compose() {
  if [ -f compose.preview.yaml ] && [ -f compose.lan.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml -f compose.lan.yaml "$@"
  elif [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  elif [ -f compose.lan.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.lan.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
compose config --quiet
compose up -d --wait postgres redis
if [ ! -f .database-imported ]; then
  count=$(compose exec -T postgres psql -U rustic_halo -d rustic_halo_staging -Atc "select count(*) from information_schema.tables where table_schema='public'")
  if [ "$count" != 0 ]; then
    echo 'Refusing to import into a nonempty staging database.'
    exit 1
  fi
  compose exec -T postgres pg_restore -U rustic_halo -d rustic_halo_staging --no-owner --no-acl --exit-on-error < catalog.dump
  touch .database-imported
fi
compose build backend
compose run --rm --user root backend /app/apps/backend/node_modules/.bin/medusa db:migrate
compose up -d --wait --wait-timeout 180 backend
compose build storefront
compose up -d storefront
compose ps
echo 'STAGING_DEPLOYMENT_COMPLETE'
trap - 0
