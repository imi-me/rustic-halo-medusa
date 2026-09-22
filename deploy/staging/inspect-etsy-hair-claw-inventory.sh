#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp inspect-etsy-hair-claw-inventory.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/inspect-etsy-hair-claw-inventory.js
docker cp hair-claw-color-plan.json "$backend":/tmp/hair-claw-color-plan.json
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/inspect-etsy-hair-claw-inventory.js > etsy-hair-claw-inventory-preflight.log 2>&1
docker cp "$backend":/tmp/etsy-hair-claw-inventory-preflight.json etsy-hair-claw-inventory-preflight.json
chown shawnhouse:shawnhouse etsy-hair-claw-inventory-preflight.json
chmod 600 etsy-hair-claw-inventory-preflight.json
grep '^ETSY_HAIR_CLAW_PREFLIGHT_READY ' etsy-hair-claw-inventory-preflight.log
