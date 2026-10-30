import { createHash } from 'node:crypto'
import { ADMIN_OPERATIONS } from '../../modules/admin-operations'
import { etsyWorkspaceAccess, getOwnedListing } from './listing-workspace'
import type { colorExport } from '../product-admin'

type Export = ReturnType<typeof colorExport>
type Access = Awaited<ReturnType<typeof etsyWorkspaceAccess>>
const canonical = (name: string) =>
  /colou?r/i.test(name)
    ? 'color'
    : /size/i.test(name)
      ? 'size'
      : /finish/i.test(name)
        ? 'finish'
        : name.toLowerCase()
const normalized = (key: string, value: string) =>
  key === 'size'
    ? (String(value).match(/\d+(?:\.\d+)?/)?.[0] ?? value.toLowerCase())
    : value.toLowerCase().trim()
export function inventoryBody(inventory: any) {
  if (!Array.isArray(inventory.products)) throw new Error('Etsy returned invalid inventory.')
  return {
    products: inventory.products
      .filter((row: any) => !row.is_deleted)
      .map((row: any) => ({
        sku: row.sku,
        property_values: row.property_values.map((property: any) => ({
          property_id: property.property_id,
          property_name: property.property_name,
          scale_id: property.scale_id ?? null,
          value_ids: property.value_ids ?? [],
          values: property.values,
        })),
        offerings: row.offerings
          .filter((offer: any) => !offer.is_deleted)
          .map((offer: any) => {
            if (offer.price?.currency_code !== 'USD' || !offer.price.divisor)
              throw new Error('Color sharing currently requires USD listings.')
            return {
              price: offer.price.amount / offer.price.divisor,
              quantity: offer.quantity,
              is_enabled: offer.is_enabled,
              ...(offer.readiness_state_id ? { readiness_state_id: offer.readiness_state_id } : {}),
            }
          }),
      })),
    price_on_property: inventory.price_on_property ?? [],
    quantity_on_property: inventory.quantity_on_property ?? [],
    sku_on_property: inventory.sku_on_property ?? [],
    readiness_state_on_property: inventory.readiness_state_on_property ?? [],
  }
}
// Etsy keeps Color as a buyer choice, but it no longer changes SKU, price or allocation.
function planOrderColorSharing(inventory: any, selection: Export) {
  const body = inventoryBody(inventory)
  if (!body.products.length || body.products.some((row: any) => row.offerings.length !== 1)) throw Error('Review existing Etsy inventory before simplifying colors.')
  const schema = body.products[0].property_values
  const colorProperty = schema.find((p: any) => canonical(p.property_name) === 'color')
  if (!colorProperty) throw Error('Set up the existing Etsy Color choice before sharing.')
  const combination = (values: any[], includeColor = true) => JSON.stringify(values.filter(p => includeColor || p.property_id !== colorProperty.property_id).map(p => [p.property_id, normalized(canonical(p.property_name), p.values[0])]).sort())
  const changes: any[] = [], groups = new Map<string, any>()
  for (const selected of selection.variants) {
    if (selected.color_mode !== 'order' || selected.inventory_mode !== 'made_to_order_color_option') throw Error('Review mixed stock/color policies before sharing.')
    const options = Object.fromEntries(Object.entries(selected.options).map(([name,value]) => [canonical(name), String(value)]))
    const values = schema.map((property: any) => {
      const desired = options[canonical(property.property_name)]
      if (!desired) throw Error(`Map ${property.property_name} before sharing.`)
      const saved = body.products.flatMap((row: any) => row.property_values).find((p: any) => p.property_id === property.property_id && normalized(canonical(p.property_name), p.values[0]) === normalized(canonical(p.property_name), desired))
      return saved ?? { ...property, value_ids: [], values: [desired] }
    })
    const key = combination(values, false), group = groups.get(key)
    if (group && (group.sku !== selected.sku || group.price !== selected.price || group.quantity !== selected.quantity)) throw Error('Colors of one size/finish must share the original SKU, price and Etsy allocation.')
    groups.set(key, selected)
    const match = body.products.find((row: any) => combination(row.property_values) === combination(values))
    const next = { sku: selected.sku, property_values: values, offerings: [{ ...(match?.offerings[0] ?? body.products[0].offerings[0]), price: selected.price, quantity: selected.quantity, is_enabled: selected.quantity > 0 }] }
    changes.push({ sku: selected.sku, medusa_sku: selected.sku, color: selected.color, before: match ? {sku: match.sku, ...match.offerings[0]} : null, after: next.offerings[0], image_url: selected.image_url })
    if (match) body.products[body.products.indexOf(match)] = next
    else body.products.push(next)
  }
  // Retain existing choices, quantities and prices. Fail rather than silently alter an unreviewed offer.
  for (const row of body.products) {
    const selected = groups.get(combination(row.property_values, false))
    if (!selected) throw Error('Include every existing Etsy size/finish in the review before simplifying its SKUs.')
    if (row.offerings[0].price !== selected.price || row.offerings[0].quantity !== selected.quantity || row.offerings[0].is_enabled !== (selected.quantity > 0)) throw Error('Existing Etsy colors have different prices or allocations. Review all colors together before simplifying.')
    row.sku = selected.sku
  }
  const combinations = body.products.map((row: any) => combination(row.property_values))
  if (new Set(combinations).size !== combinations.length) throw Error('Etsy has duplicate color combinations.')
  const ids = schema.filter((p: any) => p.property_id !== colorProperty.property_id).map((p: any) => p.property_id)
  body.sku_on_property = ids
  body.price_on_property = ids
  body.quantity_on_property = ids
  if (body.products.length > 400) throw Error('Review this listing’s combination limit before sharing.')
  return { body, changes, preserved: body.products.length - changes.length, note: 'Color is an order choice. Original design SKUs are shared across colors; only actual size/finish offers remain. No Copper Mill inventory is copied.' }
}
export function planColorSharing(inventory: any, selection: Export, existingFinish: string) {
  if (selection.variants.length && selection.variants.every(row => row.color_mode === 'order')) return planOrderColorSharing(inventory, selection)
  const body = inventoryBody(inventory)
  if (!selection.variants.length) throw new Error('Select at least one saved sellable color.')
  if (selection.variants.some((row) => row.inventory_mode !== 'made_to_order_color_option'))
    throw new Error(
      'Live color sharing supports made-to-order variants only. Stocked products need verified channel stock allocation first.',
    )
  const skus = body.products.map((row: any) => row.sku)
  if (
    skus.some((sku: string) => !sku) ||
    new Set(skus).size !== skus.length ||
    body.products.some((row: any) => row.offerings.length !== 1)
  )
    throw new Error(
      'Existing Etsy inventory needs unique SKUs and one offering per variant before sharing.',
    )
  const properties: any[] = body.products[0]?.property_values ?? []
  if (
    !properties.some((row) => canonical(row.property_name) === 'color') ||
    !properties.some((row) => canonical(row.property_name) === 'size')
  )
    throw new Error(
      'Set up the existing Etsy listing with Size and Color variations first. Existing options are never replaced blindly.',
    )
  if (
    body.products.some(
      (row: any) =>
        JSON.stringify(row.property_values.map((property: any) => property.property_id).sort()) !==
        JSON.stringify(properties.map((property) => property.property_id).sort()),
    )
  )
    throw new Error('Etsy option structure is inconsistent; review the listing first.')
  const hasFinish = selection.variants.some((row) =>
    Object.keys(row.options).some((name) => canonical(name) === 'finish'),
  )
  if (hasFinish && !properties.some((row) => canonical(row.property_name) === 'finish')) {
    if (!existingFinish.trim() || properties.length >= 3)
      throw new Error(
        'Specify the finish of existing Etsy variants before adding a third Finish option.',
      )
    const id = [513, 514, 516].find((id) => !properties.some((row) => row.property_id === id))!
    const finish = {
      property_id: id,
      property_name: 'Finish',
      scale_id: null,
      value_ids: [],
      values: [existingFinish.trim()],
    }
    for (const row of body.products) row.property_values.push({ ...finish })
  }
  const schema = body.products[0].property_values
  const changes: any[] = []
  for (const selected of selection.variants) {
    const options = Object.fromEntries(
      Object.entries(selected.options).map(([name, value]) => [canonical(name), String(value)]),
    )
    const values = schema.map((property: any) => {
      const key = canonical(property.property_name),
        desired = options[key]
      if (!desired)
        throw new Error(`Map the ${property.property_name} option before sharing ${selected.sku}.`)
      const existing = body.products
        .flatMap((row: any) => row.property_values)
        .find(
          (row: any) =>
            row.property_id === property.property_id &&
            normalized(key, row.values[0]) === normalized(key, desired),
        )
      return existing
        ? { ...existing }
        : {
            property_id: property.property_id,
            property_name: property.property_name,
            scale_id: property.scale_id,
            value_ids: [],
            values: [desired],
          }
    })
    const targetSku = selected.etsy_sku || selected.sku
    const match = body.products.find((row: any) => row.sku === targetSku)
    if (selected.etsy_sku && selected.etsy_sku !== selected.sku && !match) throw new Error(`Existing Etsy SKU ${selected.etsy_sku} was not found. Review the listing mapping.`)
    if (
      match &&
      match.property_values.some((property: any) => {
        const desired = values.find((row: any) => row.property_id === property.property_id)
        return (
          normalized(canonical(property.property_name), property.values[0]) !==
          normalized(canonical(property.property_name), desired.values[0])
        )
      })
    )
      throw new Error(`SKU ${selected.sku} belongs to different Etsy options. Review the mapping.`)
    if (
      !match &&
      body.products.some((row: any) =>
        row.property_values.every((property: any) => {
          const desired = values.find((row: any) => row.property_id === property.property_id)
          return (
            normalized(canonical(property.property_name), property.values[0]) ===
            normalized(canonical(property.property_name), desired.values[0])
          )
        }),
      )
    )
      throw new Error(
        `The ${selected.sku} combination already exists under a different Etsy SKU. Resolve the mapping first.`,
      )
    const offering = match?.offerings[0] ?? body.products[0].offerings[0]
    const next = {
      sku: targetSku,
      property_values: match?.property_values ?? values,
      offerings: [
        {
          ...offering,
          price: selected.price,
          quantity: selected.quantity,
          is_enabled: selected.quantity > 0,
        },
      ],
    }
    changes.push({
      sku: targetSku,
      medusa_sku: selected.sku,
      color: selected.color,
      before: match
        ? { price: match.offerings[0].price, quantity: match.offerings[0].quantity }
        : null,
      after: { price: selected.price, quantity: selected.quantity },
      image_url: selected.image_url,
    })
    if (match) body.products[body.products.indexOf(match)] = next
    else body.products.push(next)
  }
  if (body.products.length > 400)
    throw new Error(
      'This inventory plan exceeds the 400-combination limit for independent variant prices and quantities.',
    )
  const ids = schema.map((property: any) => property.property_id)
  body.price_on_property = ids
  body.quantity_on_property = ids
  body.sku_on_property = ids
  const combos = body.products.map((row: any) =>
    JSON.stringify(
      row.property_values
        .map((property: any) => [
          property.property_id,
          normalized(canonical(property.property_name), property.values[0]),
        ])
        .sort(),
    ),
  )
  if (new Set(combos).size !== combos.length)
    throw new Error('Sharing would create duplicate Etsy combinations.')
  return {
    body,
    changes,
    preserved: body.products.length - changes.length,
    note: 'Updates only selected made-to-order variants; retains every other Etsy SKU. Quantities are explicit Etsy selling limits, not shared location stock. Adding Finish labels existing variants with the finish you specified.',
  }
}
async function inventory(access: Access, listingId: string, request: typeof fetch = fetch) {
  const response = await request(
    `https://openapi.etsy.com/v3/application/listings/${listingId}/inventory?max_variations_supported=3`,
    { headers: access.headers, signal: AbortSignal.timeout(20000) },
  )
  if (!response.ok) throw new Error('Etsy inventory could not be read.')
  return response.json() as Promise<any>
}
const fingerprint = (value: any) =>
  createHash('sha256')
    .update(JSON.stringify(inventoryBody(value)))
    .digest('hex')
