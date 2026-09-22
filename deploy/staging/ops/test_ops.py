import copy
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).parent

def load(name, filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

ops=load('ops','rustic-halo-ops.py')
freeze=load('freeze','freeze-config.py').freeze

def config():
    services={}
    for name,port in [('backend',9000),('storefront',8000)]:
        services[name]={'build':{'context':'/home/shawnhouse/rustic-halo-staging/source','target':name,'dockerfile':'deploy/staging/Dockerfile'},'ports':[{'host_ip':'127.0.0.1','target':port,'published':str(port+10000)}],'networks':{'default':{}},'environment':{'TEST':'a$b'}}
    services['storefront']['networks']['preview']={}
    return {'name':'rustic-halo-staging','services':services,'networks':{'default':{'name':'rustic-halo-staging_default'},'preview':{'name':'rustic-halo-preview_default','external':True}}}

class Tests(unittest.TestCase):
    def test_exact_commands_only(self):
        for args in [['status'],['deploy','backend'],['deploy','storefront'],['restart','backend'],['restart','storefront']]: self.assertTrue(ops.valid_args(args))
        for args in [[],['status','x'],['deploy','postgres'],['exec','sh'],['deploy','storefront','--privileged'],['deploy','../backend'],['restart','backend;sh']]: self.assertFalse(ops.valid_args(args))
    def test_host_privileges_rejected(self):
        for key,value in [('volumes',['/:/host']),('privileged',True),('devices',['/dev/sda']),('cap_add',['SYS_ADMIN']),('network_mode','host')]:
            c=config();c['services']['backend'][key]=value
            with self.assertRaises(ValueError):freeze(c)
        c=config();c['services']['backend']['entrypoint']=['sh']
        with self.assertRaises(ValueError):freeze(c)

    def test_empty_normalized_entrypoint_is_allowed(self):
        c=config();c['services']['backend']['entrypoint']=None
        self.assertIsNone(freeze(c)['services']['backend']['entrypoint'])
    def test_build_privileges_rejected(self):
        for key,value in [('entitlements',['security.insecure']),('ssh',['default']),('secrets',['key']),('additional_contexts',{'host':'/root'})]:
            c=config();c['services']['backend']['build'][key]=value
            with self.assertRaises(ValueError):freeze(c)
    def test_exposure_rejected(self):
        c=config();c['services']['backend']['ports'][0]['host_ip']='0.0.0.0'
        with self.assertRaises(ValueError):freeze(c)
    def test_snapshot_pins_paths_and_preserves_literals(self):
        c=freeze(config())
        self.assertEqual(c['services']['backend']['build']['context'],'/var/lib/rustic-halo-ops/build-source')
        self.assertEqual(c['services']['backend']['build']['dockerfile'],'/usr/local/lib/rustic-halo-ops/Dockerfile')
        self.assertEqual(c['services']['backend']['environment']['TEST'],'a$$b')
        self.assertEqual(c['services']['backend']['user'],'node')

if __name__=='__main__':unittest.main()
