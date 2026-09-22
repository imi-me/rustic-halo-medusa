#!/usr/bin/python3 -I
"""Fixed staging operations. Never execute caller-supplied commands or compose files."""
import datetime
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path('/usr/local/lib/rustic-halo-ops')
STATE = Path('/var/lib/rustic-halo-ops')
DOCKER = '/usr/bin/docker'
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root',
       'DOCKER_CONFIG': str(ROOT / 'docker-config'), 'LANG': 'C.UTF-8'}
SERVICES = ('storefront', 'backend')

def valid_args(args):
    return args == ['status'] or (len(args) == 2 and args[0] in ('deploy', 'restart') and args[1] in SERVICES)

def compose(*args):
    return [DOCKER, 'compose', '--project-directory', str(ROOT), '--env-file', '/dev/null',
            '-p', 'rustic-halo-staging', '-f', str(ROOT / 'compose.json'), *args]

def run(args, **kwargs):
    return subprocess.run(args, env=ENV, cwd=ROOT, check=True, **kwargs)

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def write_report(report):
    tmp = STATE / 'status.tmp'
    tmp.write_text(json.dumps(report) + '\n')
    tmp.chmod(0o600)
    tmp.replace(STATE / 'status.json')

def app_status():
    result = []
    for name in SERVICES:
        # Inspect only fixed names; never emit environment variables or credentials.
        try:
            r = run([DOCKER, 'inspect', '--format', '{{json .State}}', 'rustic-halo-staging-' + name + '-1'], capture_output=True, text=True)
            state = json.loads(r.stdout)
            result.append({'service': name, 'status': state.get('Status'), 'health': state.get('Health', {}).get('Status')})
        except (subprocess.CalledProcessError, ValueError):
            result.append({'service': name, 'status': 'unavailable'})
    saved = STATE / 'status.json'
    return {'checkedAt': now(), 'apps': result, 'lastOperation': json.loads(saved.read_text()) if saved.exists() else None}

def snapshot_source():
    # Read uploaded source with the SSH user's permissions, never root's.
    # Reject links and special files before extracting into a root-owned context.
    import tarfile
    import tempfile
    import shutil
    from pathlib import PurePosixPath
    with tempfile.TemporaryDirectory(dir=STATE) as temp:
        archive = Path(temp) / 'source.tar'
        excludes = ['node_modules', '.git', '.local', '.env*', '.next', '.medusa', '*.tsbuildinfo', '.DS_Store', '._*', 'coverage', '.turbo']
        command = ['/usr/sbin/runuser', '-u', 'shawnhouse', '--', '/usr/bin/tar',
                   *['--exclude=' + name for name in excludes], '-cf', '-',
                   '-C', '/home/shawnhouse/rustic-halo-staging/source', '.']
        with archive.open('wb') as output:
            run(command, stdout=output, stderr=subprocess.DEVNULL)
        destination = STATE / 'build-source'
        staged = Path(temp) / 'tree'
        staged.mkdir()
        with tarfile.open(archive) as tar:
            for member in tar:
                path = PurePosixPath(member.name)
                if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                    raise ValueError('Source must contain only regular files and directories')
                target = staged.joinpath(*path.parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with tar.extractfile(member) as src, target.open('wb') as dst:
                        shutil.copyfileobj(src, dst)
                    target.chmod(0o755 if member.mode & 0o111 else 0o644)
        if destination.exists(): shutil.rmtree(destination)
        staged.rename(destination)

def main(args):
    if not valid_args(args):
        print('Allowed: status | deploy storefront | deploy backend | restart storefront | restart backend', file=sys.stderr)
        return 2
    if os.geteuid() != 0:
        print('Run with sudo -n /usr/local/sbin/rustic-halo-ops', file=sys.stderr)
        return 1
    os.umask(0o077)
    if args == ['status']:
        print(json.dumps(app_status()))
        return 0
    action, service = args
    with (STATE / 'operation.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another managed operation is running.', file=sys.stderr)
            return 1
        report = {'action': action, 'service': service, 'startedAt': now(), 'state': 'running', 'stage': 'starting'}
        write_report(report)
        with (STATE / 'operation.log').open('w') as log:
            def step(stage, command):
                report['stage'] = stage
                write_report(report)
                print(stage, flush=True)
                run(command, stdout=log, stderr=log)
            try:
                if action == 'deploy':
                    report['stage'] = 'snapshot_source'; write_report(report)
                    snapshot_source()
                    old = run([DOCKER, 'inspect', '--format', '{{.Image}}', 'rustic-halo-staging-' + service + '-1'], capture_output=True, text=True).stdout.strip()
                    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
                    tag = 'rustic-halo-' + service + '-before-ops:' + stamp
                    step('save_previous_image', [DOCKER, 'tag', old, tag])
                    report['previousImage'] = tag
                    step('build', compose('build', service))
                    step('start', compose('up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', service))
                else:
                    step('restart', compose('restart', service))
                # Fixed local endpoints only. Brief resets after startup are retried.
                report['stage'] = 'check'; write_report(report)
                import time
                url = 'http://127.0.0.1:' + ('18000/us' if service == 'storefront' else '19000/health')
                for attempt in range(12):
                    try:
                        with urllib.request.urlopen(url, timeout=10) as response:
                            if response.status != 200: raise OSError('Health response')
                        break
                    except OSError:
                        if attempt == 11: raise
                        time.sleep(2)
                report.update(state='complete', stage='verified', completedAt=now())
                write_report(report)
                print(json.dumps(report))
                return 0
            except Exception as error:
                report.update(state='failed', errorType=type(error).__name__, completedAt=now())
                write_report(report)
                print(json.dumps(report))
                return 1

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
