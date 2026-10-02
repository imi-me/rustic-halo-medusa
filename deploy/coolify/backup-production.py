#!/usr/bin/env python3
"""Private production DB/Redis/config backups; media export remains a launch gate."""
import hashlib,json,os,secrets,subprocess,tarfile
from pathlib import Path
from datetime import datetime,timezone
CORE='aw4sntlbsbfsukqtfvccduqm'
ROOT=Path('/var/lib/rustic-halo-production-backups')
def run(*args,**kwargs):
 return subprocess.run(args,check=True,stderr=subprocess.DEVNULL,timeout=1200,**kwargs)
def main():
 if os.geteuid()!=0:raise RuntimeError('Administrator required')
 os.umask(0o077);folder=ROOT/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');folder.mkdir(parents=True,exist_ok=False)
 with (folder/'production.dump').open('xb') as out:run('docker','exec','postgres-'+CORE,'pg_dump','-U','rustic_halo','-d','rustic_halo_production','-Fc','--no-owner','--no-acl',stdout=out)
 with (folder/'production.dump').open('rb') as inp:run('docker','exec','-i','postgres-'+CORE,'pg_restore','--list',stdin=inp,stdout=subprocess.DEVNULL)
 client='rustic-halo-production-backup-'+secrets.token_hex(6);image='redis:rustic-halo-migration-64035c2c9726'
 inspection=json.loads(run('docker','inspect','redis-'+CORE,stdout=subprocess.PIPE,text=True).stdout)[0]
 ip=inspection['NetworkSettings']['Networks']['rustic-halo-production-data']['IPAddress']
 try:
  run('docker','run','--name',client,'--pull=never','--network','rustic-halo-production-data',image,'redis-cli','-h',ip,'--rdb','/data/snapshot.rdb',stdout=subprocess.DEVNULL)
  run('docker','cp',client+':/data/snapshot.rdb',str(folder/'redis.rdb'),stdout=subprocess.DEVNULL)
  run('docker','run','--rm','--pull=never','--network','none','--user','0:0','--entrypoint','redis-check-rdb','--mount','type=bind,source='+str(folder/'redis.rdb')+',target=/snapshot.rdb,readonly',image,'/snapshot.rdb',stdout=subprocess.DEVNULL)
 finally:subprocess.run(['docker','rm',client],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 php="require '/var/www/html/vendor/autoload.php';$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();$a=App\\Models\\Application::where('uuid','bvfoyx363r3pky9lues4fpyk')->firstOrFail();echo json_encode(['application'=>$a->getAttributes(),'settings'=>$a->settings->getAttributes(),'environment'=>$a->environment_variables->map(fn($e)=>['key'=>$e->key,'value'=>$e->value,'is_runtime'=>$e->is_runtime,'is_buildtime'=>$e->is_buildtime])->all()]);"
 with (folder/'application-private.json').open('xb') as out:run('docker','exec','-u','0','coolify','php','-r',php,stdout=out)
 with tarfile.open(folder/'configuration.tar.gz','w:gz') as tar:
  tar.add('/data/coolify/services/'+CORE,arcname='data-resource')
  tar.add('/usr/local/lib/rustic-halo-production',arcname='operations')
  for kind in ['service','timer']:tar.add('/etc/systemd/system/rustic-halo-production-backup.'+kind,arcname='systemd/backup.'+kind)
 manifest={'scope':'online DB/Redis snapshots, not atomic; production media not yet configured','files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in folder.iterdir() if p.is_file()}}
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('PRODUCTION_BACKUP_VERIFIED '+str(folder))
if __name__=='__main__':
 try:main()
 except Exception as exc:raise SystemExit('Production backup failed ('+type(exc).__name__+'). Private partial files retained.')
