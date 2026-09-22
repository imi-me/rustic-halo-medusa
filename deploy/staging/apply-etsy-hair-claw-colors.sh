#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>etsy-catalog-write.lock
flock -n 9 || { echo 'Etsy catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp apply-etsy-hair-claw-colors.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/apply-etsy-hair-claw-colors.js
docker cp hair-claw-color-plan.json "$backend":/tmp/hair-claw-color-plan.json
docker cp etsy-hair-claw-inventory-preflight.json "$backend":/tmp/etsy-hair-claw-inventory-preflight.json
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/apply-etsy-hair-claw-colors.js > etsy-hair-claw-colors.log 2>&1 || result=$?
docker cp "$backend":/tmp/etsy-hair-claw-colors.json etsy-hair-claw-colors.json 2>/dev/null || true
chown shawnhouse:shawnhouse etsy-hair-claw-colors.log
test ! -f etsy-hair-claw-colors.json || chown shawnhouse:shawnhouse etsy-hair-claw-colors.json
if [ "$result" != 0 ]; then
  echo 'ETSY_HAIR_CLAW_COLORS_NEED_REVIEW'
  tail -25 etsy-hair-claw-colors.log
  exit "$result"
fi
grep '^ETSY_HAIR_CLAW_COLORS_READY ' etsy-hair-claw-colors.log
