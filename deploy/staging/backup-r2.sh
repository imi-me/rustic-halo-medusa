#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
compose() { docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
work=/tmp/rustic-halo-r2-backup-$stamp
output=image-backups/$stamp
mkdir -p image-backups
compose exec -T -w /app/apps/backend/.medusa/server backend node - "$work" < backup-r2.cjs
backend=$(compose ps -q backend)
docker cp "$backend:$work" "$output"
python3 - "$output" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]); data=json.loads((root/'manifest.json').read_text())
for obj in data['objects']:
 p=root/obj['filename']
 if p.parent != root: raise SystemExit('Invalid manifest path')
 raw=p.read_bytes()
 if len(raw)!=obj['bytes'] or hashlib.sha256(raw).hexdigest()!=obj['sha256']: raise SystemExit('Backup verification failed')
print('R2_BACKUP_VERIFIED objects='+str(len(data['objects']))+' path='+str(root))
PY
compose exec -T backend node -e 'require("fs").rmSync(process.argv[1],{recursive:true})' "$work"
