#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
[ -f etsy-token-fix-source.tgz ] || { echo 'Etsy fix archive missing.' >&2; exit 1; }
exec > etsy-token-fix-deployment.log 2>&1
cp source/apps/backend/src/lib/etsy/client.ts "etsy-client-before-$(date -u +%Y%m%dT%H%M%SZ).ts"
tar -xzf etsy-token-fix-source.tgz -C source
compose() { if [ -f compose.preview.yaml ]; then docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; else docker compose -f compose.yaml -f compose.apps.yaml "$@"; fi; }
compose build --no-cache backend
compose up -d --no-deps --wait --wait-timeout 180 backend
python3 -c 'import urllib.request; assert urllib.request.urlopen("http://127.0.0.1:19000/integrations/etsy/start",timeout=10).status == 200'
printf 'ETSY_READ_ONLY_COMPARISON_DEPLOYED\n'