export async function reviewColorSharing(
  access: Access,
  selection: Export,
  existingFinish: string,
  request: typeof fetch = fetch,
) {
  await getOwnedListing(access, selection.listing_id!, request)
  const current = await inventory(access, selection.listing_id!, request)
  return {
    ...planColorSharing(current, selection, existingFinish),
    expected_inventory: fingerprint(current),
    writesEnabled:
      process.env.ETSY_COLOR_SHARING_ENABLED === 'true' &&
      process.env.ETSY_LISTING_WRITES_ENABLED === 'true' &&
      access.scopes.includes('listings_w'),
  }
}
export async function applyColorSharing(
  scope: any,
  access: Access,
  selection: Export,
  existingFinish: string,
  expected: string,
  request: typeof fetch = fetch,
) {
  if (
    process.env.ETSY_COLOR_SHARING_ENABLED !== 'true' ||
    process.env.ETSY_LISTING_WRITES_ENABLED !== 'true' ||
    !access.scopes.includes('listings_w')
  )
    throw new Error(
      'Live Etsy color sharing is disabled until listing write permissions and the made-to-order policy are verified.',
    )
  const review = await reviewColorSharing(access, selection, existingFinish, request)
  if (review.expected_inventory !== expected)
    throw new Error('Etsy inventory changed after review. Request a fresh comparison.')
  const ops = scope.resolve(ADMIN_OPERATIONS)
  const operation = await ops.createAdminOperations({
    operation_key: `etsy-colors:${selection.listing_id}:${Date.now()}`,
    kind: 'etsy-colors',
    resource_id: selection.product_id,
    status: 'applying',
    payload: { listing_id: selection.listing_id, before: expected, desired: review.body },
  })
  const response = await request(
    `https://openapi.etsy.com/v3/application/listings/${selection.listing_id}/inventory?max_variations_supported=3`,
    {
      method: 'PUT',
      headers: { ...access.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(review.body),
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!response.ok)
    throw new Error('Etsy color update could not be confirmed. Review Etsy before trying again.')
  const fresh = inventoryBody(await inventory(access, selection.listing_id!, request))
  for (const row of review.body.products) {
    const confirmed = fresh.products.find((item: any) => item.sku === row.sku && item.property_values.length === row.property_values.length && item.property_values.every((p:any) => row.property_values.some((v:any) => v.property_id === p.property_id && normalized(canonical(v.property_name), v.values[0]) === normalized(canonical(p.property_name), p.values[0]))))
    if (
      !confirmed ||
      JSON.stringify(confirmed.property_values.map((property: any) => property.property_id).sort()) !== JSON.stringify(row.property_values.map((property: any) => property.property_id).sort()) ||
      JSON.stringify(confirmed.offerings) !== JSON.stringify(row.offerings) ||
      confirmed.property_values.some((property: any) => {
        const desired = row.property_values.find(
          (item: any) => item.property_id === property.property_id,
        )
        return (
          !desired ||
          normalized(canonical(property.property_name), property.values[0]) !==
            normalized(canonical(desired.property_name), desired.values[0])
        )
      })
    )
      throw new Error(
        'Etsy accepted the request but the color inventory did not read back as expected. Review Etsy before retrying.',
      )
  }
  for (const key of ['sku_on_property','price_on_property','quantity_on_property'] as const) if (JSON.stringify([...fresh[key]].sort()) !== JSON.stringify([...review.body[key]].sort())) throw Error('Etsy variation rules did not read back as expected.')
  await ops.updateAdminOperations({ id: operation.id, status: 'complete' })
  return {
    changes: review.changes,
    message:
      'Etsy color options, SKU prices and quantities confirmed. Upload and link the approved static images in Etsy; existing photos were preserved.',
  }
}
