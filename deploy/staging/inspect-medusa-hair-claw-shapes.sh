#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
docker cp inspect-medusa-hair-claw-shapes.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/inspect-medusa-hair-claw-shapes.js
docker cp hair-claw-color-plan.json "$backend":/tmp/hair-claw-color-plan.json
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/inspect-medusa-hair-claw-shapes.js > medusa-hair-claw-shapes.log 2>&1
docker cp "$backend":/tmp/medusa-hair-claw-shapes.json medusa-hair-claw-shapes.json
chown shawnhouse:shawnhouse medusa-hair-claw-shapes.json
grep '^MEDUSA_HAIR_CLAW_SHAPES_READY ' medusa-hair-claw-shapes.log
