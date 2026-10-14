import { reviewColorImages, shareColorImages } from '../color-images'
const access = { shopId: 123, scopes: ['listings_w'], headers: {} }
const selection = (): any => ({
  listing_id: '456',
  product_id: 'prod_one',
  title: 'Hair claw',
  variants: [{ sku: 'ROSE', color: 'Rose', image_url: 'https://cdn.rustichalo.com/rose.png' }],
})
const imageLinks = [{ property_id: 514, value_id: 15, image_id: 9 }]
function fixture(uncertain = false) {
  const operations: any[] = [],
    links = [...imageLinks],
    images = [{ listing_image_id: 9 }]
  const ops = {
    listAdminOperations: async (filter: any) =>
      operations.filter((row) => row.operation_key === filter.operation_key),
    createAdminOperations: async (row: any) => {
      const operation = { ...row, id: 'op_image' }
      operations.push(operation)
      return operation
    },
    updateAdminOperations: async (row: any) =>
      Object.assign(
        operations.find((operation) => operation.id === row.id),
        row,
      ),
  }
  const request = jest.fn(async (url: any, init: any = {}) => {
    if (String(url).startsWith('https://cdn.'))
      return new Response(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), {
        headers: { 'Content-Type': 'image/png' },
      })
    if (String(url).includes('variation-images')) {
      if (init.method === 'POST')
        links.splice(0, links.length, ...JSON.parse(init.body).variation_images)
      return { ok: true, json: async () => ({ results: links }) } as Response
    }
    if (String(url).includes('/inventory'))
      return {
        ok: true,
        json: async () => ({
          products: [
            {
              sku: 'ROSE',
              property_values: [{ property_id: 514, property_name: 'Color', value_ids: [14] }],
            },
          ],
        }),
      } as Response
    if (String(url).endsWith('/images')) {
      if (init.method === 'POST') {
        if (uncertain) throw Error('upload timeout')
        images.push({ listing_image_id: 10 })
        return { ok: true, json: async () => ({ listing_image_id: 10 }) } as Response
      }
      return { ok: true, json: async () => ({ results: images }) } as Response
    }
    return { ok: true, json: async () => ({ shop_id: 123, listing_id: 456 }) } as Response
  })
  return { operations, links, images, scope: { resolve: () => ops }, request }
}
const original = process.env
beforeEach(() => {
  process.env = {
    ...original,
    ETSY_LISTING_WRITES_ENABLED: 'true',
    ETSY_COLOR_SHARING_ENABLED: 'true',
  }
})
afterEach(() => {
  process.env = original
})
it('links approved color photos while retaining existing photos and other color associations', async () => {
  const f = fixture(),
    review = await reviewColorImages(access, selection(), f.request)
  await shareColorImages(f.scope, access, selection(), review.existing, f.request)
  expect(f.images).toEqual([{ listing_image_id: 9 }, { listing_image_id: 10 }])
  expect(f.links).toEqual([...imageLinks, { property_id: 514, value_id: 14, image_id: 10 }])
  const second = await reviewColorImages(access, selection(), f.request)
  await shareColorImages(f.scope, access, selection(), second.existing, f.request)
  expect(
    f.request.mock.calls.filter(
      ([, init]) => init?.method === 'POST' && init?.body instanceof FormData,
    ),
  ).toHaveLength(1)
})
it('blocks repeated uploads after an uncertain result rather than duplicating photos', async () => {
  const f = fixture(true)
  await expect(
    shareColorImages(f.scope, access, selection(), imageLinks, f.request),
  ).rejects.toThrow('timeout')
  await expect(
    shareColorImages(f.scope, access, selection(), imageLinks, f.request),
  ).rejects.toThrow('unconfirmed')
  expect(
    f.request.mock.calls.filter(
      ([, init]) => init?.method === 'POST' && init?.body instanceof FormData,
    ),
  ).toHaveLength(1)
})
it('refuses multiple different images for the same Etsy color across sizes or finishes', async () => {
  const f = fixture(),
    data = selection()
  data.variants.push({
    ...data.variants[0],
    image_url: 'https://cdn.rustichalo.com/rose-other.png',
  })
  await expect(reviewColorImages(access, data, f.request)).rejects.toThrow('one image per color')
})
it('rejects source hosts outside the approved public CDN without fetching them', async () => {
  const f = fixture(),
    data = selection()
  data.variants[0].image_url = 'http://127.0.0.1/private'
  await expect(shareColorImages(f.scope, access, data, imageLinks, f.request)).rejects.toThrow(
    'approved public media host',
  )
  expect(f.request.mock.calls.some(([url]) => String(url).startsWith('http://127.'))).toBe(false)
})
