const fs = require('node:fs/promises')
const { createHash } = require('node:crypto')
const reportPath = '/tmp/catalog-organization.json'
const digest = body => createHash('sha256').update(body).digest('hex')
const groups = {
  earrings: ['earrings', 'Earrings'], claws: ['hair-accessories-claws-and-clips', 'Hair claws & clips'],
  signs: ['novelty-signs', 'Signs for your space'], coasters: ['coasters', 'Coasters'],
  gifts: ['gifts-home-decor', 'Gifts & home décor'],
}
function groupFor(p) {
  const overrides = {
    'gid://shopify/Product/8546835824836': 'gifts',
    'gid://shopify/Product/8583756742852': 'earrings',
    'gid://shopify/Product/8626033983684': 'earrings',
    'gid://shopify/Product/8697606996164': 'claws',
  }
  if (overrides[p.metadata.shopify_id]) return overrides[p.metadata.shopify_id]
  const type = p.metadata.source_product_type
  if (['Stud Earrings', 'Dangle Earrings', 'Drop Earrings', 'Dangle', 'Earrings'].includes(type)) return 'earrings'
  if (['Hair Claw', 'Hair Accessories'].includes(type)) return 'claws'
  if (type === 'Round Wood Sign') return 'signs'
  if (type === 'coasters') return 'coasters'
  if (['Bread Board', 'Gift Boxes', 'Christmas Ornament', 'Christmas Food Tray', 'Tumbler Topper', 'Shelf Sitter', 'Mason Jar Sign', 'Christmas Countdown', 'Wall Decor'].includes(type)) return 'gifts'
  throw Error('Unmapped product type')
}
async function bytes(url) {
  const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) })
  if (!r.ok) throw Error('Image request failed')
  const chunks = []; let size = 0
  for await (const chunk of r.body) {
    size += chunk.length
    if (size > 20000000) throw Error('Image too large')
    chunks.push(chunk)
  }
  if (!size) throw Error('Empty image')
  return { body: Buffer.concat(chunks), type: r.headers.get('content-type')?.split(';')[0] }
}
exports.groupFor = groupFor
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || process.env.R2_STORAGE_ENABLED !== 'true' || process.env.R2_BUCKET !== 'rustic-halo-images') throw Error('Staging CDN required')
  const service = container.resolve('product')
  let report
  try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')) }
  catch (e) { if (e.code !== 'ENOENT') throw e; report = { startedAt: new Date().toISOString(), before: {}, map: {}, updated: [], failures: [], complete: false } }
  const save = async () => { await fs.writeFile(reportPath + '.next', JSON.stringify(report, null, 2), { mode: 0o600 }); await fs.rename(reportPath + '.next', reportPath) }
  const products = []
  for (let skip = 0; ; skip += 100) {
    const page = await service.listProducts({}, { skip, take: 100, order: { id: 'ASC' }, relations: ['images'] })
    products.push(...page.filter(p => p.status === 'draft' && p.metadata?.imported_from === 'shopify_catalog_snapshot'))
    if (page.length < 100) break
    if (skip >= 10000) throw Error('Unexpected catalog size')
  }
  // Validate every classification before making any changes.
  products.forEach(groupFor)
  report.selected = products.length; report.failures = []; report.complete = false; await save()
  const collections = {}
  for (const key of new Set(products.map(groupFor))) {
    const [handle, title] = groups[key]
    const found = await service.listProductCollections({ handle })
    if (found.length > 1) throw Error('Ambiguous collection')
    collections[key] = found[0] || await service.createProductCollections({ handle, title })
  }
  for (const candidate of products) {
    if (report.updated.includes(candidate.id)) continue
    try {
      const p = await service.retrieveProduct(candidate.id, { relations: ['images'] })
      if (p.status !== 'draft' || p.metadata?.imported_from !== 'shopify_catalog_snapshot') throw Error('Product changed')
      if (!report.before[p.id]) { report.before[p.id] = { thumbnail: p.thumbnail, images: p.images, collection_id: p.collection_id, metadata: p.metadata }; await save() }
      const urls = [...new Set([p.thumbnail, ...p.images.map(i => i.url)].filter(Boolean))]
      for (const url of urls) {
        const u = new URL(url)
        if (u.origin === 'https://cdn.rustichalo.com') continue
        if (u.protocol !== 'https:' || u.hostname !== 'cdn.shopify.com') throw Error('Unexpected source')
        if (report.map[url]) continue
        const { body, type } = await bytes(url)
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[type]
        if (!ext) throw Error('Unsupported image')
        const sha = digest(body)
        const file = await container.resolve('file').createFiles({ filename: 'catalog-' + sha.slice(0, 20) + '.' + ext, mimeType: type, content: body.toString('base64'), access: 'public' })
        if (new URL(file.url).origin !== 'https://cdn.rustichalo.com') throw Error('Unexpected destination')
        if (digest((await bytes(file.url)).body) !== sha) throw Error('CDN verification failed')
        report.map[url] = { url: file.url, sha256: sha, bytes: body.length }; await save()
      }
      const current = await service.retrieveProduct(p.id, { relations: ['images'] })
      if (current.status !== 'draft' || current.thumbnail !== p.thumbnail || JSON.stringify(current.images) !== JSON.stringify(p.images) || current.collection_id !== p.collection_id || JSON.stringify(current.metadata) !== JSON.stringify(p.metadata)) throw Error('Product changed during transfer')
      const resolve = url => report.map[url]?.url || url
      await service.updateProducts(p.id, { collection_id: p.collection_id || collections[groupFor(p)].id,
        thumbnail: resolve(p.thumbnail), images: p.images.map(i => ({ id: i.id, url: resolve(i.url) })),
        metadata: { ...p.metadata, image_migration: p.images.length ? 'verified_cdn' : 'missing_source_image' } })
      const saved = await service.retrieveProduct(p.id, { relations: ['images'] })
      if (saved.status !== 'draft' || saved.thumbnail !== resolve(p.thumbnail) || p.images.some(i => !saved.images.some(s => s.id === i.id && s.url === resolve(i.url)))) throw Error('Saved image verification failed')
      report.updated.push(p.id); await save()
      if (report.updated.length % 25 === 0) console.log('CATALOG_ORGANIZATION_PROGRESS ' + report.updated.length)
    } catch (e) { report.failures.push({ productId: candidate.id, reason: 'Product transfer or update requires review' }); await save() }
  }
  report.complete = report.failures.length === 0; report.finishedAt = new Date().toISOString(); await save()
  console.log('CATALOG_ORGANIZED ' + JSON.stringify({ complete: report.complete, updated: report.updated.length, failed: report.failures.length, images: Object.keys(report.map).length }))
  if (!report.complete) throw Error('Some products require review; see organization report')
}
