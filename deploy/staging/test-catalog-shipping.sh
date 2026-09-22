#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
backend=$(compose ps -q backend)
test -n "$backend"
docker cp test-catalog-shipping.cjs "$backend":/app/apps/backend/.medusa/server/src/scripts/test-catalog-shipping.js
result=0
compose exec -T backend /app/apps/backend/node_modules/.bin/medusa exec ./src/scripts/test-catalog-shipping.js > catalog-shipping-test.log 2>&1 || result=$?
docker cp "$backend":/tmp/catalog-shipping-test.json catalog-shipping-test.json
chown shawnhouse:shawnhouse catalog-shipping-test.json
if [ "$result" != 0 ]; then echo 'SHIPPING_TEST_NEEDS_REVIEW'; exit "$result"; fi
grep '^CATALOG_SHIPPING_TEST ' catalog-shipping-test.log
