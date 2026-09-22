#!/usr/bin/env python3
"""Deploy the complete Etsy fix and verify running source and compiled output."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import tempfile

ROOT = Path('/home/shawnhouse/rustic-halo-staging')
CONTAINER = 'rustic-halo-staging-backend-1'
assert os.geteuid() == 0, 'Run with sudo.'
report = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'state': 'started'}
owner = pwd.getpwnam('shawnhouse')

def publish():
    fd, name = tempfile.mkstemp(prefix='.etsy-deploy-', dir='/home/shawnhouse')
    with os.fdopen(fd, 'w') as output:
        json.dump(report, output, indent=2)
        output.write('\n')
    os.chmod(name, 0o600)
    os.chown(name, owner.pw_uid, owner.pw_gid)
    os.replace(name, '/home/shawnhouse/etsy-deployment-report.json')

publish()
try:
    manifest = json.loads((ROOT / 'etsy-fix-manifest.json').read_text())
    archive = ROOT / 'etsy-token-fix-source.tgz'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['archiveSha256']:
        raise RuntimeError('Archive checksum mismatch')
    # Back up every existing changed file before installation. New files are
    # recorded in the report because tar cannot archive a path that does not
    # exist yet.
    paths = sorted(manifest['files'])
    existing_paths = [path for path in paths if (ROOT / 'source' / path).is_file()]
    report['newFiles'] = sorted(set(paths) - set(existing_paths))
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    if existing_paths:
        subprocess.run(['tar', '-czf', str(ROOT / ('etsy-verified-before-' + stamp + '.tgz')), '-C', str(ROOT / 'source'), *existing_paths], check=True, capture_output=True)
    report['state'] = 'building'
    publish()
    print('Building Etsy fix; details stay in the private deployment log.', flush=True)
    result = subprocess.run(['sh', str(ROOT / 'deploy-etsy-token-fix.sh')], capture_output=True, timeout=1200)
    if result.returncode:
        text = (ROOT / 'etsy-token-fix-deployment.log').read_text(errors='replace')
        report['buildErrorCodes'] = sorted(set(re.findall(r'\bTS\d{4}\b|ENOSPC|EACCES|failed to solve', text)))
        raise RuntimeError('Deployment failed; existing container was not verified')
    for relative, expected in manifest['files'].items():
        content = subprocess.run(['docker', 'exec', CONTAINER, 'cat', '/app/' + relative], check=True, capture_output=True).stdout
        if hashlib.sha256(content).hexdigest() != expected:
            raise RuntimeError('Running source checksum mismatch')
    client = subprocess.run(['docker', 'exec', CONTAINER, 'cat', '/app/apps/backend/.medusa/server/src/lib/etsy/client.js'], check=True, capture_output=True, text=True).stdout
    callback = subprocess.run(['docker', 'exec', CONTAINER, 'cat', '/app/apps/backend/.medusa/server/src/api/integrations/etsy/callback/route.js'], check=True, capture_output=True, text=True).stdout
    if not re.search(r'etsyHeaders\(input\.keystring,\s*input\.accessToken,\s*input\.secret\)', client):
        raise RuntimeError('Compiled client does not forward the shared secret')
    if 'getEtsyOwnedShopByName' not in callback or not re.search(r'userId:\s*tokens\.user_id', callback):
        raise RuntimeError('Compiled callback does not use the verified shop ownership check')
    if 'apps/backend/src/api/integrations/etsy/audit/route.ts' in manifest['files']:
        audit = subprocess.run(['docker', 'exec', CONTAINER, 'cat', '/app/apps/backend/.medusa/server/src/api/integrations/etsy/audit/route.js'], check=True, capture_output=True, text=True).stdout
        if ('refreshEtsyAccessToken' not in audit or 'listEtsyListings' not in audit
                or 'getEtsyListingInventories' not in audit
                or 'case-insensitive exact SKU' not in audit):
            raise RuntimeError('Compiled Etsy audit endpoint is incomplete')
    subprocess.run(['python3', '/home/shawnhouse/check-etsy.py'], check=True, capture_output=True, timeout=120)
    diagnostic = json.loads(Path('/home/shawnhouse/etsy-runtime-report.json').read_text())
    report['runningSourceMatches'] = True
    report['compiledHeaderVerified'] = True
    report['container'] = diagnostic['container']
    report['publicShopProbe'] = diagnostic['runtime'].get('publicShopProbe')
    report['identityGuardProbe'] = diagnostic['runtime'].get('identityGuardProbe')
    probe = report['publicShopProbe'] or {}
    if probe.get('status') != 200 or probe.get('exactMatches') != 1 or probe.get('ownerIdPresent') is not True:
        raise RuntimeError('Code deployed but public shop identity preflight did not pass')
    if report['identityGuardProbe'] != {'matchingOwnerAccepted': True, 'wrongOwnerRejected': True}:
        raise RuntimeError('Code deployed but compiled ownership checks did not pass')
    report['state'] = 'verified'
    print('ETSY_DEPLOYMENT_VERIFIED: running code matches; public shop and ownership checks passed.', flush=True)
except Exception as error:
    report['state'] = 'failed'
    report['reason'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    print('ETSY_DEPLOYMENT_FAILED: report saved. Do not retry authorization yet.', flush=True)
finally:
    report['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    publish()
raise SystemExit(0 if report['state'] == 'verified' else 1)
