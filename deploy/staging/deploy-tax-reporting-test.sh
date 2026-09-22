#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
exec > tax-reporting-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
compose build backend
if ! grep -q '^STRIPE_TAX_REPORTING_TEST_ENABLED=' backend.env; then
 printf '\nSTRIPE_TAX_REPORTING_TEST_ENABLED=true\n' >> backend.env
else
 sed -i 's/^STRIPE_TAX_REPORTING_TEST_ENABLED=.*/STRIPE_TAX_REPORTING_TEST_ENABLED=true/' backend.env
fi
compose up -d --wait --wait-timeout 180 backend
echo TAX_REPORTING_TEST_DEPLOYED
