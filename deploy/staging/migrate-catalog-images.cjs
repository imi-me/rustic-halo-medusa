const fs = require('node:fs/promises')
const {createHash} = require('node:crypto')
const hash = b => createHash('sha256').update(b).digest('hex')
const reportPath = '/tmp/rustic-halo-image-migration.json'
const allowed = u => { const p=new URL(u); return p.protocol==='https:' && ['rustichalo.com','cdn.shopify.com'].includes(p.hostname) && p.pathname.includes('/'); }
exports.default = async function({container}) {
 if(process.env.APP_ENV!=='staging'||process.env.R2_STORAGE_ENABLED!=='true'||process.env.R2_BUCKET!=='rustic-halo-images') throw Error('Staging R2 required')
 const service=container.resolve('product')
 const products=await service.listProducts({}, {relations:['images'],take:1000})
 if(products.length>=1000) throw Error('Catalog pagination required')
 const selected=products.filter(p=>p.metadata?.shopify_id)
 const before=selected.map(p=>({id:p.id,handle:p.handle,thumbnail:p.thumbnail,images:p.images.map(i=>({id:i.id,url:i.url}))}))
 const editorial=JSON.parse(await fs.readFile('/tmp/editorial-images.json','utf8'))
 const urls=[...new Set([...editorial,...before.flatMap(p=>[p.thumbnail,...p.images.map(i=>i.url)])].filter(Boolean))].filter(u=>new URL(u).hostname!=='cdn.rustichalo.com')
 if(!urls.every(allowed)) throw Error('Unexpected image source')
 const report={createdAt:new Date().toISOString(),before,map:{},updated:[]}
 await fs.writeFile(reportPath,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'})
 console.log('IMAGE_INVENTORY '+JSON.stringify({products:before.length,uniqueSourceImages:urls.length}))
 for(const url of urls) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000)})
  if(!response.ok) throw Error('Source image request failed')
  const type=response.headers.get('content-type')?.split(';')[0]
  const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}
  if(!extensions[type]) throw Error('Unsupported image type')
  if(Number(response.headers.get('content-length'))>20000000) throw Error('Image too large')
  const body=Buffer.from(await response.arrayBuffer())
  if(!body.length||body.length>20000000) throw Error('Invalid image size')
  const sha256=hash(body)
  const file=await container.resolve('file').createFiles({filename:'catalog-'+sha256.slice(0,20)+'.'+extensions[type],mimeType:type,content:body.toString('base64'),access:'public'})
  if(new URL(file.url).origin!=='https://cdn.rustichalo.com') throw Error('Unexpected upload destination')
  const check=await fetch(file.url,{signal:AbortSignal.timeout(45000)})
  if(!check.ok||hash(Buffer.from(await check.arrayBuffer()))!==sha256) throw Error('CDN byte comparison failed')
  report.map[url]={url:file.url,sha256,bytes:body.length}
  await fs.writeFile(reportPath,JSON.stringify(report,null,2))
 }
 // No product links are changed until every source image has a verified CDN copy.
 for(const p of before) {
  const current=await service.retrieveProduct(p.id,{relations:['images']})
  if(current.thumbnail!==p.thumbnail||JSON.stringify(current.images.map(i=>({id:i.id,url:i.url})))!==JSON.stringify(p.images)) throw Error('Product images changed during migration')
  const resolve=u=>report.map[u]?.url||u
  await service.updateProducts(p.id,{thumbnail:resolve(p.thumbnail),images:p.images.map(i=>({id:i.id,url:resolve(i.url)}))})
  const saved=await service.retrieveProduct(p.id,{relations:['images']})
  if(saved.thumbnail!==resolve(p.thumbnail)||p.images.some(i=>!saved.images.some(s=>s.id===i.id&&s.url===resolve(i.url)))) throw Error('Product update verification failed')
  report.updated.push(p.id)
  await fs.writeFile(reportPath,JSON.stringify(report,null,2))
 }
 console.log('CATALOG_IMAGES_MIGRATED '+JSON.stringify({products:report.updated.length,images:Object.keys(report.map).length,bytes:Object.values(report.map).reduce((n,i)=>n+i.bytes,0)}))
}
