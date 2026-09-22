#!/bin/sh
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset PYTHONPATH PYTHONHOME DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME
test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }

python3 -I - <<'PY'
import json
from pathlib import Path
import subprocess

required = {
    'ETSY_READ_ENABLED': lambda value: value == 'true',
    'ETSY_ORDER_REPORT_ENABLED': lambda value: value == 'true',
    'ETSY_API_KEY': bool,
    'ETSY_OAUTH_CALLBACK_URL': lambda value: value.startswith('https://'),
    'ETSY_SHARED_SECRET': bool,
    'ETSY_TOKEN_ENCRYPTION_KEY': bool,
}
config = json.loads(Path('/usr/local/lib/rustic-halo-ops/compose.json').read_text())
frozen = config['services']['backend']['environment']
raw = subprocess.run(
    ['docker', 'inspect', '--format', '{{json .Config.Env}}', 'rustic-halo-staging-backend-1'],
    check=True, capture_output=True, text=True,
).stdout
runtime = dict(item.split('=', 1) for item in json.loads(raw) if '=' in item)
report = {
    'frozen': {name: bool(check(frozen.get(name, ''))) for name, check in required.items()},
    'runtime': {name: bool(check(runtime.get(name, ''))) for name, check in required.items()},
}
print(json.dumps(report, sort_keys=True))
if not all(report['frozen'].values()) or not all(report['runtime'].values()):
    raise SystemExit(1)
print('ETSY_ORDER_REPORT_CONFIGURATION_PRESENT')
PY
