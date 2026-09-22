#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp apply-studio-skus.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/apply-studio-skus.js
docker cp studio-sku-proposals.json "$backend":/tmp/studio-sku-proposals.json
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/apply-studio-skus.js > studio-sku-update.log 2>&1 || result=$?
docker cp "$backend":/tmp/studio-sku-update.json studio-sku-update.json
chown shawnhouse:shawnhouse studio-sku-update.json
if [ "$result" != 0 ]; then echo 'SKU_UPDATE_NEEDS_REVIEW'; exit "$result"; fi
grep '^STUDIO_SKUS_UPDATED ' studio-sku-update.log
