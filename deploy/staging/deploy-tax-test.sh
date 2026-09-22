#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
if [ "$(id -u)" != 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
umask 077
exec > tax-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
compose build backend
compose run --rm --user root -e STRIPE_TAX_TEST_ENABLED=true backend /app/apps/backend/node_modules/.bin/medusa exec /app/apps/backend/.medusa/server/src/scripts/setup-stripe-tax-test.js
if ! grep -q '^STRIPE_TAX_TEST_ENABLED=' backend.env; then
  printf '\nSTRIPE_TAX_TEST_ENABLED=true\n' >> backend.env
else
  sed -i 's/^STRIPE_TAX_TEST_ENABLED=.*/STRIPE_TAX_TEST_ENABLED=true/' backend.env
fi
compose up -d --wait --wait-timeout 180 backend
echo TAX_TEST_DEPLOYMENT_COMPLETE
