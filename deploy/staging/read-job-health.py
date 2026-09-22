#!/usr/bin/python3
"""Unprivileged status reader. Never treats stale reports as current health."""
import datetime as dt
import json
from pathlib import Path

def assess(report, now):
    checked=dt.datetime.fromisoformat(report['checkedAt'].replace('Z','+00:00'))
    age=(now-checked).total_seconds()
    if age < -60 or age > 900:
        return {'status':'stale','message':'Job-health report is out of date; administrator review required.'}, 1
    if report['status'] not in ('ok','failed_jobs','check_failed'):
        raise ValueError('Unknown status')
    return report, (0 if report['status']=='ok' else 2 if report['status']=='failed_jobs' else 1)

def main():
    try:
        result,code=assess(json.loads(Path('/var/lib/rustic-halo-job-health/status.json').read_text()), dt.datetime.now(dt.timezone.utc))
    except Exception:
        result,code={'status':'unavailable','message':'Job-health report is missing or invalid; administrator review required.'},1
    print(json.dumps(result)); return code
if __name__=='__main__': raise SystemExit(main())
