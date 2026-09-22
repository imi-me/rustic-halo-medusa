#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-color-variants.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp apply-medusa-hair-claw-colors.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/apply-medusa-hair-claw-colors.js
docker cp hair-claw-color-plan.json "$backend":/tmp/hair-claw-color-plan.json
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/apply-medusa-hair-claw-colors.js > medusa-hair-claw-colors.log 2>&1 || result=$?
docker cp "$backend":/tmp/medusa-hair-claw-colors.json medusa-hair-claw-colors.json 2>/dev/null || true
test ! -f medusa-hair-claw-colors.json || chown shawnhouse:shawnhouse medusa-hair-claw-colors.json
if [ "$result" != 0 ]; then
  echo 'MEDUSA_HAIR_CLAW_COLORS_NEED_REVIEW'
  tail -25 medusa-hair-claw-colors.log
  exit "$result"
fi
grep '^MEDUSA_HAIR_CLAW_COLORS_READY ' medusa-hair-claw-colors.log
