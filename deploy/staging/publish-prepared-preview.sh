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
docker cp publish-prepared-preview.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/publish-prepared-preview.js
trap 'chown shawnhouse:shawnhouse catalog-preview-publication.log' EXIT
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/publish-prepared-preview.js > catalog-preview-publication.log 2>&1 || result=$?
if docker cp "$backend":/tmp/catalog-preview-publication.json catalog-preview-publication.json; then chown shawnhouse:shawnhouse catalog-preview-publication.json; fi
if [ "$result" != 0 ]; then echo 'Preview needs review; inspect catalog-preview-publication.log'; exit "$result"; fi
grep '^CATALOG_PREVIEW_READY ' catalog-preview-publication.log
