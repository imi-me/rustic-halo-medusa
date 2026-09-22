#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
exec > preview-storefront-deployment.log 2>&1
compose() { docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf "preview-source-before-$stamp.tgz" -C source \
  deploy/staging/Dockerfile apps/storefront/src/lib/config.ts \
  apps/storefront/src/modules/store/components/refinement-list/options-picker/index.tsx
old_image=$(docker inspect --format '{{.Image}}' rustic-halo-staging-storefront-1)
docker tag "$old_image" "rustic-halo-storefront-before-preview:$stamp"
printf '%s\n' "rustic-halo-storefront-before-preview:$stamp" > preview-previous-image.txt
for file in deploy/staging/Dockerfile apps/storefront/src/lib/config.ts \
  apps/storefront/src/lib/data/product-options.ts \
  apps/storefront/src/modules/store/components/refinement-list/options-picker/index.tsx; do
  cp "preview-source/$file" "source/$file"
done
cp preview-source/deploy/staging/compose.preview.yaml compose.preview.yaml
compose config --quiet
compose build storefront
compose up -d --no-deps --wait --wait-timeout 180 storefront
python3 - <<'PY'
import json, subprocess, time, urllib.request
for url in ['http://127.0.0.1:18000/us', 'http://127.0.0.1:19000/health']:
    for attempt in range(30):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                assert response.status == 200
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(2)
def networks(name):
    return json.loads(subprocess.check_output(['docker','inspect',name]))[0]['NetworkSettings']['Networks']
assert 'rustic-halo-preview_default' in networks('rustic-halo-staging-storefront-1')
for name in ['backend','postgres','redis']:
    assert 'rustic-halo-preview_default' not in networks('rustic-halo-staging-'+name+'-1')
print('PREVIEW_STOREFRONT_DEPLOYED_PRIVATE_BACKEND_VERIFIED')
PY
