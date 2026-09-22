#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp apply-accessory-weights.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/apply-accessory-weights.js
docker cp confirmed-accessory-weights.json "$backend":/tmp/confirmed-accessory-weights.json
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/apply-accessory-weights.js > accessory-weight-update.log 2>&1 || result=$?
docker cp "$backend":/tmp/accessory-weight-update.json accessory-weight-update.json
chown shawnhouse:shawnhouse accessory-weight-update.json
if [ "$result" != 0 ]; then echo 'WEIGHT_UPDATE_NEEDS_REVIEW'; exit "$result"; fi
grep '^ACCESSORY_WEIGHTS_UPDATED ' accessory-weight-update.log
