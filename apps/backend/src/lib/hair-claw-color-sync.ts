import { randomUUID } from 'node:crypto'
import { Modules } from '@medusajs/framework/utils'
import { createProductOptionsWorkflow, createProductVariantsWorkflow, createAndLinkProductOptionsToProductWorkflow } from '@medusajs/medusa/core-flows'
import { offerProduct, offerTypes } from './hair-claw-offers'
import { variantClawColor, colorSupportsSize, type ClawColor } from './hair-claw-colors'
import { HAIR_CLAW_KEY } from './hair-claw-settings'
import { allocateBarcodes, pendingBarcodes } from './admin-product-create'

function prices(variant: any) {
  return (variant.price_set?.prices ?? []).filter((p: any) => !p.price_list_id).map((p: any) => ({ currency_code: p.currency_code, amount: Number(p.amount), min_quantity: p.min_quantity, max_quantity: p.max_quantity, rules: Object.fromEntries((p.price_rules ?? []).map((r: any) => [r.attribute, r.value])) })).sort((a: any, b: any) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}
export function planClawColorSync(product: any, palette: ClawColor[]) {
  const config = product.metadata?.hair_claw_template_v2, settings = product.metadata?.[HAIR_CLAW_KEY]
  if (!config || !settings) throw Error('Set up size/finish color variants for this legacy product first.')
  const colorOption = product.options.find((o: any) => o.id === config.color_option_id)
  if (!colorOption?.is_exclusive) throw Error('Review this product’s shared color option before adding colors.')
  const plans: any[] = []
  for (const type of offerTypes) {
    const ids = new Set(settings.offers?.[type.key]?.variant_ids ?? [])
    const group = product.variants.filter((v: any) => ids.has(v.id))
    if (!group.length) continue // Never invent or enable an unconfigured offer.
    for (const color of palette.filter(c => c.active && colorSupportsSize(c, type.size))) {
      if (group.some((v: any) => variantClawColor(product, v) === color.name)) continue
      const source = group[0], price = prices(source)
      if (!price.some((p: any) => p.currency_code === 'usd' && p.min_quantity == null && p.max_quantity == null && !Object.keys(p.rules).length) || group.some((v: any) => JSON.stringify(prices(v)) !== JSON.stringify(price))) throw Error(`${type.label}: colors have different or missing prices. Review prices before adding a color.`)
      if (group.some((v: any) => v.manage_inventory !== source.manage_inventory || v.allow_backorder !== source.allow_backorder)) throw Error(`${type.label}: review differing inventory policies before adding a color.`)
      const options = Object.fromEntries(source.options.map((o: any) => [product.options.find((p: any) => p.id === o.option_id)?.title, o.value]))
      if (Object.keys(options).includes('undefined')) throw Error('Product options changed. Review them before adding colors.')
      options[colorOption.title] = color.name
      const sku = `RH-HCC-${product.id.slice(-10)}-${type.key}-${color.slug.toUpperCase()}`
      const recovered = product.variants.find((v: any) => v.sku === sku)
      if (recovered && (recovered.metadata?.claw_palette_offer !== type.key || recovered.metadata?.base_claw_color !== color.name)) throw Error('A color SKU already belongs to a different variant. Review before retrying.')
      plans.push({ type, color, recovered, variant: { product_id: product.id, title: `${type.label} / ${color.name}`, sku, options, prices: price, manage_inventory: source.manage_inventory, allow_backorder: source.allow_backorder, weight: source.weight, material: source.material, hs_code: source.hs_code, origin_country: source.origin_country, mid_code: source.mid_code, length: source.length, width: source.width, height: source.height, metadata: { hair_claw_template: 'rustic_halo_hair_claw_v3', physical_size: type.size, claw_finish: type.finish, base_claw_color: color.name, claw_palette_offer: type.key, inventory_mode: source.metadata?.inventory_mode, ...(source.metadata?.shipping_package_v1 ? { shipping_package_v1: source.metadata.shipping_package_v1 } : {}) } } })
    }
  }
  if (!Object.values(settings.offers ?? {}).some((o: any) => o.variant_ids?.length)) throw Error('Configure an approved size/finish offer before adding color variants.')
  return { plans, colorOption, config, settings }
}
async function legacyColorSetup(scope: any, product: any, palette: ClawColor[]) {
  const originals = product.variants.filter((v: any) => !v.metadata?.claw_palette_offer)
  const sizes = [...String(product.description ?? '').matchAll(/\b([24])(?:-|\s*)inch/gi)].map(m => m[1])
  if (originals.length !== 1 || new Set(sizes).size !== 1) throw Error('This legacy product needs a confirmed physical size and one source variant before automatic color setup.')
  const source = originals[0], size = sizes[0], price = prices(source), products = scope.resolve(Modules.PRODUCT)
  if (!price.some((p: any) => p.currency_code === 'usd' && p.min_quantity == null && p.max_quantity == null && !Object.keys(p.rules).length)) throw Error('Set an unambiguous base USD price before adding colors.')
  const option = async (title: string, values: string[]) => {
    let found = product.options.find((o: any) => o.title === title)
    if (found && !found.is_exclusive) throw Error('Review this legacy product’s shared options before color setup.')
    if (!found) {
      found = (await createProductOptionsWorkflow(scope).run({ input: { product_options: [{ title, values, is_exclusive: true }] } })).result[0]
      await products.addProductOptionToProduct({ product_id: product.id, product_option_id: found.id })
    }
    return found
  }
  const sizeOption = await option('Claw size', [`${size} inch`]), colorOption = await option('Base color', palette.filter(c => c.active && colorSupportsSize(c, size as '2' | '4')).map(c => c.name))
  const config = { version: 2, policy: source.allow_backorder ? 'made_to_order' : 'stocked', palette: [], variant_ids: [], option_ids: [sizeOption.id, colorOption.id], size_option_id: sizeOption.id, color_option_id: colorOption.id, unlabelled_size: size }
  // Build an in-memory source group. The legacy storefront remains intact until
  // every new variant is saved and the final template metadata is published.
  return { ...product, options: [...product.options.filter((o: any) => ![sizeOption.id, colorOption.id].includes(o.id)), sizeOption, colorOption],
    variants: product.variants.map((v: any) => v.id === source.id ? { ...v, options: [...v.options, { option_id: sizeOption.id, value: `${size} inch` }], metadata: { ...v.metadata, physical_size: size, claw_finish: 'natural' } } : v),
    metadata: { ...product.metadata, hair_claw_template_v2: config, [HAIR_CLAW_KEY]: { ...product.metadata?.[HAIR_CLAW_KEY], revision: product.metadata?.[HAIR_CLAW_KEY]?.revision ?? null, recipes: product.metadata?.[HAIR_CLAW_KEY]?.recipes ?? {}, offers: { [`${size}-natural`]: { variant_ids: [source.id] } } } }, legacySourceId: source.id }
}
export async function syncClawProduct(scope: any, id: string, palette: ClawColor[]) {
  return scope.resolve(Modules.LOCKING).execute('rh-admin-product-identifiers', () => scope.resolve(Modules.LOCKING).execute(`hair-claw-media:${id}`, async () => {
    let product = await offerProduct(scope, id)
    const products = scope.resolve(Modules.PRODUCT)
    if (!product.metadata?.hair_claw_template_v2) product = await legacyColorSetup(scope, product, palette)
    const { plans, colorOption, config, settings } = planClawColorSync(product, palette)
    if (!plans.length) return { id, title: product.title, created: 0, status: 'current' }
    const names = [...new Set([...colorOption.values.map((v: any) => v.value), ...plans.map(p => p.color.name)])] as string[]
    const pending = plans.filter(p => !p.recovered)
    const collisions = pending.length ? await products.listProductVariants({ sku: pending.map(p => p.variant.sku) }, { take: 300 }) : []
    if (collisions.length) throw Error('A color SKU already exists elsewhere. Review before retrying.')
    const barcodes = await allocateBarcodes(products, pending.map(() => ({ barcode: '' })), await pendingBarcodes(scope))
    const addedValues = names.filter(name => !colorOption.values.some((v: any) => v.value === name))
    if (addedValues.length) await createAndLinkProductOptionsToProductWorkflow(scope).run({ input: { product_id: id, update: [{ product_option_id: colorOption.id, add: addedValues.map(value => ({ value })) }] } })
    const result = pending.length ? (await createProductVariantsWorkflow(scope).run({ input: { product_variants: pending.map((p, i) => ({ ...p.variant, barcode: barcodes[i] })) } })).result : []
    const variants = plans.map(p => p.recovered ?? result.find((v: any) => v.sku === p.variant.sku))
    if (variants.some(v => !v)) throw Error('Some new colors could not be confirmed. Retry to recover existing variants without duplicates.')
    const offers = structuredClone(settings.offers)
    if (product.legacySourceId) for (const offer of Object.values(offers) as any[]) offer.variant_ids = offer.variant_ids.filter((variantId: string) => variantId !== product.legacySourceId)
    plans.forEach((p, i) => { offers[p.type.key].variant_ids = [...new Set([...offers[p.type.key].variant_ids, variants[i].id])] })
    const latest = await products.retrieveProduct(id)
    await products.updateProducts(id, { metadata: { ...latest.metadata,
      hair_claw_template_v2: { ...config, palette: [...new Set([...config.palette, ...plans.map(p => p.color.name)])], variant_ids: [...new Set([...config.variant_ids, ...variants.map(v => v.id)])], ...(!config.default_variant_id ? { default_variant_id: variants[0].id } : {}) },
      [HAIR_CLAW_KEY]: { ...settings, offers, revision: randomUUID() },
    } })
    return { id, title: product.title, created: pending.length, recovered: plans.length - pending.length, status: 'updated' }
  }, { timeout: 5, expire: 300 }), { timeout: 5, expire: 300 })
}
