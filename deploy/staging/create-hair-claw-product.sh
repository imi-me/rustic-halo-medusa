#!/bin/sh
set -eu
umask 077
request=${1:-}
test -n "$request" || { echo 'Usage: create-hair-claw-product.sh REVIEWED_REQUEST.json'; exit 2; }
test -f "$request"
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-hair-claw.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp create-hair-claw-product.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/create-hair-claw-product.js
docker cp hair-claw-catalog.cjs "$backend":/tmp/hair-claw-catalog.cjs
docker cp hair-claw-color-policy.json "$backend":/tmp/hair-claw-color-policy.json
docker cp "$request" "$backend":/tmp/hair-claw-product-request.json
result=0
compose exec -T -e HAIR_CLAW_PRODUCT_CREATE=yes backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/create-hair-claw-product.js > hair-claw-product-create.log 2>&1 || result=$?
docker cp "$backend":/tmp/hair-claw-product-create.json hair-claw-product-create.json 2>/dev/null || true
test ! -f hair-claw-product-create.json || chown shawnhouse:shawnhouse hair-claw-product-create.json
if [ "$result" != 0 ]; then
  echo 'HAIR_CLAW_DRAFT_NEEDS_REVIEW'
  tail -25 hair-claw-product-create.log
  exit "$result"
fi
grep '^HAIR_CLAW_DRAFT_CREATED ' hair-claw-product-create.log
