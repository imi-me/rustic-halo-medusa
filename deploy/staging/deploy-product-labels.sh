#!/bin/sh
set -eu
umask 077

base=/home/shawnhouse/rustic-halo-staging
cd "$base"
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
[ -f product-labels-source.tgz ] || { echo 'Product-label source archive missing.' >&2; exit 1; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="product-labels-before-$stamp.tgz"
set -- source/apps/backend/package.json source/pnpm-lock.yaml
[ ! -d source/apps/label-printing ] || set -- "$@" source/apps/label-printing
[ ! -f source/apps/backend/src/admin/routes/product-labels/page.tsx ] || set -- "$@" source/apps/backend/src/admin/routes/product-labels/page.tsx
tar -czf "$backup" "$@"

exec > product-labels-deployment.log 2>&1
tar -xzf product-labels-source.tgz -C source

compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}

compose build --no-cache backend
compose up -d --no-deps --wait --wait-timeout 180 backend
python3 - <<'PY'
import urllib.request
with urllib.request.urlopen('http://127.0.0.1:19000/health', timeout=10) as response:
    assert response.status == 200
print('PRODUCT_LABELS_DEPLOYED')
PY
