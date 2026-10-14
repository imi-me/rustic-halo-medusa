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
