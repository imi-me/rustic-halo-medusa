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
test -f "$ops/compose.json"
cp "$base/backend.env" "$base/backend.env.before-etsy-orders-$stamp"
cp "$ops/compose.json" "$ops/compose.before-etsy-orders-$stamp.json"

python3 -I - "$base/backend.env" "$ops/compose.json" <<'PY'
import json
import os
from pathlib import Path
import sys
import tempfile

env_path = Path(sys.argv[1])
compose_path = Path(sys.argv[2])
lines = env_path.read_text().splitlines()
result = []
found = False
for line in lines:
    if line.startswith('ETSY_ORDER_REPORT_ENABLED='):
        result.append('ETSY_ORDER_REPORT_ENABLED=true')
        found = True
    else:
        result.append(line)
if not found:
    result.append('ETSY_ORDER_REPORT_ENABLED=true')

config = json.loads(compose_path.read_text())
environment = config.get('services', {}).get('backend', {}).get('environment')
if not isinstance(environment, dict):
    raise SystemExit('Unexpected frozen backend environment.')
environment['ETSY_ORDER_REPORT_ENABLED'] = 'true'

def replace(path: Path, content: str, mode: int):
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write(content)
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)

replace(env_path, '\n'.join(result) + '\n', 0o600)
replace(compose_path, json.dumps(config, indent=2) + '\n', 0o600)
PY

DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" config --quiet
DOCKER_CONFIG="$ops/docker-config" docker compose \
  --project-directory "$ops" --env-file /dev/null -p rustic-halo-staging \
  -f "$ops/compose.json" up -d --no-deps --wait --wait-timeout 180 backend
python3 - <<'PY'
import time
import urllib.request
for attempt in range(12):
    try:
        with urllib.request.urlopen('http://127.0.0.1:19000/health', timeout=10) as response:
            if response.status == 200:
                print('ETSY_ORDER_REPORT_ENABLED_READ_ONLY')
                raise SystemExit(0)
    except OSError:
        if attempt == 11:
            raise
        time.sleep(2)
PY
