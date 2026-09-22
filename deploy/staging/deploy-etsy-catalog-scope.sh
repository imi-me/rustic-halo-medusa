#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
[ -f etsy-catalog-source.tgz ] || { echo 'Etsy catalog source archive missing.' >&2; exit 1; }
exec > etsy-catalog-scope-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; else docker compose -f compose.yaml -f compose.apps.yaml "$@"; fi
}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="etsy-catalog-scope-before-$stamp"
mkdir "$backup"
for path in \
  apps/backend/src/lib/etsy/oauth.ts \
  apps/backend/src/lib/etsy/__tests__/oauth.unit.spec.ts \
  apps/storefront/src/app/integrations/etsy/callback/route.ts
do
  mkdir -p "$backup/$(dirname "$path")"
  cp "source/$path" "$backup/$path"
done
tar -xzf etsy-catalog-source.tgz -C source
compose config --quiet
compose build backend storefront
compose up -d --no-deps --wait --wait-timeout 180 backend storefront
python3 - <<'PY'
import json, urllib.parse, urllib.request
with urllib.request.urlopen('http://127.0.0.1:19000/integrations/etsy/start', timeout=15) as response:
    data=json.load(response)
scope=urllib.parse.parse_qs(urllib.parse.urlparse(data['url']).query).get('scope')
assert scope == ['listings_r listings_w shops_r'], scope
PY
compose ps
printf 'ETSY_CATALOG_SCOPE_READY %s\n' "$stamp"
