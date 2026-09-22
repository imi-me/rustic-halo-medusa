#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
exec 9>catalog-import.lock
flock -n 9 || { echo 'Another catalog operation is running'; exit 1; }
trap 'chown shawnhouse:shawnhouse product-options-ui-deployment.log' EXIT
exec > product-options-ui-deployment.log 2>&1
compose() { docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="product-options-ui-before-$stamp"
mkdir "$backup"
for file in \
  apps/storefront/src/lib/util/product-options.ts \
  apps/storefront/src/modules/products/components/product-actions/index.tsx \
  apps/storefront/src/modules/products/components/product-actions/mobile-actions.tsx; do
  if [ -f "source/$file" ]; then
    mkdir -p "$backup/$(dirname "$file")"
    cp "source/$file" "$backup/$file"
  fi
  cp "$file" "source/$file"
done
old_image=$(docker inspect --format '{{.Image}}' rustic-halo-staging-storefront-1)
docker tag "$old_image" "rustic-halo-storefront-before-product-options:$stamp"
compose config --quiet
compose build storefront
compose up -d --no-deps --wait --wait-timeout 180 storefront
python3 - <<'PY'
import time, urllib.request
for path in ['/us', '/us/store?q=Floral', '/us/products/scalloped-beach-hair-claw', '/us/cart']:
    for attempt in range(12):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18000' + path, timeout=15) as response:
                assert response.status == 200
            break
        except Exception:
            if attempt == 11:
                raise
            time.sleep(2)
PY
date -u '+PRODUCT_OPTIONS_UI_DEPLOYED %Y-%m-%dT%H:%M:%SZ' > product-options-ui-status.txt
chown shawnhouse:shawnhouse product-options-ui-status.txt
cat product-options-ui-status.txt
