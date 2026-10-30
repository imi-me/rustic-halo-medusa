import fs from 'node:fs/promises'
import { clawCatalogFingerprint as fingerprint } from '../lib/hair-claw-catalog-fingerprint'
import { planClawOrderChoices } from '../lib/hair-claw-order-choices'
import { isHairClaw } from '../lib/product-admin'
const fields = ['id','title','description','metadata','type.*','options.*','options.values.*','variants.*','variants.options.*','variants.price_set.prices.*','variants.price_set.prices.price_rules.*']
/** Default is a read-only report. Apply requires the reviewed report and unchanged records. */
export default async function simplifyHairClaws({ container }: any) {
  const mode = process.env.CLAW_ORDER_CHOICES_MODE ?? 'plan'
  const path = process.env.CLAW_ORDER_CHOICES_REPORT
  if (!path || !['plan', 'apply'].includes(mode)) throw Error('Provide a report path and plan/apply mode.')
  if (mode === 'apply' && !['local','staging'].includes(process.env.APP_ENV ?? '')) throw Error('Catalog application is restricted to local/staging.')
  const query = container.resolve('query'), products = container.resolve('product')
  const read = async (id?: string) => (await query.graph({ entity: 'product', ...(id ? { filters: {id} } : { pagination: {take: 1001} }), fields })).data
  if (mode === 'plan') {
    const rows = await read()
    if (rows.length > 1000) throw Error('Catalog requires paginated review.')
    const entries = rows.filter(isHairClaw).map((product: any) => {
      try { const plan = planClawOrderChoices(product); return { id: product.id, title: product.title, status: plan.current ? 'current' : 'ready', fingerprint: fingerprint(product), before_metadata: product.metadata, metadata: plan.metadata, retained: plan.retained.map((id: string) => {const v = product.variants.find((v:any)=>v.id===id); return {id,sku:v.sku,barcode:v.barcode}}), retired: plan.retired } }
      catch (error) { return { id: product.id, title: product.title, status: 'review', message: (error as Error).message } }
    })
    await fs.writeFile(path, JSON.stringify({ version: 1, mode, created_at: new Date().toISOString(), entries }, null, 2), { mode: 0o600 })
    console.log(JSON.stringify({mode, ready:entries.filter((e:any)=>e.status==='ready').length, review:entries.filter((e:any)=>e.status==='review').length, report:path}))
    return
  }
  const report = JSON.parse(await fs.readFile(path,'utf8'))
  if (report.version !== 1 || report.mode !== 'plan' || !Array.isArray(report.entries)) throw Error('Use an unchanged generated plan.')
  const result:any[] = []
  for (const entry of report.entries.filter((e:any)=>e.status==='ready')) {
    await container.resolve('locking').execute(`hair-claw-media:${entry.id}`, async () => {
      const [fresh] = await read(entry.id)
      if (!fresh || fingerprint(fresh)!==entry.fingerprint) throw Error(`Catalog changed: ${entry.title}. Generate a fresh report.`)
      const plan = planClawOrderChoices(fresh)
      if (fingerprint(plan.metadata)!==fingerprint(entry.metadata)) throw Error('Reviewed metadata does not match the current migration.')
      await products.updateProducts(entry.id,{metadata:plan.metadata})
      const [saved] = await read(entry.id)
      if (fingerprint(saved.metadata)!==fingerprint(plan.metadata) || fingerprint(saved.variants)!==fingerprint(fresh.variants)) throw Error(`Catalog readback did not preserve variant records: ${entry.title}`)
      result.push({id:entry.id,title:entry.title,verified:true})
      await fs.writeFile(path+'.applied.json',JSON.stringify({complete:false,products:result},null,2),{mode:0o600})
    },{timeout:5,expire:300})
  }
  await fs.writeFile(path+'.applied.json',JSON.stringify({complete:true,products:result},null,2),{mode:0o600})
  console.log(JSON.stringify({mode,verified:result.length,report:path+'.applied.json'}))
}
