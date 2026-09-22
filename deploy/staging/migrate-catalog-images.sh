#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
docker cp migrate-catalog-images.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/migrate-catalog-images.js
docker cp editorial-images.json "$backend":/tmp/editorial-images.json
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/migrate-catalog-images.js > image-migration.log 2>&1 || result=$?
docker cp "$backend":/tmp/rustic-halo-image-migration.json image-migration-report.json
chown shawnhouse:shawnhouse image-migration-report.json
if [ "$result" != 0 ]; then echo 'IMAGE_MIGRATION_FAILED; inspect private log'; exit "$result"; fi
grep -E '^(IMAGE_INVENTORY|CATALOG_IMAGES_MIGRATED)' image-migration.log
