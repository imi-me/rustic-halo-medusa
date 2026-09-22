#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp organize-catalog-drafts.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/organize-catalog-drafts.js
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/organize-catalog-drafts.js > catalog-organization.log 2>&1 || result=$?
docker cp "$backend":/tmp/catalog-organization.json catalog-organization.json
chown shawnhouse:shawnhouse catalog-organization.json
if [ "$result" != 0 ]; then echo 'ORGANIZATION_NEEDS_REVIEW'; exit "$result"; fi
grep '^CATALOG_ORGANIZED ' catalog-organization.log
