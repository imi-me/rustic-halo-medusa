#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
exec 9>catalog-import.lock
flock -n 9 || { echo 'Another catalog operation is running'; exit 1; }
trap 'chown shawnhouse:shawnhouse variant-label-deployment.log' EXIT
exec > variant-label-deployment.log 2>&1
compose() { docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; }
file=apps/storefront/src/modules/common/components/line-item-options/index.tsx
stamp=$(date -u +%Y%m%dT%H%M%SZ)
cp "source/$file" "variant-label-before-$stamp.tsx"
old_image=$(docker inspect --format '{{.Image}}' rustic-halo-staging-storefront-1)
docker tag "$old_image" "rustic-halo-storefront-before-label:$stamp"
cp variant-label.tsx "source/$file"
compose config --quiet
compose build storefront
compose up -d --no-deps --wait --wait-timeout 180 storefront
python3 - <<'PY'
import time, urllib.request
for path in ['/us/products/striped-pumpkin-studs','/us/products/coffee-cup-hair-clip','/us/cart']:
    for attempt in range(6):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18000'+path,timeout=15) as r:
                assert r.status == 200
            break
        except (OSError, AssertionError):
            if attempt == 5:
                raise
            time.sleep(2)
PY
date -u '+VARIANT_LABEL_DEPLOYED %Y-%m-%dT%H:%M:%SZ' > variant-label-status.txt
chown shawnhouse:shawnhouse variant-label-status.txt
cat variant-label-status.txt
