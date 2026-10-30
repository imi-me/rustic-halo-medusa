import { createHash } from 'node:crypto'
import type { colorExport } from '../product-admin'
import { ADMIN_OPERATIONS } from '../../modules/admin-operations'
import type { etsyWorkspaceAccess } from './listing-workspace'
import { getOwnedListing } from './listing-workspace'
type Access = Awaited<ReturnType<typeof etsyWorkspaceAccess>>
type Export = ReturnType<typeof colorExport>
const api = 'https://openapi.etsy.com/v3/application'
async function read(url: string, access: Access, request: typeof fetch) {
  const response = await request(url, {
    headers: access.headers,
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error('Etsy image associations could not be read.')
  return response.json() as Promise<any>
}
export async function reviewColorImages(
  access: Access,
  selection: Export,
  request: typeof fetch = fetch,
) {
  await getOwnedListing(access, selection.listing_id!, request)
  const [inventory, images, associations] = await Promise.all([
    read(
      `${api}/listings/${selection.listing_id}/inventory?max_variations_supported=3`,
      access,
      request,
    ),
    read(`${api}/listings/${selection.listing_id}/images`, access, request),
    read(
      `${api}/shops/${access.shopId}/listings/${selection.listing_id}/variation-images`,
      access,
      request,
    ),
  ])
  const selected = selection.variants.filter((row) => row.image_url)
  if (!selected.length)
    throw new Error('Choose approved static images for the selected colors first.')
  const desired = new Map<string, any>()
  let propertyId: number | null = null
  for (const row of selected) {
    const variant = inventory.products?.find(
      (variant: any) => variant.sku === (row.etsy_sku || row.sku) && !variant.is_deleted && (row.color_mode !== 'order' || variant.property_values?.every((p:any) => { const key = Object.keys(row.options).find(name => /colou?r/i.test(p.property_name) ? /colou?r/i.test(name) : /size/i.test(p.property_name) ? /size/i.test(name) : /finish/i.test(p.property_name) ? /finish/i.test(name) : name.toLowerCase() === p.property_name.toLowerCase()); const wanted = key ? row.options[key] : undefined; return wanted && (/size/i.test(p.property_name) ? String(wanted).match(/\d+/)?.[0] === String(p.values[0]).match(/\d+/)?.[0] : String(wanted).toLowerCase() === String(p.values[0]).toLowerCase()) })),
    )
    const color = variant?.property_values?.find((property: any) =>
      /colou?r/i.test(property.property_name),
    )
    if (!color?.value_ids?.[0])
      throw new Error(`Share and confirm ${row.sku} in Etsy inventory before linking its image.`)
    if (propertyId && propertyId !== color.property_id)
      throw new Error('All color images must use the same Etsy color property.')
    propertyId = color.property_id
    const key = `${color.property_id}:${color.value_ids[0]}`
    if (desired.has(key) && desired.get(key).image_url !== row.image_url)
      throw new Error(
        'Etsy links photos to one variation type. Choose one image per color across sizes and finishes, or separate those listings.',
      )
    desired.set(key, {
      property_id: color.property_id,
      value_id: color.value_ids[0],
      image_url: row.image_url,
      color: row.color,
      sku: row.etsy_sku || row.sku,
    })
  }
  const existing = associations.results ?? []
  if (existing.some((row: any) => row.property_id !== propertyId))
    throw new Error(
      'This listing already links images to another variation type. Review the existing links in Etsy before switching to Color.',
    )
  return {
    desired: [...desired.values()],
    images: images.results ?? [],
    existing,
    writesEnabled:
      process.env.ETSY_COLOR_SHARING_ENABLED === 'true' &&
      process.env.ETSY_LISTING_WRITES_ENABLED === 'true' &&
      access.scopes.includes('listings_w'),
    note: 'Uploads approved static previews and links one image per color. Existing photos and unrelated color links are retained.',
  }
}
export async function shareColorImages(
  scope: any,
  access: Access,
  selection: Export,
  expectedLinks: any,
  request: typeof fetch = fetch,
) {
  const review = await reviewColorImages(access, selection, request)
  if (!review.writesEnabled)
    throw new Error('Enable verified Etsy listing/color writes before sharing images.')
  if (JSON.stringify(review.existing) !== JSON.stringify(expectedLinks))
    throw new Error('Etsy image links changed after review. Request a fresh comparison.')
  const ops = scope.resolve(ADMIN_OPERATIONS)
  const links = review.existing.map((row: any) => ({
    property_id: row.property_id,
    value_id: row.value_id,
    image_id: row.image_id,
  }))
  let imageCount = review.images.length
  for (const desired of review.desired) {
    const key = `etsy-image:${selection.listing_id}:${createHash('sha256').update(desired.image_url).digest('hex')}`
    let [operation] = await ops.listAdminOperations({ operation_key: key })
    if (operation && operation.status !== 'uploaded')
      throw new Error(
        'An earlier Etsy image upload is unconfirmed. Review Etsy before retrying; duplicate uploads are blocked.',
      )
    if (!operation) {
      if (imageCount >= 20)
        throw new Error(
          'The Etsy listing has no free photo slots. Review existing photos in Etsy; none were removed.',
        )
      const source = new URL(desired.image_url)
      const hosts = [
        'cdn.rustichalo.com',
        ...(process.env.ETSY_EXPORT_IMAGE_HOSTS ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ]
      if (
        source.protocol !== 'https:' ||
        source.username ||
        source.password ||
        !hosts.includes(source.hostname) ||
        source.port
      )
        throw new Error('Export images must come from the approved public media host.')
      const image = await request(source, { redirect: 'error', signal: AbortSignal.timeout(15000) })
      if (
        !image.ok ||
        Number(image.headers.get('content-length') ?? 0) > 10000000 ||
        !/^image\/(png|jpeg|webp)/.test(image.headers.get('content-type') ?? '')
      )
        throw new Error('Approved image could not be loaded safely.')
      const reader = image.body?.getReader()
      if (!reader) throw new Error('Image body unavailable.')
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.length
        if (size > 10000000) {
          await reader.cancel()
          throw new Error('Image exceeds the export size limit.')
        }
        chunks.push(part.value)
      }
      const bytes = Buffer.concat(chunks)
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      if (!png && !jpeg) throw new Error('Share approved PNG or JPEG images with Etsy.')
      operation = await ops.createAdminOperations({
        operation_key: key,
        kind: 'etsy-image',
        resource_id: selection.product_id,
        status: 'uploading',
        payload: { listing_id: selection.listing_id, source: desired.image_url },
      })
      const body = new FormData()
      body.append(
        'image',
        new Blob([bytes], { type: png ? 'image/png' : 'image/jpeg' }),
        `hair-claw-${desired.color}.${png ? 'png' : 'jpg'}`,
      )
      body.append('rank', String(imageCount + 1))
      body.append('overwrite', 'false')
      body.append(
        'alt_text',
        `${selection.title || 'Hair claw'} in ${desired.color} — color preview`.slice(0, 500),
      )
      const response = await request(
        `${api}/shops/${access.shopId}/listings/${selection.listing_id}/images`,
        { method: 'POST', headers: access.headers, body, signal: AbortSignal.timeout(20000) },
      )
      if (!response.ok)
        throw new Error('Etsy image upload is unconfirmed. Check Etsy before retrying.')
      const result: any = await response.json()
      if (!Number.isSafeInteger(result.listing_image_id))
        throw new Error('Etsy did not confirm the uploaded image ID.')
      operation = await ops.updateAdminOperations({
        id: operation.id,
        status: 'uploaded',
        payload: { ...operation.payload, image_id: result.listing_image_id },
      })
      imageCount++
    } else if (
      !review.images.some((image: any) => image.listing_image_id === operation.payload.image_id)
    )
      throw new Error(
        'A previously shared image was removed in Etsy. Review the image mapping before uploading again.',
      )
    const link = {
      property_id: desired.property_id,
      value_id: desired.value_id,
      image_id: operation.payload.image_id,
    }
    const index = links.findIndex(
      (row: any) => row.property_id === link.property_id && row.value_id === link.value_id,
    )
    if (index < 0) links.push(link)
    else links[index] = link
  }
  const endpoint = `${api}/shops/${access.shopId}/listings/${selection.listing_id}/variation-images`
  const currentLinks = await read(endpoint, access, request)
  if (JSON.stringify(currentLinks.results ?? []) !== JSON.stringify(review.existing)) throw new Error('Images were uploaded, but Etsy image links changed during export. Request a fresh review before linking them.')
  const response = await request(endpoint, {
    method: 'POST',
    headers: { ...access.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ variation_images: links }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok)
    throw new Error(
      'Images were uploaded but color links are unconfirmed. Review Etsy before retrying.',
    )
  const confirmed = await read(endpoint, access, request)
  if (
    links.some(
      (link: any) =>
        !confirmed.results?.some(
          (row: any) =>
            row.property_id === link.property_id &&
            row.value_id === link.value_id &&
            row.image_id === link.image_id,
        ),
    )
  )
    throw new Error(
      'Etsy color-image links did not read back as expected. Review Etsy before retrying.',
    )
  return {
    message:
      'Approved color images uploaded and linked to Etsy color selections; existing photos preserved.',
  }
}
