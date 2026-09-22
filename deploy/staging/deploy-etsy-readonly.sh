#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
[ -f etsy-readonly-source.tgz ] || { echo 'Etsy source archive missing.' >&2; exit 1; }
exec > etsy-readonly-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"; else docker compose -f compose.yaml -f compose.apps.yaml "$@"; fi
}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="etsy-readonly-before-$stamp"
mkdir "$backup"
[ -f source/apps/backend/medusa-config.ts ] && cp source/apps/backend/medusa-config.ts "$backup/medusa-config.ts"
[ -f compose.apps.yaml ] && cp compose.apps.yaml "$backup/compose.apps.yaml"
tar -xzf etsy-readonly-source.tgz -C source
python3 - <<'PY'
from pathlib import Path
config=Path('source/apps/backend/medusa-config.ts')
s=config.read_text()
if "./src/modules/etsy" not in s:
    if 'modules: [' not in s: raise SystemExit('Unable to register Etsy module safely.')
    s=s.replace('modules: [', "modules: [{ resolve: './src/modules/etsy' }, ", 1)
    config.write_text(s)
compose=Path('compose.apps.yaml')
s=compose.read_text()
if 'ETSY_OAUTH_COOKIE_SECRET:' not in s:
    anchor='      MEDUSA_BACKEND_URL: http://backend:9000\n'
    if anchor not in s: raise SystemExit('Unable to add Etsy cookie setting safely.')
    s=s.replace(anchor, anchor+'      ETSY_OAUTH_COOKIE_SECRET: ${ETSY_OAUTH_COOKIE_SECRET:-}\n', 1)
    compose.write_text(s)
PY
compose config --quiet
compose build backend
compose run --rm --user root backend /app/apps/backend/node_modules/.bin/medusa db:migrate
compose up -d --no-deps --wait --wait-timeout 180 backend
compose build storefront
compose up -d --no-deps --wait --wait-timeout 180 storefront
status=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:19000/integrations/etsy/start)
[ "$status" = 503 ] || { echo "Unexpected disabled Etsy status: $status"; exit 1; }
compose ps
printf 'ETSY_READ_ONLY_DEPLOYED_DISABLED %s\n' "$stamp"
