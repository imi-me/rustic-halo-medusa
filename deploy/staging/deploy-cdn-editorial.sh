#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec > cdn-editorial-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
cp source/apps/storefront/src/lib/brand/assets.ts "editorial-assets-before-$(date -u +%Y%m%dT%H%M%SZ).ts"
cp cdn-brand-assets.ts source/apps/storefront/src/lib/brand/assets.ts
compose build storefront
compose up -d --no-deps --wait --wait-timeout 180 storefront
sh backup-r2.sh
echo CDN_EDITORIAL_DEPLOYED_AND_BACKED_UP
