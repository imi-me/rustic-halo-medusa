#!/bin/sh
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset PYTHONPATH PYTHONHOME DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME

test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }
base=/home/shawnhouse/rustic-halo-staging
ops=/usr/local/lib/rustic-halo-ops
stamp=$(date -u +%Y%m%dT%H%M%SZ)
test -f "$base/compose.yaml"
test -f "$base/compose.apps.yaml"
test -f "$ops/compose.json"

resolved=$(mktemp "$ops/.etsy-session-resolved.XXXXXX")
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
secret = str(resolved.get('services', {}).get('storefront', {}).get('environment', {}).get('ETSY_OAUTH_COOKIE_SECRET', '')).strip()
target = frozen.get('services', {}).get('storefront', {}).get('environment')
if not secret:
    raise SystemExit('The protected Etsy OAuth cookie setting is missing from the staging source configuration.')
if not isinstance(target, dict):
    raise SystemExit('Unexpected frozen storefront environment.')
target['ETSY_OAUTH_COOKIE_SECRET'] = secret.replace('$', '$$')
updated_path.write_text(json.dumps(frozen, indent=2) + '\n')
PY

cp "$ops/compose.json" "$ops/compose.before-etsy-session-repair-$stamp.json"
chmod 0600 "$updated"
mv "$updated" "$ops/compose.json"

DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" config --quiet
DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" up -d --no-deps --wait --wait-timeout 180 storefront

python3 -I - <<'PY'
import json
import subprocess

config = json.load(open('/usr/local/lib/rustic-halo-ops/compose.json'))
frozen = bool(config['services']['storefront']['environment'].get('ETSY_OAUTH_COOKIE_SECRET'))
raw = subprocess.run(
    ['docker', 'inspect', '--format', '{{json .Config.Env}}', 'rustic-halo-staging-storefront-1'],
    check=True, capture_output=True, text=True,
).stdout
runtime = dict(item.split('=', 1) for item in json.loads(raw) if '=' in item)
live = bool(runtime.get('ETSY_OAUTH_COOKIE_SECRET'))
if not frozen or not live:
    raise SystemExit('The Etsy OAuth cookie setting is not active.')
print('ETSY_OAUTH_SESSION_CONFIGURATION_PRESENT')
PY
