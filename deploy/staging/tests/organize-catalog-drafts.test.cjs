const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm')
const code = fs.readFileSync(require.resolve('../organize-catalog-drafts.cjs'), 'utf8')
async function run(failDownload) {
  const files = {}, writes = []
  const product = { id: 'draft1', status: 'draft', thumbnail: 'https://cdn.shopify.com/a.png',
    images: [{ id: 'img1', url: 'https://cdn.shopify.com/a.png' }], collection_id: null,
    metadata: { imported_from: 'shopify_catalog_snapshot', shopify_id: 'source1', source_product_type: 'coasters' } }
  const clone = x => JSON.parse(JSON.stringify(x))
  const productService = {
    listProducts: async () => [clone(product), { id: 'pilot', status: 'published', metadata: { shopify_id: 'pilot' } }],
    retrieveProduct: async () => clone(product), listProductCollections: async () => [],
    createProductCollections: async () => ({ id: 'coasters' }),
    updateProducts: async (id, update) => { writes.push(id); Object.assign(product, update) },
  }
  const context = { exports: {}, Buffer, URL, Set, AbortSignal, console: { log() {} },
    process: { env: { APP_ENV: 'staging', R2_STORAGE_ENABLED: 'true', R2_BUCKET: 'rustic-halo-images' } },
    fetch: async () => ({ ok: !failDownload, headers: new Map([['content-type', 'image/png']]), body: [Buffer.from('image')] }),
    require: name => name === 'node:fs/promises' ? {
      readFile: async p => { if (!(p in files)) throw Object.assign(Error(), { code: 'ENOENT' }); return files[p] },
      writeFile: async (p, v) => { files[p] = v }, rename: async (a, b) => { files[b] = files[a]; delete files[a] },
    } : require(name),
  }
  vm.runInNewContext(code, context)
  const container = { resolve: name => name === 'product' ? productService : { createFiles: async () => ({ url: 'https://cdn.rustichalo.com/image.png' }) } }
  return { invoke: () => context.exports.default({ container }), writes, product, files }
}
test('verified CDN migration updates draft only and resume does not repeat update', async () => {
  const r = await run(false); await r.invoke(); await r.invoke()
  assert.deepEqual(r.writes, ['draft1']); assert.equal(r.product.status, 'draft')
  assert.equal(r.product.collection_id, 'coasters'); assert.equal(r.product.thumbnail, 'https://cdn.rustichalo.com/image.png')
})
test('failed source download leaves product images and collection unchanged', async () => {
  const r = await run(true); await assert.rejects(r.invoke(), /require review/)
  assert.equal(r.writes.length, 0); assert.equal(r.product.collection_id, null)
  assert.equal(r.product.thumbnail, 'https://cdn.shopify.com/a.png')
})
