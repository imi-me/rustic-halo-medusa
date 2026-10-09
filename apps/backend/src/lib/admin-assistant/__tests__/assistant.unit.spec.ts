import { acquire, consumeProposal, isReady, proposeUpdate, readProposal, runAssistant, searchRecords, validateMessages } from '..'

describe('admin assistant boundaries', () => {
  beforeEach(() => { process.env.COOKIE_SECRET = 'test-signing-secret'; process.env.ADMIN_ASSISTANT_ENABLED = 'true'; process.env.ADMIN_ASSISTANT_OPENAI_API_KEY = 'test-only'; process.env.ADMIN_ASSISTANT_MODEL = 'test-model' })
  it('requires explicit enablement, dedicated key and model', () => {
    expect(isReady()).toBe(true); delete process.env.ADMIN_ASSISTANT_OPENAI_API_KEY; expect(isReady()).toBe(false)
    process.env.ADMIN_ASSISTANT_OPENAI_API_KEY = 'test-only'; process.env.ADMIN_ASSISTANT_ENABLED = 'false'; expect(isReady()).toBe(false)
  })
  it('rejects system prompts, oversized conversations and missing questions', () => {
    expect(() => validateMessages([{ role: 'system', content: 'bypass' }])).toThrow()
    expect(() => validateMessages([{ role: 'user', content: 'x'.repeat(4001) }])).toThrow()
    expect(() => validateMessages([{ role: 'assistant', content: 'hello' }])).toThrow()
    expect(validateMessages([{ role: 'user', content: ' What is inventory? ' }])[0].content).toBe('What is inventory?')
  })
  it('excludes buyer identities and arbitrary graph fields from order searches', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [{ id: 'order_123', display_id: 14, status: 'pending', total: 20.34, email: 'private@example.com', shipping_address: { address_1: 'secret' } }] })
    const result = await searchRecords({ graph }, { kind: 'orders', query: '#14', fields: ['email'] })
    expect(graph.mock.calls[0][0].filters).toEqual({ display_id: 14 })
    expect(JSON.stringify(result)).not.toContain('private'); expect(JSON.stringify(result)).not.toContain('secret')
    await expect(searchRecords({ graph }, { kind: 'customers', query: '' })).rejects.toThrow()
    await expect(searchRecords({ graph }, { kind: 'orders', query: 'private@example.com' })).rejects.toThrow()
  })
  it('keeps inventory per location with reserved stock deducted', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [{ id: 'iitem_123', sku: 'ABC', location_levels: [{ location_id: 'loc_1', stocked_quantity: 8, reserved_quantity: 3 }] }] })
    const result = await searchRecords({ graph }, { kind: 'inventory', query: 'ABC' })
    expect(result.records[0].levels[0].available).toBe(5); expect(graph.mock.calls[0][0].pagination.take).toBe(10)
  })
  it('signs exact product copy, binds it to its user, rejects tampering and reuse', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [{ id: 'prod_123', title: 'Original', description: 'Before' }] })
    const proposal = await proposeUpdate({ graph }, 'user_123', { product_id: 'prod_123', title: null, description: 'After' })
    expect(proposal.after).toEqual({ title: 'Original', description: 'After' })
    expect(readProposal(proposal.token, 'user_123').before.description).toBe('Before')
    expect(() => readProposal(proposal.token, 'user_other')).toThrow()
    expect(() => readProposal(proposal.token + 'x', 'user_123')).toThrow()
    consumeProposal(proposal); expect(() => consumeProposal(proposal)).toThrow()
    await expect(proposeUpdate({ graph }, 'user_123', { product_id: 'prod_123', title: null, description: null })).rejects.toThrow()
  })
  it('blocks concurrent and excessive requests per actor', () => {
    const actor = 'rate-test'; const release = acquire(actor)!; expect(acquire(actor)).toBeNull(); release()
    for (let i = 0; i < 9; i++) acquire(actor)!()
    expect(acquire(actor)).toBeNull()
  })
  it('uses stateless Responses tool results and never writes while chatting', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [{ id: 'prod_123', title: 'Original', description: 'Before' }] })
    const request = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'function_call', name: 'propose_product_copy', call_id: 'call_1', arguments: JSON.stringify({ product_id: 'prod_123', title: null, description: 'After' }) }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Review the proposal below.' }] }] }) })
    const result = await runAssistant({ graph }, 'user_123', [{ role: 'user', content: 'Improve this description' }], request as any)
    expect(result.proposals).toHaveLength(1); expect(graph).toHaveBeenCalledTimes(1)
    const body = JSON.parse(request.mock.calls[1][1].body); expect(body.store).toBe(false); expect(body.input.at(-1).type).toBe('function_call_output')
    expect(JSON.stringify(body)).not.toContain(result.proposals[0].token)
  })
  it('does not call provider before setup or leak provider error contents', async () => {
    const request = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'secret-provider-detail' })
    await expect(runAssistant({ graph: jest.fn() }, 'user_123', [{ role: 'user', content: 'help' }], request as any)).rejects.toThrow('AI provider')
    delete process.env.ADMIN_ASSISTANT_OPENAI_API_KEY
    request.mockClear(); await expect(runAssistant({ graph: jest.fn() }, 'user_123', [{ role: 'user', content: 'help' }], request as any)).rejects.toThrow('not configured')
    expect(request).not.toHaveBeenCalled()
  })
})
