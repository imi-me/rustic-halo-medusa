import { copyInputSchema, generateProductCopy } from '../product-copy'
const input = () => ({
  action: 'etsy-tags' as const,
  title: 'Rose hair claw',
  description: 'Four-inch wood hair claw.',
  material: 'wood',
  facts: '',
  category: '',
  attributes: '',
  locked_tags: ['hair claw'],
})
const result = () => ({
  title: '',
  description: '',
  tags: [
    { tag: 'hair claw', reason: 'Product type' },
    ...Array.from({ length: 12 }, (_, index) => ({
      tag: `phrase ${index}`,
      reason: 'Test suggestion',
    })),
  ],
  explanation: 'Relevant phrases help query matching; ranking is not guaranteed.',
})
const original = process.env
beforeEach(() => {
  process.env = {
    ...original,
    ADMIN_ASSISTANT_ENABLED: 'true',
    ADMIN_ASSISTANT_PROVIDER: 'openai',
    ADMIN_ASSISTANT_OPENAI_API_KEY: 'mock',
    ADMIN_ASSISTANT_MODEL: 'mock-model',
    COOKIE_SECRET: 'mock',
  }
})
afterEach(() => {
  process.env = original
})
const response = (output: any) =>
  ({
    ok: true,
    json: async () => ({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] },
      ],
    }),
  }) as Response
it('returns validated proposals without saving and uses bounded structured output', async () => {
  const request = jest.fn().mockResolvedValue(response(result()))
  const suggestion = await generateProductCopy(input(), request)
  expect(suggestion.tags).toHaveLength(13)
  expect(request).toHaveBeenCalledTimes(1)
  const payload = JSON.parse(request.mock.calls[0][1].body)
  expect(payload.store).toBe(false)
  expect(payload.text.format.strict).toBe(true)
  expect(payload.text.format.schema.properties.tags).toMatchObject({ minItems: 13, maxItems: 13 })
  expect(payload.text.format.schema.properties.tags.items.properties.tag.maxLength).toBe(20)
  expect(payload).not.toHaveProperty('tools')
})
it('rejects changed locked tags, duplicates and oversized tags', async () => {
  for (const change of ['lost-lock', 'duplicates', 'long']) {
    const output = result()
    if (change === 'lost-lock') output.tags[0].tag = 'other phrase'
    if (change === 'duplicates') output.tags[1].tag = 'hair claw'
    if (change === 'long') output.tags[1].tag = 'a'.repeat(21)
    await expect(
      generateProductCopy(input(), jest.fn().mockResolvedValue(response(output))),
    ).rejects.toThrow()
  }
})
it('rejects disabled configuration without contacting a provider', async () => {
  process.env.ADMIN_ASSISTANT_ENABLED = 'false'
  const request = jest.fn()
  await expect(generateProductCopy(input(), request)).rejects.toThrow('Configure')
  expect(request).not.toHaveBeenCalled()
})
it('rejects unbounded input or unexpected sensitive fields', () => {
  expect(
    copyInputSchema.safeParse({ ...input(), customer_email: 'buyer@example.invalid' }).success,
  ).toBe(false)
  expect(copyInputSchema.safeParse({ ...input(), facts: 'x'.repeat(2001) }).success).toBe(false)
})

it('routes OpenRouter credentials only to its fixed endpoint with schema support required', async () => {
  process.env.ADMIN_ASSISTANT_PROVIDER = 'openrouter'
  process.env.ADMIN_ASSISTANT_OPENROUTER_API_KEY = 'router-test-only'
  const request = jest.fn().mockResolvedValue(response(result()))
  await generateProductCopy(input(), request)
  expect(request.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/responses')
  expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer router-test-only')
  const payload = JSON.parse(request.mock.calls[0][1].body)
  expect(payload.provider.require_parameters).toBe(true)
  expect(payload.text.format.strict).toBe(true)
  expect(payload.text.format.schema.properties.tags).toMatchObject({ minItems: 13, maxItems: 13 })
  expect(payload.text.format.schema.properties.tags.items.properties.tag.maxLength).toBe(20)
  delete process.env.ADMIN_ASSISTANT_OPENROUTER_API_KEY
  request.mockClear()
  await expect(generateProductCopy(input(), request)).rejects.toThrow('Configure')
  expect(request).not.toHaveBeenCalled()
})
it('rejects unknown providers and incomplete output before any draft is returned', async () => {
  const request = jest.fn()
  process.env.ADMIN_ASSISTANT_PROVIDER = 'https://other.invalid'
  await expect(generateProductCopy(input(), request)).rejects.toThrow('Configure')
  expect(request).not.toHaveBeenCalled()
  process.env.ADMIN_ASSISTANT_PROVIDER = 'openai'
  request.mockResolvedValue({ ok: true, json: async () => ({ status: 'incomplete', output: [] }) })
  await expect(generateProductCopy(input(), request)).rejects.toThrow('incomplete')
})

it('drafts bounded product search wording without tags or write tools', async () => {
  const request = jest.fn(async () => response({ title: 'Rose Hair Claw | Rustic Halo', description: 'Discover the rose hair claw, with wood details.', tags: [], explanation: 'Uses the supplied product facts.' }))
  const value = await generateProductCopy({ ...input(), action: 'product-seo', locked_tags: [] }, request as any)
  expect(value.title).toContain('Rustic Halo')
  const body = JSON.parse((request.mock.calls[0] as any)[1].body)
  expect(body.store).toBe(false); expect(body.tools).toBeUndefined(); expect(body.text.format.schema.properties.title.maxLength).toBe(100); expect(body.text.format.schema.properties.description.maxLength).toBe(320)
  expect(copyInputSchema.safeParse({ ...input(), action: 'product-seo', title: '' }).success).toBe(false)
  await expect(generateProductCopy({ ...input(), action: 'product-seo', locked_tags: [] }, jest.fn(async () => response({ title:'x'.repeat(101), description:'Summary', tags:[], explanation:'' })) as any)).rejects.toThrow()
})
