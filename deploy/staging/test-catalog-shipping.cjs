const fs = require('node:fs/promises')
exports.default = async function ({ container }) {
  if (process.env.APP_ENV !== 'staging' || !process.env.SHIPPO_API_KEY?.startsWith('shippo_test_')) throw Error('Staging Shippo test credentials required')
  const fulfillment = container.resolve('fulfillment'), products = container.resolve('product')
  const options = await fulfillment.listShippingOptions({ provider_id: 'shippo-test_shippo' })
  const option = options.find(o => o.data?.id === 'usps_ground_advantage' && o.price_type === 'calculated')
  if (!option) throw Error('Calculated test shipping option missing')
  const skus = ['37146-2', '38081'] // Imported Coffee Cup claw and Striped Pumpkin Studs.
  for (const sku of skus) {
    const found = await products.listProductVariants({ sku })
    if (found.length !== 1 || !found[0].metadata?.shopify_variant_id) throw Error('Imported SKU mapping missing or ambiguous')
  }
  const address = { first_name: 'Staging', last_name: 'Quote Test',
    address_1: process.env.SHIPPO_FROM_STREET1, city: process.env.SHIPPO_FROM_CITY,
    province: process.env.SHIPPO_FROM_STATE, postal_code: process.env.SHIPPO_FROM_ZIP, country_code: 'us' }
  if (!address.address_1 || !address.city || !address.province || !address.postal_code) throw Error('Origin test address missing')
  const report = { startedAt: new Date().toISOString(), mode: 'sandbox_provider_quote_not_store_cart', results: [], complete: false }
  const save = () => fs.writeFile('/tmp/catalog-shipping-test.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  await save()
  const quote = items => fulfillment.calculateShippingOptionsPrices([{ id: option.id, provider_id: option.provider_id,
    optionData: option.data, data: {}, context: { currency_code: 'usd', shipping_address: address, items } }])
  for (const [claws, earrings] of [[2, 4], [1, 6], [3, 1]]) {
    const items = [{ quantity: claws, variant_sku: skus[0] }, { quantity: earrings, variant_sku: skus[1] }]
    const [price] = await quote(items)
    const amount = Number(price?.calculated_amount)
    if (!Number.isFinite(amount) || amount <= 0) throw Error('Invalid sandbox quote')
    report.results.push({ claws, earring_pairs: earrings, amount, currency: 'usd' }); await save()
  }
  let blocked = false
  try { await quote([{ quantity: 1, variant_sku: 'unconfigured-coaster' }]) }
  catch (e) { if (String(e.message).includes('Shipping measurements are not confirmed')) blocked = true; else throw e }
  if (!blocked) throw Error('Unconfigured product unexpectedly quoted')
  report.unconfiguredProductBlocked = true; report.complete = true; report.completedAt = new Date().toISOString(); await save()
  console.log('CATALOG_SHIPPING_TEST ' + JSON.stringify({ quotes: report.results.length, unconfiguredProductBlocked: true, ordersCreated: 0, labelsPurchased: 0 }))
}
