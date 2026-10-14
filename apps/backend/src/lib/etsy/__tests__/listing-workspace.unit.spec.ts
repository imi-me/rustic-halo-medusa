import { getOwnedListing, listingCopy, updateEtsyCopy } from '../listing-workspace'
import { emptyEtsyDraft } from '../../product-admin'
const access = { shopId: 123, scopes: ['listings_w'], headers: {} }
const original = process.env
beforeEach(() => {
  process.env = { ...original, ETSY_LISTING_WRITES_ENABLED: 'true' }
})
afterEach(() => {
  process.env = original
})
const listing = () => ({
  listing_id: 456,
  shop_id: 123,
  title: 'Original',
  description: 'Original copy',
  tags: ['old tag'],
  materials: ['wood'],
})
const draft = () => ({
  ...emptyEtsyDraft(),
  listing_id: '456',
  title: 'Updated',
  description: 'Updated copy',
  tags: ['hair claw'],
  materials: ['wood'],
})
const response = (value: any) => ({ ok: true, json: async () => value }) as Response
it('checks connected-shop ownership before exposing or changing a listing', async () => {
  await expect(
    getOwnedListing(
      access,
      '456',
      jest.fn().mockResolvedValue(response({ ...listing(), shop_id: 999 })),
    ),
  ).rejects.toThrow('does not belong')
})
it('requires verified write activation and a fresh before/after comparison', async () => {
  const request = jest.fn().mockResolvedValue(response(listing()))
  process.env.ETSY_LISTING_WRITES_ENABLED = 'false'
  await expect(updateEtsyCopy(access, draft(), listingCopy(listing()), request)).rejects.toThrow(
    'disabled',
  )
  expect(request).not.toHaveBeenCalled()
  process.env.ETSY_LISTING_WRITES_ENABLED = 'true'
  await expect(
    updateEtsyCopy(access, draft(), { ...listingCopy(listing()), title: 'Stale' }, request),
  ).rejects.toThrow('changed')
  expect(request).toHaveBeenCalledTimes(1)
})
it('updates only copy fields and confirms their read-back without publishing or changing stock', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(response(listing()))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ ...listing(), ...draft(), listing_id: 456 }))
  await updateEtsyCopy(access, draft(), listingCopy(listing()), request)
  const body = request.mock.calls[1][1].body as URLSearchParams
  expect([...body.keys()].sort()).toEqual(['description', 'materials', 'tags', 'title'])
  expect(request.mock.calls[1][1].method).toBe('PATCH')
})
it('reports an accepted request with ignored tags as unconfirmed instead of success', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(response(listing()))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(
      response({ ...listing(), title: draft().title, description: draft().description }),
    )
  await expect(updateEtsyCopy(access, draft(), listingCopy(listing()), request)).rejects.toThrow(
    'did not read back',
  )
})
