#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp preview-catalog-import.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/preview-catalog-import.js
docker cp shopify-import-snapshot.json "$backend":/tmp/shopify-import-snapshot.json
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/preview-catalog-import.js > catalog-import-preview.log 2>&1
docker cp "$backend":/tmp/catalog-import-preview.json catalog-import-preview.json
chown shawnhouse:shawnhouse catalog-import-preview.json
grep '^CATALOG_PREVIEW ' catalog-import-preview.log
