const fs = require('node:fs/promises')

function selectProducts(products, catalog, channelId, profileId) {
  const selected = []
  for (const p of products) {
    if (p.metadata?.imported_from !== 'shopify_catalog_snapshot' || p.status !== 'draft') continue
    if (!p.thumbnail?.startsWith('https://cdn.rustichalo.com/') || !p.variants?.length) continue
    if (p.variants.some(v => !Object.hasOwn(catalog, v.sku || ''))) continue
    if (p.shipping_profile && p.shipping_profile.id !== profileId) throw Error('Unexpected shipping profile')
    if (p.sales_channels?.some(c => c.id !== channelId)) throw Error('Unexpected sales channel')
    if (p.variants.some(v => !v.manage_inventory || v.inventory_items?.length !== 1)) throw Error('Unexpected inventory configuration')
    selected.push(p)
  }
  return selected
}
exports.selectProducts = selectProducts
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging') throw Error('Staging only')
  const { Modules, ContainerRegistrationKeys } = require('@medusajs/framework/utils')
  const { createInventoryLevelsWorkflow, updateProductVariantsWorkflow } = require('@medusajs/medusa/core-flows')
  const query = container.resolve('query'), link = container.resolve(ContainerRegistrationKeys.LINK)
  const inventory = container.resolve('inventory'), fulfillment = container.resolve('fulfillment')
  const catalog = require('../lib/shipping-catalog.json')
  const { data: locations } = await query.graph({ entity: 'stock_location', fields: ['id', 'name', 'sales_channels.id', 'fulfillment_sets.id'] })
  const online = locations.filter(l => l.name === 'Shopify On-line Store — Local Snapshot')
  const market = locations.filter(l => l.name === 'Copper Mill @ Greenvillle — Local Snapshot')
  if (online.length !== 1 || market.length !== 1 || online[0].sales_channels?.length !== 1 || !online[0].fulfillment_sets?.length) throw Error('Online location not uniquely configured')
  const channelId = online[0].sales_channels[0].id
  if (locations.some(l => l.id !== online[0].id && l.sales_channels?.some(c => c.id === channelId))) throw Error('Online channel shares another stock location')
  const profiles = await fulfillment.listShippingProfiles({ name: 'Local test products' })
  if (profiles.length !== 1) throw Error('Expected one existing shipping profile')
  const profileId = profiles[0].id
  if (!(await fulfillment.listShippingOptions({ shipping_profile_id: profileId })).some(o => o.provider_id === 'shippo-test_shippo')) throw Error('Expected test shipping option')
  const products = []
  for (let skip = 0; ; skip += 100) {
    const { data } = await query.graph({ entity: 'product', fields: ['id', 'title', 'status', 'metadata', 'thumbnail', 'shipping_profile.id', 'sales_channels.id', 'variants.id', 'variants.sku', 'variants.manage_inventory', 'variants.allow_backorder', 'variants.inventory_items.inventory_item_id'], pagination: { skip, take: 100, order: { id: 'ASC' } } })
    products.push(...data); if (data.length < 100) break
    if (skip >= 10000) throw Error('Catalog limit')
  }
  const selected = selectProducts(products, catalog, channelId, profileId)
  if (selected.length !== 242) throw Error('Readiness count changed; re-audit before applying')
  const levels = new Map(), itemIds = new Set()
  for (const p of selected) for (const v of p.variants) {
    const id = v.inventory_items[0].inventory_item_id
    if (itemIds.has(id)) throw Error('Shared inventory item requires review')
    itemIds.add(id)
    const rows = await inventory.listInventoryLevels({ inventory_item_id: id }, { take: 100 })
    if (rows.some(l => l.location_id !== online[0].id) || rows.length > 1) throw Error('Preserving inventory at another location; review required')
    levels.set(id, rows)
  }
  const report = { startedAt: new Date().toISOString(), complete: false, channelId, profileId, onlineLocationId: online[0].id, marketLocationId: market[0].id, before: selected, updated: [] }
  const save = () => fs.writeFile('/tmp/online-drafts-setup.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  for (const p of selected) {
    if (!p.shipping_profile) await link.create({ [Modules.PRODUCT]: { product_id: p.id }, [Modules.FULFILLMENT]: { shipping_profile_id: profileId } })
    if (!p.sales_channels?.length) await link.create({ [Modules.PRODUCT]: { product_id: p.id }, [Modules.SALES_CHANNEL]: { sales_channel_id: channelId } })
    for (const v of p.variants) {
      const id = v.inventory_items[0].inventory_item_id
      if (!levels.get(id).length) await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: [{ inventory_item_id: id, location_id: online[0].id, stocked_quantity: 0 }] } })
    }
    await updateProductVariantsWorkflow(container).run({ input: { product_variants: p.variants.map(v => ({ id: v.id, allow_backorder: true })) } })
    const { data } = await query.graph({ entity: 'product', filters: { id: p.id }, fields: ['id', 'status', 'shipping_profile.id', 'sales_channels.id', 'variants.id', 'variants.manage_inventory', 'variants.allow_backorder'] })
    const saved = data[0]
    if (saved?.status !== 'draft' || saved.shipping_profile?.id !== profileId || saved.sales_channels?.length !== 1 || saved.sales_channels[0].id !== channelId || saved.variants?.length !== p.variants.length || saved.variants.some(v => !v.manage_inventory || !v.allow_backorder)) throw Error('Post-update verification failed')
    for (const v of p.variants) {
      const id = v.inventory_items[0].inventory_item_id
      const current = await inventory.listInventoryLevels({ inventory_item_id: id }, { take: 100 })
      const before = levels.get(id)[0]
      if (current.length !== 1 || current[0].location_id !== online[0].id || Number(current[0].stocked_quantity) !== Number(before?.stocked_quantity ?? 0) || Number(current[0].reserved_quantity) !== Number(before?.reserved_quantity ?? 0)) throw Error('Inventory verification failed')
    }
    report.updated.push(p.id); await save()
  }
  report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('ONLINE_DRAFTS_PREPARED ' + report.updated.length)
}
