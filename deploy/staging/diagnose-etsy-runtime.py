#!/usr/bin/env python3
"""Read-only deployment/API diagnostic. Never prints env values or OAuth tokens."""
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

def run(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, timeout=90, **kw)

report = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
inspect = run(['docker', 'inspect', CONTAINER])
if inspect.returncode:
    raise SystemExit('Cannot inspect backend container.')
container = json.loads(inspect.stdout)[0]
report['container'] = {
    'startedAt': container['State']['StartedAt'],
    'imageId': container['Image'],
    'workingDir': container['Config']['WorkingDir'],
    'health': container['State'].get('Health', {}).get('Status'),
}
report['hostSources'] = {}
for relative in ('lib/etsy/client.ts', 'api/integrations/etsy/callback/route.ts'):
    source = ROOT / 'source/apps/backend/src' / relative
    report['hostSources'][relative] = hashlib.sha256(source.read_bytes()).hexdigest()
log = ROOT / 'etsy-token-fix-deployment.log'
if log.exists():
    text = log.read_text(errors='replace')
    report['deployment'] = {
        'modifiedAt': datetime.datetime.fromtimestamp(log.stat().st_mtime, datetime.timezone.utc).isoformat(),
        'completionMarker': 'ETSY_TOKEN_EXCHANGE_FIX_DEPLOYED' in text,
        'errorMarkers': sorted(set(re.findall(r'(TS\d{4}|ENOSPC|EACCES|Permission denied|no space left on device|failed to solve|exit code: \d+)', text))),
        'typescriptLocations': re.findall(r'([\w./-]+\.tsx?)\((\d+,\d+)\): error (TS\d+)', text)[-12:],
    }
node = r'''
const fs = require('node:fs');
const crypto = require('node:crypto');
(async () => {
  const out = { files: {} };
  for (const file of [
    '/app/apps/backend/src/lib/etsy/client.ts',
    '/app/apps/backend/src/api/integrations/etsy/callback/route.ts',
    '/app/apps/backend/.medusa/server/src/lib/etsy/client.js',
    '/app/apps/backend/.medusa/server/src/api/integrations/etsy/callback/route.js',
  ]) {
    if (!fs.existsSync(file)) { out.files[file] = { exists: false }; continue; }
    const text = fs.readFileSync(file, 'utf8');
    out.files[file] = {
      sha256: crypto.createHash('sha256').update(text).digest('hex'),
      publicLookup: text.includes('getEtsyOwnedShopByName'),
      forwardsSecret: /config\.keystring,\s*secret/.test(text),
      diagnosticReason: text.includes('const reason ='),
    };
  }
  const key = process.env.ETSY_API_KEY?.trim();
  const secret = process.env.ETSY_SHARED_SECRET?.trim();
  const shop = process.env.ETSY_SHOP_NAME?.trim();
  out.config = { keyPresent: !!key, secretPresent: !!secret, expectedShopConfigured: !!shop };
  if (key && secret && shop) {
    try {
      const url = new URL('https://openapi.etsy.com/v3/application/shops');
      url.searchParams.set('shop_name', shop);
      const response = await fetch(url, { headers: { 'x-api-key': `${key}:${secret}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      out.publicShopProbe = { status: response.status, contentType: response.headers.get('content-type') };
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch {}
      if (response.ok) {
        const shops = Array.isArray(data?.results) ? data.results : [];
        const matches = shops.filter(s => typeof s.shop_name === 'string' && s.shop_name.toLowerCase() === shop.toLowerCase());
        out.publicShopProbe.exactMatches = matches.length;
        if (matches.length === 1 && Number.isSafeInteger(matches[0].user_id) && matches[0].user_id > 0) {
          out.publicShopProbe.ownerIdPresent = true;
          const { getEtsyOwnedShopByName } = require('/app/apps/backend/.medusa/server/src/lib/etsy/client.js');
          if (typeof getEtsyOwnedShopByName === 'function') {
            const input = { keystring: key, secret, shopName: shop, userId: matches[0].user_id };
            const mock = async () => ({ ok: true, json: async () => data });
            const verified = await getEtsyOwnedShopByName(input, mock);
            let rejectsWrongOwner = false;
            try { await getEtsyOwnedShopByName({ ...input, userId: input.userId + 1 }, mock); }
            catch { rejectsWrongOwner = true; }
            out.identityGuardProbe = { matchingOwnerAccepted: verified.shop_id === matches[0].shop_id, wrongOwnerRejected: rejectsWrongOwner };
          }
        }
      } else {
        const message = typeof data?.error === 'string' ? data.error : typeof data?.error_description === 'string' ? data.error_description : typeof data?.message === 'string' ? data.message : 'No JSON error message';
        out.publicShopProbe.reason = message.split(key).join('[redacted]').split(secret).join('[redacted]').replace(/[\r\n]/g, ' ').slice(0, 300);
      }
    } catch { out.publicShopProbe = { error: 'Network or TLS request failed' }; }
  }
  process.stdout.write(JSON.stringify(out));
})().catch(() => { process.stdout.write(JSON.stringify({ error: 'Diagnostic failed' })); process.exitCode = 1; });
'''
result = run(['docker', 'exec', '-i', CONTAINER, 'node'], input=node)
try:
    report['runtime'] = json.loads(result.stdout)
except ValueError:
    report['runtime'] = {'error': 'Could not obtain runtime diagnostic'}
logs = run(['docker', 'logs', '--tail', '250', '--timestamps', CONTAINER])
report['callbackStages'] = re.findall(r'(\d{4}-\d\d-\d\dT[\d:.]+Z).*?Etsy callback failed at ([a-z-]+)(?:[^\n]*?HTTP (\d{3}))?', logs.stdout + logs.stderr)[-8:]
owner = pwd.getpwnam('shawnhouse')
fd, path = tempfile.mkstemp(prefix='.etsy-runtime-', dir='/home/shawnhouse')
with os.fdopen(fd, 'w') as output:
    json.dump(report, output, indent=2)
    output.write('\n')
os.chmod(path, 0o600)
os.chown(path, owner.pw_uid, owner.pw_gid)
os.replace(path, '/home/shawnhouse/etsy-runtime-report.json')
print('ETSY_RUNTIME_REPORT_READY')
