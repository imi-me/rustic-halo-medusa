import { exchangeEtsyCode, getEtsyListingInventories, getEtsyOwnedShopByName, listEtsyListings, listEtsyShopReceipts, listEtsyShops, refreshEtsyAccessToken } from '../client'
test('listing reads authenticate with a bearer token and never use a write endpoint',async()=>{const fetcher=jest.fn().mockResolvedValue({ok:true,json:async()=>({count:1,results:[{listing_id:9}]})}) as any; const result=await listEtsyListings({keystring:'key',secret:'secret',accessToken:'token',shopId:7},fetcher); expect(String(fetcher.mock.calls[0][0])).toBe('https://openapi.etsy.com/v3/application/shops/7/listings/active?limit=100&offset=0'); expect(fetcher.mock.calls[0][1].headers).toMatchObject({'x-api-key':'key:secret',Authorization:'Bearer token'}); expect(result).toMatchObject({total:1,nextOffset:null})})
test('invalid pages fail before contacting Etsy',async()=>{const fetcher=jest.fn() as any; await expect(listEtsyListings({keystring:'key',secret:'secret',accessToken:'token',shopId:0},fetcher)).rejects.toThrow('Invalid Etsy listing page.'); expect(fetcher).not.toHaveBeenCalled()})
test('inventory batches read variation SKUs without using a write endpoint', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ listing_id: 9, inventory: { products: [{ sku: 'RH-9' }] } }] }) }) as any
  await expect(getEtsyListingInventories({ keystring: 'key', secret: 'secret', accessToken: 'token', listingIds: [9, 10] }, fetcher)).resolves.toHaveLength(1)
  expect(String(fetcher.mock.calls[0][0])).toBe('https://openapi.etsy.com/v3/application/listings/batch/inventory?listing_ids=9%2C10')
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('method')
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ 'x-api-key': 'key:secret', Authorization: 'Bearer token' })
})
const invalidInventoryBatches: number[][] = [[], [0], [1, 1], Array.from({ length: 101 }, (_, index) => index + 1)]
test.each(invalidInventoryBatches.map(listingIds => [listingIds]))('invalid inventory batch fails before contacting Etsy %#', async (listingIds) => {
  const fetcher = jest.fn() as any
  await expect(getEtsyListingInventories({ keystring: 'key', secret: 'secret', accessToken: 'token', listingIds }, fetcher)).rejects.toThrow('Invalid Etsy inventory batch.')
  expect(fetcher).not.toHaveBeenCalled()
})

test('receipt report uses only the read-only shop receipts endpoint', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 1, results: [{ receipt_id: 44 }] }) }) as any
  await expect(listEtsyShopReceipts({ keystring: 'key', secret: 'secret', accessToken: 'token', shopId: 7, minCreated: 1700000000, maxCreated: 1700086400 }, fetcher)).resolves.toMatchObject({ total: 1, nextOffset: null })
  expect(String(fetcher.mock.calls[0][0])).toBe('https://openapi.etsy.com/v3/application/shops/7/receipts?min_created=1700000000&max_created=1700086400&limit=100&offset=0')
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('method')
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ 'x-api-key': 'key:secret', Authorization: 'Bearer token' })
})

test('invalid receipt ranges fail before contacting Etsy', async () => {
  const fetcher = jest.fn() as any
  await expect(listEtsyShopReceipts({ keystring: 'key', secret: 'secret', accessToken: 'token', shopId: 7, minCreated: 1700086400, maxCreated: 1700000000 }, fetcher)).rejects.toThrow('Invalid Etsy receipt page.')
  expect(fetcher).not.toHaveBeenCalled()
})

test('token exchange requires the Etsy account identity', async () => { const fetcher=jest.fn().mockResolvedValue({ok:true,json:async()=>({access_token:'42.a',refresh_token:'r',expires_in:3600})}) as any; await expect(exchangeEtsyCode({keystring:'key',secret:'secret',code:'code',verifier:'verifier',redirectUri:'https://example.com/callback'},fetcher)).resolves.toMatchObject({user_id:42}); expect(fetcher.mock.calls[0][0]).toBe('https://openapi.etsy.com/v3/public/oauth/token'); })
test('refresh exchanges an encrypted-at-rest session for an Etsy access token', async () => { const fetcher=jest.fn().mockResolvedValue({ok:true,json:async()=>({access_token:'42.a',refresh_token:'next',expires_in:3600})}) as any; await expect(refreshEtsyAccessToken({keystring:'key',secret:'secret',refreshToken:'stored'},fetcher)).resolves.toMatchObject({access_token:'42.a',refresh_token:'next'}); expect(fetcher.mock.calls[0][1]).toMatchObject({method:'POST'}); expect(String(fetcher.mock.calls[0][1].body)).toContain('grant_type=refresh_token') })
test('shop lookup is read-only', async () => { const fetcher=jest.fn().mockResolvedValue({ok:true,json:async()=>({shop_id:2,shop_name:'rustichalodotcom'})}) as any; await expect(listEtsyShops({keystring:'key',secret:'secret',accessToken:'token',userId:42},fetcher)).resolves.toEqual([{shop_id:2,shop_name:'rustichalodotcom'}]); expect(String(fetcher.mock.calls[0][0])).toContain('/users/42/shops'); expect(fetcher.mock.calls[0][1].headers['x-api-key']).toBe('key:secret') })
test('shop lookup also accepts Etsy collection responses', async () => { const fetcher=jest.fn().mockResolvedValue({ok:true,json:async()=>({results:[{shop_id:2,shop_name:'rustichalodotcom'}]})}) as any; await expect(listEtsyShops({keystring:'key',secret:'secret',accessToken:'token',userId:42},fetcher)).resolves.toEqual([{shop_id:2,shop_name:'rustichalodotcom'}]) })
const shopInput = { keystring: 'key', secret: 'secret', shopName: 'rustichalodotcom', userId: 42 }
const ownedShop = { shop_id: 2, shop_name: 'RusticHaloDotCom', user_id: 42 }
test('public shop match requires the authenticated owner identity', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [ownedShop] }) }) as any
  await expect(getEtsyOwnedShopByName(shopInput, fetcher)).resolves.toEqual({ shop_id: 2, shop_name: 'RusticHaloDotCom' })
  expect(String(fetcher.mock.calls[0][0])).toBe('https://openapi.etsy.com/v3/application/shops?shop_name=rustichalodotcom')
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ 'x-api-key': 'key:secret' })
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
})
test.each([
  [{ ...ownedShop, user_id: 43 }],
  [{ ...ownedShop, user_id: undefined }],
  [{ ...ownedShop, user_id: '42' }],
  [{ ...ownedShop, shop_name: 'another-shop' }],
  [ownedShop, ownedShop],
  [{ ...ownedShop, shop_id: 0 }],
].map(results => [results]))('rejects unproven or ambiguous shop ownership %#', async (results) => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) }) as any
  await expect(getEtsyOwnedShopByName(shopInput, fetcher)).rejects.toThrow('Etsy shop identity needs review.')
})
