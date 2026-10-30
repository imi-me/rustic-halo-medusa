const OPTION_NAME = 'Color'
const TEMPLATE_ID = 'rustic_halo_hair_claw_v1'

const clone = value => JSON.parse(JSON.stringify(value))
const text = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${name} is required`)
  return value.trim()
}

function validatePolicy(policy) {
  if (!policy || policy.optionName !== OPTION_NAME || !Array.isArray(policy.colors) || !policy.colors.length) {
    throw Error('Invalid hair-claw color policy')
  }
  const names = new Set(), suffixes = new Set()
  for (const row of policy.colors) {
    const name = text(row.name, 'Color name')
    const suffix = text(row.suffix, 'Color suffix')
    if (!/^[A-Z0-9-]+$/.test(suffix) || names.has(name.toLowerCase()) || suffixes.has(suffix)) {
      throw Error('Duplicate or invalid hair-claw color')
    }
    names.add(name.toLowerCase()); suffixes.add(suffix)
  }
  return policy.colors.map(row => ({ name: row.name.trim(), suffix: row.suffix.trim() }))
}

function validateBaseVariant(row, optionNames) {
  const baseSku = text(row.baseSku, 'Base SKU')
  if (baseSku.endsWith('-')) throw Error(`Invalid base SKU ${baseSku}`)
  const options = row.options && Object.keys(row.options).length ? clone(row.options) : { Style: 'Standard' }
  if (Object.hasOwn(options, OPTION_NAME)) throw Error(`Base variant ${baseSku} already contains Color`)
  for (const name of Object.keys(options)) {
    text(name, 'Option name'); text(options[name], `Option value for ${name}`); optionNames.add(name)
  }
  if (!Array.isArray(row.prices) || !row.prices.length) throw Error(`Prices are required for ${baseSku}`)
  for (const price of row.prices) {
    text(price.currency_code, 'Price currency')
    if (!Number.isFinite(Number(price.amount)) || Number(price.amount) < 0) throw Error(`Invalid price for ${baseSku}`)
  }
  const allowed = [
    'title', 'barcode', 'ean', 'upc', 'thumbnail', 'hs_code', 'origin_country',
    'mid_code', 'material', 'weight', 'length', 'height', 'width', 'metadata',
  ]
  const clean = Object.fromEntries(allowed.filter(key => row[key] !== undefined).map(key => [key, clone(row[key])]))
  return { ...clean, baseSku, options, prices: clone(row.prices) }
}

function buildHairClawDraft(spec, policy) {
  validatePolicy(policy)
  const title = text(spec?.title, 'Product title')
  const handle = text(spec?.handle, 'Product handle')
  const shippingProfileId = text(spec?.shipping_profile_id, 'Shipping profile ID')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) throw Error('Product handle must be lowercase words separated by hyphens')
  if (!Array.isArray(spec.baseVariants) || !spec.baseVariants.length) throw Error('At least one base variant is required')
  const optionNames = new Set(), baseSkus = new Set()
  const bases = spec.baseVariants.map(row => validateBaseVariant(row, optionNames))
  const expectedOptions = [...optionNames].sort()
  for (const base of bases) {
    if (baseSkus.has(base.baseSku) || JSON.stringify(Object.keys(base.options).sort()) !== JSON.stringify(expectedOptions)) {
      throw Error('Base SKUs must be unique and use the same option names')
    }
    baseSkus.add(base.baseSku)
  }
  const options = expectedOptions.map(name => ({
    title: name,
    values: [...new Set(bases.map(base => base.options[name]))],
  }))
  const variants = bases.map(base => {
    const { baseSku, metadata, ...fields } = base
    return { ...fields, sku: baseSku, manage_inventory: true, allow_backorder: true, requires_shipping: true,
      metadata: { ...(metadata || {}), inventory_mode: 'made_to_order', color_mode: 'order' } }
  })
  return {
    title, handle, status: 'draft',
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.thumbnail ? { thumbnail: spec.thumbnail } : {}),
    ...(spec.images ? { images: clone(spec.images) } : {}),
    ...(spec.collection_id ? { collection_id: spec.collection_id } : {}),
    shipping_profile_id: shippingProfileId,
    options, variants,
    metadata: {
      ...(spec.metadata || {}), product_template: TEMPLATE_ID, catalog_review_required: true,
      inventory_mode: 'made_to_order', color_mode: 'order',
    },
  }
}

function planMissingColorVariants(products, policy, colorName) {
  const colors = validatePolicy(policy)
  const color = colors.find(row => row.name.toLowerCase() === text(colorName, 'Color').toLowerCase())
  if (!color) throw Error(`Color is not in the approved policy: ${colorName}`)
  // Palette additions never allocate another SKU, barcode, or stock record.
  return { color, products: [], variantCount: 0 }

}

module.exports = { OPTION_NAME, TEMPLATE_ID, validatePolicy, buildHairClawDraft, planMissingColorVariants }
