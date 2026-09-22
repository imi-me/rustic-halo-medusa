#!/bin/sh
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset PYTHONPATH PYTHONHOME DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME

test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }
base=/home/shawnhouse/rustic-halo-staging
ops=/usr/local/lib/rustic-halo-ops
stamp=$(date -u +%Y%m%dT%H%M%SZ)
test -f "$base/backend.env"
test -f "$base/compose.yaml"
test -f "$base/compose.apps.yaml"
test -f "$ops/compose.json"

resolved=$(mktemp "$ops/.etsy-resolved.XXXXXX")
updated=$(mktemp "$ops/.compose.XXXXXX")
cleanup() { rm -f "$resolved" "$updated"; }
trap cleanup EXIT

set -- -f "$base/compose.yaml" -f "$base/compose.apps.yaml"
if test -f "$base/compose.preview.yaml"; then
  set -- "$@" -f "$base/compose.preview.yaml"
fi
docker compose --project-directory "$base" "$@" config --format json > "$resolved"

python3 -I - "$resolved" "$ops/compose.json" "$updated" <<'PY'
import json
from pathlib import Path
import sys

resolved_path, frozen_path, updated_path = map(Path, sys.argv[1:])
resolved = json.loads(resolved_path.read_text())
frozen = json.loads(frozen_path.read_text())
source = resolved.get('services', {}).get('backend', {}).get('environment')
target = frozen.get('services', {}).get('backend', {}).get('environment')
if not isinstance(source, dict) or not isinstance(target, dict):
    raise SystemExit('Unexpected backend environment.')

required = (
    'ETSY_READ_ENABLED',
    'ETSY_ORDER_REPORT_ENABLED',
    'ETSY_API_KEY',
    'ETSY_OAUTH_CALLBACK_URL',
    'ETSY_SHARED_SECRET',
    'ETSY_TOKEN_ENCRYPTION_KEY',
    'ETSY_SHOP_NAME',
)
missing = [name for name in required if not str(source.get(name, '')).strip()]
if missing:
    raise SystemExit('Protected Etsy settings are incomplete: ' + ', '.join(missing))
if source['ETSY_READ_ENABLED'] != 'true' or source['ETSY_ORDER_REPORT_ENABLED'] != 'true':
    raise SystemExit('The Etsy read-only flags are not enabled.')
if not source['ETSY_OAUTH_CALLBACK_URL'].startswith('https://'):
    raise SystemExit('The Etsy callback is not HTTPS.')

# Compose treats $$ as a literal dollar. The original restricted snapshot used
# the same transformation, so secrets containing dollar signs remain intact.
for name in required:
    target[name] = str(source[name]).replace('$', '$$')
updated_path.write_text(json.dumps(frozen, indent=2) + '\n')
PY

cp "$ops/compose.json" "$ops/compose.before-etsy-config-repair-$stamp.json"
chmod 0600 "$updated"
mv "$updated" "$ops/compose.json"

DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" config --quiet
DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" up -d --no-deps --wait --wait-timeout 180 backend

sh /home/shawnhouse/diagnose-etsy-order-report.sh
python3 -I - <<'PY'
import json
import urllib.parse
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:19000/integrations/etsy/start', timeout=15) as response:
    payload = json.load(response)
scopes = urllib.parse.parse_qs(urllib.parse.urlparse(payload['url']).query).get('scope', [''])[0].split()
if 'transactions_r' not in scopes or 'transactions_w' in scopes:
    raise SystemExit('Unexpected Etsy authorization scope.')
print('ETSY_ORDER_REPORT_SCOPE_READY')
PY
