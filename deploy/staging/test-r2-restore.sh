#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
source=image-backups/20260920T231050Z-60149
test -f "$source/manifest.json"
work=/tmp/rustic-halo-restore-check-$(date -u +%s)-$$
backend=$(compose ps -q backend)
docker cp "$source" "$backend:$work"
compose exec -T --user 0 -w /app/apps/backend/.medusa/server backend node - "$work" < test-r2-restore.cjs
compose exec -T --user 0 backend node -e 'require("fs").rmSync(process.argv[1],{recursive:true})' "$work"
