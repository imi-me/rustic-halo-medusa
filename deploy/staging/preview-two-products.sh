#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp online-drafts-setup.json "$backend":/tmp/online-drafts-setup.json
docker cp preview-two-products.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/preview-two-products.js
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/preview-two-products.js > two-product-preview.log 2>&1 || result=$?
if docker cp "$backend":/tmp/two-product-preview.json two-product-preview.json; then chown shawnhouse:shawnhouse two-product-preview.json; fi
if [ "$result" != 0 ]; then echo 'Preview needs review; inspect two-product-preview.log'; exit "$result"; fi
grep '^STAGING_PREVIEW_READY ' two-product-preview.log
