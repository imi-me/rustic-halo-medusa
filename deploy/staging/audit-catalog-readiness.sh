#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp audit-catalog-readiness.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/audit-catalog-readiness.js
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/audit-catalog-readiness.js > catalog-readiness.log 2>&1 || { echo 'Readiness check failed; inspect catalog-readiness.log'; exit 1; }
docker cp "$backend":/tmp/catalog-readiness.json catalog-readiness.json
chown shawnhouse:shawnhouse catalog-readiness.json
grep '^CATALOG_READINESS ' catalog-readiness.log
