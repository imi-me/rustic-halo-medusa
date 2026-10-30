import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { homepagePhotoSource, suggestHomepage, suggestionInput, type SuggestionInput } from '../suggestions'
import * as assistant from '../../admin-assistant'
import { POST } from '../../../api/admin/storefront-content/suggest/route'
const originalEnv = process.env
const input = (kind: SuggestionInput['kind'] = 'section'): SuggestionInput => ({ kind, brief: 'Welcome shoppers to the fall collection.', title: 'Fall favorites', description: 'Wooden earrings and hair claws.', eyebrow: 'New collection', action: 'Shop the collection', alt: '', photo: '' })
const output = () => ({ eyebrow: 'A little fall', title: 'Find your fall favorite', description: 'Explore the collection.', action: 'Shop fall', alt: '', seoTitle: '', seoDescription: '', note: 'Review before use.' })
const respond = (data: any, status = 'completed') => ({ ok: true, json: async () => ({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }) }) as Response
beforeEach(() => { jest.restoreAllMocks(); process.env = { ...originalEnv, ADMIN_ASSISTANT_ENABLED: 'true', ADMIN_ASSISTANT_PROVIDER: 'openai', ADMIN_ASSISTANT_OPENAI_API_KEY: 'fixture', ADMIN_ASSISTANT_MODEL: 'fixture-model', COOKIE_SECRET: 'fixture', ADMIN_CORS: 'https://staging.rustichalo.com' } })
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks() })
test('suggestions use the existing provider, bounded structured text and no tools or storage', async () => {
  const request = jest.fn(async () => respond(output()))
  expect((await suggestHomepage(input(), request as any)).title).toBe(output().title)
  const body = JSON.parse((request.mock.calls[0] as any)[1].body)
  expect(body.store).toBe(false); expect(body.tools).toBeUndefined(); expect(body.max_output_tokens).toBe(1500); expect(body.text.format.strict).toBe(true)
  expect(body.instructions).toContain('cannot save, publish or change links')
})
test('only fields for the requested task can be returned, and required fields cannot be empty', async () => {
  await expect(suggestHomepage(input(), jest.fn(async () => respond({ ...output(), seoTitle: 'Unrequested change' })) as any)).rejects.toThrow('outside this section')
  await expect(suggestHomepage(input(), jest.fn(async () => respond({ ...output(), href: '/store' })) as any)).rejects.toThrow()
  await expect(suggestHomepage(input(), jest.fn(async () => respond({ ...output(), title: '' })) as any)).rejects.toThrow('required field')
  await expect(suggestHomepage(input(), jest.fn(async () => respond({ ...output(), title: 'x'.repeat(161) })) as any)).rejects.toThrow()
})
test('search wording stays separate from section copy and incomplete provider answers fail safely', async () => {
  const suggestion = { ...output(), eyebrow: '', title: '', description: '', action: '', seoTitle: 'Rustic Halo | Fall favorites', seoDescription: 'Explore Rustic Halo accessories.' }
  expect((await suggestHomepage(input('search'), jest.fn(async () => respond(suggestion)) as any)).seoTitle).toBe(suggestion.seoTitle)
  await expect(suggestHomepage(input(), jest.fn(async () => respond(output(), 'incomplete')) as any)).rejects.toThrow('incomplete')
})
test('bounded input rejects arbitrary additional fields and unsupported kinds', () => {
  expect(suggestionInput.safeParse({ ...input(), publish: true }).success).toBe(false)
  expect(suggestionInput.safeParse({ ...input(), kind: 'price' }).success).toBe(false)
  expect(suggestionInput.safeParse({ ...input(), brief: 'x'.repeat(1501) }).success).toBe(false)
})
test('image descriptions use an approved actual photo and reject unapproved remote URLs', async () => {
  const data = { ...input('alt'), photo: 'https://cdn.rustichalo.com/original-photo.jpg' }
  const result = { ...output(), eyebrow: '', title: '', description: '', action: '', alt: 'Wooden earrings beside greenery.' }
  const request = jest.fn(async () => respond(result)); await suggestHomepage(data, request as any)
  const body = JSON.parse((request.mock.calls[0] as any)[1].body)
  expect(body.input[0].content[1].image_url).toBe(data.photo)
  await expect(homepagePhotoSource('https://untrusted.invalid/photo.jpg')).rejects.toThrow()
  await expect(suggestHomepage(input('alt'), request as any)).rejects.toThrow('Choose an image')
})
test('bundled originals are read without mutation, and encoded traversal cannot read outside the brand folder', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rh-homepage-photo-')); process.env.APP_ROOT = root
  try {
    const brand = path.join(root, 'apps/storefront/public/brand'); await mkdir(brand, { recursive: true })
    const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#fff' } }).jpeg().toBuffer()
    await writeFile(path.join(brand, 'original.jpg'), bytes); await writeFile(path.join(root, 'apps/storefront/public/private.jpg'), bytes)
    expect(await homepagePhotoSource('/brand/original.jpg')).toMatch(/^data:image\/jpeg;base64,/)
    expect(await readFile(path.join(brand, 'original.jpg'))).toEqual(bytes)
    await expect(homepagePhotoSource('/brand/%2e%2e/private.jpg')).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})
function response() { const res: any = {}; res.status = jest.fn(() => res); res.json = jest.fn(() => res); res.sendStatus = jest.fn(() => res); res.setHeader = jest.fn(); return res }
const request = () => ({ auth_context: { actor_id: 'user-homepage-fixture', actor_type: 'user' }, headers: { origin: 'https://staging.rustichalo.com' }, body: input() }) as any
test('the suggestion route requires staff, a trusted origin, valid input and the existing assistant limit', async () => {
  let req = request(), res = response(); req.auth_context = undefined; await POST(req, res); expect(res.sendStatus).toHaveBeenCalledWith(401)
  req = request(); res = response(); req.headers.origin = 'https://untrusted.invalid'; await POST(req, res); expect(res.sendStatus).toHaveBeenCalledWith(403)
  req = request(); res = response(); req.body = { bad: true }; await POST(req, res); expect(res.status).toHaveBeenCalledWith(400)
  const locked = assistant.acquire('user-homepage-rate-fixture'); req = request(); req.auth_context.actor_id = 'user-homepage-rate-fixture'; res = response(); try { await POST(req, res); expect(res.status).toHaveBeenCalledWith(429) } finally { locked?.() }
})
test('provider failures retain the draft and always release the shared request slot', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(Error('private provider details'))
  const req = request(); req.auth_context.actor_id = 'user-homepage-failure-fixture'; const res = response(); await POST(req, res); expect(res.status).toHaveBeenCalledWith(502); expect(res.json.mock.calls[0][0].message).not.toContain('private provider'); const retry = response(); await POST(req, retry); expect(retry.status).toHaveBeenCalledWith(502); expect(retry.status).not.toHaveBeenCalledWith(429)
})
