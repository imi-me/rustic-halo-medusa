#!/bin/sh
set -eu
umask 077
request=${1:-}
test -n "$request" || { echo 'Usage: add-hair-claw-color.sh REVIEW_REQUEST.json'; exit 2; }
test -f "$request"
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-hair-claw.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp add-hair-claw-color.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/add-hair-claw-color.js
docker cp hair-claw-catalog.cjs "$backend":/tmp/hair-claw-catalog.cjs
docker cp hair-claw-color-policy.json "$backend":/tmp/hair-claw-color-policy.json
docker cp "$request" "$backend":/tmp/hair-claw-color-request.json
mode=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("mode", "preview"))' "$request")
result=0
if [ "$mode" = apply ]; then
  compose exec -T -e HAIR_CLAW_COLOR_APPLY=yes backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/add-hair-claw-color.js > hair-claw-color-change.log 2>&1 || result=$?
else
  compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/add-hair-claw-color.js > hair-claw-color-change.log 2>&1 || result=$?
fi
docker cp "$backend":/tmp/hair-claw-color-change.json hair-claw-color-change.json 2>/dev/null || true
test ! -f hair-claw-color-change.json || chown shawnhouse:shawnhouse hair-claw-color-change.json
if [ "$result" != 0 ]; then
  echo 'HAIR_CLAW_COLOR_NEEDS_REVIEW'
  tail -25 hair-claw-color-change.log
  exit "$result"
fi
grep '^HAIR_CLAW_COLOR_' hair-claw-color-change.log
