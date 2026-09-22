"""Installer-only validation of the deployment snapshot. No runtime config reads."""
import json
from pathlib import Path
import sys

ROOT = Path('/usr/local/lib/rustic-halo-ops')
SOURCE = '/home/shawnhouse/rustic-halo-staging/source'

def freeze(config):
    if config.get('name') != 'rustic-halo-staging': raise ValueError('Unexpected project')
    allowed = {'build','command','depends_on','entrypoint','environment','healthcheck','image','logging','networks','ports','restart','user','working_dir'}
    for service, port in [('storefront',8000),('backend',9000)]:
        s = config['services'][service]
        if set(s) - allowed:
            raise ValueError('Unexpected app service settings for ' + service + ': ' + ', '.join(sorted(set(s) - allowed)))
        if s.get('entrypoint') not in (None, []):
            raise ValueError('Custom app entrypoint is not allowed for ' + service)
        if s.get('user') not in (None, 'node', '1000', '1000:1000'): raise ValueError('Unexpected user')
        build = s['build']
        if set(build) - {'context','dockerfile','target','args','network'}: raise ValueError('Unexpected build options')
        if build['context'] != SOURCE or build.get('target') != service: raise ValueError('Unexpected build context/target')
        if build.get('network') not in (None, 'host', 'default'): raise ValueError('Unexpected build network')
        # Dockerfile is fixed and outside the user-writable source tree.
        build['dockerfile'] = str(ROOT / 'Dockerfile')
        build['context'] = '/var/lib/rustic-halo-ops/build-source'
        s['image'] = 'rustic-halo-staging-' + service
        s['user'] = 'node'
        ports = s.get('ports',[])
        if len(ports) != 1 or ports[0].get('host_ip') != '127.0.0.1' or int(ports[0]['target']) != port or int(ports[0]['published']) != port+10000: raise ValueError('Unexpected exposed ports')
        networks = set(s.get('networks',{}))
        if networks != ({'default','preview'} if service == 'storefront' else {'default'}): raise ValueError('Unexpected networks')
        # Dependency health checks run only inside their existing containers.
        s.pop('depends_on',None)
    config['services'] = {k:config['services'][k] for k in ('storefront','backend')}
    config.pop('volumes',None)
    if config['networks']['default'].get('name') != 'rustic-halo-staging_default': raise ValueError('Unexpected private network')
    if config['networks']['preview'].get('name') != 'rustic-halo-preview_default': raise ValueError('Unexpected preview network')
    config['networks'] = {k:{'name':v['name'],'external':True} for k,v in config['networks'].items() if k in ('default','preview')}
    # Freeze literal dollars; Compose must not reinterpret saved secret values.
    def literal(x):
        if isinstance(x,str): return x.replace('$','$$')
        if isinstance(x,list): return [literal(v) for v in x]
        if isinstance(x,dict): return {k:literal(v) for k,v in x.items()}
        return x
    return literal(config)

if __name__ == '__main__':
    result=freeze(json.loads(Path(sys.argv[1]).read_text()))
    Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n')
