import sharp from 'sharp'
import { prepareCopyPhotos, publicCopyPhoto, CopyPhotoError } from '../photos'
import { copyInputSchema, generateProductCopy } from '../product-copy'

const input = { action: 'description' as const, title: 'Hair claw', description: '', material: '', facts: '', category: '', attributes: '', locked_tags: [] }
it('allows only public approved CDN photos without credentials or secret query parameters', () => {
  expect(publicCopyPhoto('https://cdn.rustichalo.com/photo.jpg')).toBe(true)
  expect(publicCopyPhoto('https://cdn.shopify.com/photo.jpg?v=123&width=1024')).toBe(true)
  for (const url of ['http://cdn.rustichalo.com/a.jpg', 'https://cdn.rustichalo.com.evil.invalid/a.jpg', 'https://user:secret@cdn.rustichalo.com/a.jpg', 'https://127.0.0.1/a.jpg', 'https://cdn.rustichalo.com/a.jpg?token=secret', 'https://cdn.rustichalo.com:444/a.jpg', 'file:///tmp/a.jpg', 'blob:untrusted']) expect(publicCopyPhoto(url)).toBe(false)
})
it('bounds photo count and payload before the provider and never fetches unapproved URLs', async () => {
  expect(copyInputSchema.safeParse({ ...input, photos: Array(4).fill('https://cdn.rustichalo.com/a.jpg') }).success).toBe(false)
  expect(copyInputSchema.safeParse({ ...input, photos: ['x'.repeat(1_400_001)] }).success).toBe(false)
  await expect(prepareCopyPhotos(['https://localhost/a.jpg'])).rejects.toBeInstanceOf(CopyPhotoError)
  await expect(prepareCopyPhotos(Array(2).fill('https://cdn.rustichalo.com/a.jpg'))).rejects.toThrow('different')
  await expect(prepareCopyPhotos(['data:image/jpeg;base64,aGVsbG8='])).rejects.toThrow('read')
})
it('normalizes local previews into bounded still JPEGs without uploading or saving', async () => {
  const jpeg = await sharp({ create: { width: 1300, height: 1100, channels: 3, background: 'white' } }).jpeg().toBuffer()
  const [photo] = await prepareCopyPhotos([`data:image/jpeg;base64,${jpeg.toString('base64')}`])
  const metadata = await sharp(Buffer.from(photo.split(',')[1], 'base64')).metadata()
  expect(metadata.width).toBe(1024)
  expect(metadata.height).toBeLessThan(1024)
  expect(metadata.exif).toBeUndefined()
  const oversized = await sharp({ create: { width: 2200, height: 2200, channels: 3, background: 'white' } }).jpeg().toBuffer()
  await expect(prepareCopyPhotos([`data:image/jpeg;base64,${oversized.toString('base64')}`])).rejects.toBeInstanceOf(CopyPhotoError)
})
it('sends explicit multimodal content while keeping photo bytes out of text facts; text-only remains supported', async () => {
  const original = process.env
  process.env = { ...original, ADMIN_ASSISTANT_ENABLED: 'true', ADMIN_ASSISTANT_PROVIDER: 'openrouter', ADMIN_ASSISTANT_OPENROUTER_API_KEY: 'test-only', ADMIN_ASSISTANT_MODEL: 'test-model', COOKIE_SECRET: 'test' }
  try {
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ title: '', description: 'Floral hair claw.', tags: [], explanation: 'Visible motif.' }) }] }] }) })
    await generateProductCopy({ ...input, photos: ['https://cdn.rustichalo.com/a.jpg'] }, request)
    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body.input[0].content[1]).toEqual({ type: 'input_image', image_url: 'https://cdn.rustichalo.com/a.jpg', detail: 'auto' })
    expect(JSON.parse(body.input[0].content[0].text)).not.toHaveProperty('photos')
    expect(body.instructions).toContain('do not establish material')
    expect(body).not.toHaveProperty('tools')
    await generateProductCopy(input, request)
    expect(typeof JSON.parse(request.mock.calls[1][1].body).input[0].content).toBe('string')
    request.mockClear()
    await expect(generateProductCopy({ ...input, photos: ['https://internal.invalid/a.jpg'] }, request)).rejects.toBeInstanceOf(CopyPhotoError)
    expect(request).not.toHaveBeenCalled()
  } finally { process.env = original }
})
