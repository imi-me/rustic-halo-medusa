#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
test -s cloudflare-tunnel.token
install -d -m 0700 -o root -g root .tunnel-secrets
install -m 0400 -o 65532 -g 65532 cloudflare-tunnel.token .tunnel-secrets/token
docker pull cloudflare/cloudflared:latest
docker image inspect cloudflare/cloudflared:latest --format '{{index .RepoDigests 0}}' > .tunnel-image-reference
python3 - <<'PY'
from pathlib import Path
import re
ref=Path('.tunnel-image-reference').read_text().strip()
if not re.fullmatch(r'cloudflare/cloudflared@sha256:[a-f0-9]{64}',ref):raise SystemExit('Unexpected image reference')
Path('.tunnel-image.env').write_text('CLOUDFLARED_IMAGE='+ref+'\n')
Path('cloudflare-tunnel.token').unlink()
PY
docker compose --env-file .tunnel-image.env -f compose.tunnel.yaml up -d
docker compose --env-file .tunnel-image.env -f compose.tunnel.yaml ps
echo PREVIEW_CONNECTOR_STARTED
