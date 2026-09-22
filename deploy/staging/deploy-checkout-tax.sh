#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
umask 077
exec > checkout-tax-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
compose config --quiet
# Build both images before replacing either running service.
compose build backend storefront
compose up -d --no-deps --wait --wait-timeout 180 backend
compose up -d --no-deps storefront
compose ps
printf '\nCHECKOUT_TAX_DEPLOYMENT_COMPLETE\n'
