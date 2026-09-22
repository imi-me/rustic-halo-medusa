#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-color-variants.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp apply-boho-color-variants.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/apply-boho-color-variants.js
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/apply-boho-color-variants.js > boho-color-variants.log 2>&1 || result=$?
docker cp "$backend":/tmp/boho-color-variants.json boho-color-variants.json 2>/dev/null || true
docker cp "$backend":/tmp/boho-color-preflight.json boho-color-preflight.json 2>/dev/null || true
test ! -f boho-color-variants.json || chown shawnhouse:shawnhouse boho-color-variants.json
test ! -f boho-color-preflight.json || chown shawnhouse:shawnhouse boho-color-preflight.json
if [ "$result" != 0 ]; then
  echo 'BOHO_COLOR_VARIANTS_NEED_REVIEW'
  tail -20 boho-color-variants.log
  exit "$result"
fi
grep '^BOHO_COLOR_VARIANTS_READY ' boho-color-variants.log
