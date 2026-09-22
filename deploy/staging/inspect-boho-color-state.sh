#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp inspect-boho-color-state.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/inspect-boho-color-state.js
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/inspect-boho-color-state.js 2>&1 | grep '^BOHO_STATE ' > boho-state.jsonl
chown shawnhouse:shawnhouse boho-state.jsonl
cat boho-state.jsonl
