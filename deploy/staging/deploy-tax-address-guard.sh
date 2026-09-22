#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec > tax-address-guard-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
cp source/apps/backend/src/lib/tax/validate-cart.ts "validate-cart-before-$(date -u +%Y%m%dT%H%M%SZ).ts"
cp validate-cart-next.ts source/apps/backend/src/lib/tax/validate-cart.ts
compose build backend
compose up -d --no-deps --wait --wait-timeout 180 backend
echo TAX_ADDRESS_GUARD_DEPLOYED
