// Portable server-side identity reader for MarketSuite. No writes or persistent secrets.
export async function readMedusaIdentities({ origin, key, locationId, fetchImpl = fetch, now = () => Date.now() }) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.pathname !== '/' || !locationId || typeof key !== 'string' || key.length < 32 || key.length > 512) {
    throw new Error('Invalid inventory connection configuration')
  }
  const started = now(), items = [], seen = new Set()
  let offset = 0, firstTimestamp
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    if (now() - started > 60_000) throw new Error('Identity read exceeded snapshot window')
    const url = new URL('/integrations/marketsuite/catalog', base)
    url.searchParams.set('offset', String(offset))
    let response, page
    try {
      response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(10_000), cache: 'no-store' })
      if (!response.ok) throw new Error('Request failed')
      page = await response.json()
    } catch {
      throw new Error('Identity read failed; no complete snapshot returned')
    }
    const timestamp = Date.parse(page.capturedAt)
    if (page.schemaVersion !== 1 || page.source !== 'medusa' || page.locationId !== locationId ||
        page.sourceLocationId !== 'gid://shopify/Location/79837790404' || page.consistency !== 'paginated-non-atomic' ||
        !Number.isFinite(timestamp) || timestamp > now() + 30_000 || now() - timestamp > 120_000 ||
        !Array.isArray(page.items) || page.items.length > 100 ||
        (page.nextOffset !== null && (page.nextOffset !== offset + 100 || page.items.length !== 100)) ||
        page.complete !== (offset === 0 && page.nextOffset === null)) throw new Error('Invalid or incomplete identity page')
    firstTimestamp ??= page.capturedAt
    for (const item of page.items) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id) ||
          typeof item.shopifyVariantId !== 'string' || !/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(item.shopifyVariantId)) {
        throw new Error('Invalid or duplicate inventory identity')
      }
      seen.add(item.id); items.push({ id: item.id, shopifyVariantId: item.shopifyVariantId })
    }
    if (page.nextOffset === null) return { schemaVersion: 1, source: 'medusa', locationId,
      sourceLocationId: page.sourceLocationId, capturedAt: firstTimestamp,
      completedAt: new Date(now()).toISOString(), complete: true, consistency: 'paginated-non-atomic', items }
    offset = page.nextOffset
  }
  throw new Error('Identity page limit exceeded; no complete snapshot returned')
}
