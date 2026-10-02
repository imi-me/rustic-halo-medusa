#!/usr/bin/python3
"""Publish only queue counts/IDs, never raw output, payloads or credentials."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path('/usr/local/lib/rustic-halo-production')
OUTPUT = Path('/var/lib/rustic-halo-production-health/status.json')

def sanitize(raw):
    data = json.loads(raw)
    checked = dt.datetime.fromisoformat(data['checkedAt'].replace('Z', '+00:00'))
    if checked.tzinfo is None or abs((dt.datetime.now(dt.timezone.utc)-checked).total_seconds()) > 120:
        raise ValueError('Invalid check time')
    counts = {k: data['counts'].get(k, 0) for k in ('failed','waiting','active','delayed','completed','paused')}
    if any(type(v) is not int or v < 0 for v in counts.values()):
        raise ValueError('Invalid counts')
    ids = [str(j['id']) for j in data['failedJobs']]
    if len(ids) > 50 or any(not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', i) for i in ids):
        raise ValueError('Invalid IDs')
    if counts['failed'] < len(ids):
        raise ValueError('Inconsistent failed count')
    return {'status':'failed_jobs' if counts['failed'] else 'ok', 'checkedAt':data['checkedAt'],
            'counts':counts, 'failedJobIds':ids, 'truncated':counts['failed'] > len(ids)}

def main():
    try:
        found = subprocess.run(['/usr/bin/docker','ps','--filter','name=backend-rustic-halo-production',
            '--filter','label=coolify.applicationId=3','--format','{{.ID}}'],
            capture_output=True, text=True, timeout=10, check=True).stdout.split()
        if len(found) != 1 or not re.fullmatch(r'[a-f0-9]{12,64}', found[0]):
            raise ValueError('Backend unavailable')
        with (ROOT/'background-jobs.cjs').open('rb') as code:
            result = subprocess.run(['/usr/bin/docker','exec','-i','-w','/app/apps/backend/.medusa/server',found[0],
                'node','-','status'], stdin=code, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        if result.returncode not in (0,2):
            raise ValueError('Check failed')
        report = sanitize(result.stdout)
        if (result.returncode == 2) != (report['counts']['failed'] > 0):
            raise ValueError('Inconsistent exit status')
    except Exception:
        report = {'status':'check_failed','checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
                  'message':'Unable to collect background-job status; administrator review required.'}
    fd, temporary = tempfile.mkstemp(prefix='.status-', dir=OUTPUT.parent)
    try:
        with os.fdopen(fd,'w') as f:
            json.dump(report,f); f.write('\n'); f.flush(); os.fsync(f.fileno()); os.fchmod(f.fileno(),0o644)
        os.replace(temporary,OUTPUT)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)
    return 1 if report['status']=='check_failed' else 0

if __name__=='__main__':
    raise SystemExit(main())
