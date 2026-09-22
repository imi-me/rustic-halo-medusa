#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp prepare-online-drafts.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/prepare-online-drafts.js
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/prepare-online-drafts.js > online-drafts-setup.log 2>&1 || result=$?
if docker cp "$backend":/tmp/online-drafts-setup.json online-drafts-setup.json; then chown shawnhouse:shawnhouse online-drafts-setup.json; fi
if [ "$result" != 0 ]; then echo 'Online setup needs review; inspect online-drafts-setup.log'; exit "$result"; fi
grep '^ONLINE_DRAFTS_PREPARED ' online-drafts-setup.log
