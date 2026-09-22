#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog import already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp import-catalog-drafts.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/import-catalog-drafts.js
docker cp shopify-import-snapshot.json "$backend":/tmp/shopify-import-snapshot.json
result=0
compose exec -T -e CATALOG_IMPORT_DRAFTS=yes backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/import-catalog-drafts.js > catalog-draft-import.log 2>&1 || result=$?
docker cp "$backend":/tmp/catalog-draft-import.json catalog-draft-import.json
chown shawnhouse:shawnhouse catalog-draft-import.json
if [ "$result" != 0 ]; then echo 'IMPORT_STOPPED; inspect catalog-draft-import.log'; exit "$result"; fi
grep '^CATALOG_IMPORTED ' catalog-draft-import.log
