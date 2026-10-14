const fulfill = jest.fn(),
  dispatch = jest.fn()
jest.mock('@medusajs/medusa/core-flows', () => ({
  createOrderFulfillmentWorkflow: () => ({ run: fulfill }),
  createOrderShipmentWorkflow: () => ({ run: dispatch }),
}))
import {
  labelConfiguration,
  assertWebsiteOrder,
  orderFingerprint,
  quoteLabel,
  purchaseLabel,
  reconcileLabel,
  transactionLabel,
  attachPurchasedLabel,
  dispatchPurchasedLabel,
} from '../shippo-labels'
const originalEnv = process.env
const order = () => ({
  id: 'order_one',
  status: 'pending',
  sales_channel_id: 'sc_website',
  shipping_address: {
    first_name: 'Test',
    last_name: 'Buyer',
    country_code: 'us',
    address_1: 'Fixture address',
    city: 'Test',
    province: 'NC',
    postal_code: '00000',
  },
  shipping_methods: [{ shipping_option_id: 'so_one' }],
  items: [
    {
      id: 'orli_one',
      quantity: 1,
      requires_shipping: true,
      detail: { fulfilled_quantity: 0, shipped_quantity: 0 },
    },
  ],
  payment_collections: [
    { id: 'paycol_one', status: 'completed', amount: 20, captured_amount: 20, refunded_amount: 0 },
  ],
  fulfillments: [],
})
const transaction = (metadata: string) => ({
  object_id: 'tx_one',
  status: 'SUCCESS',
  test: true,
  metadata,
  tracking_number: 'TRACK',
  tracking_url_provider: 'https://carrier.example.invalid/TRACK',
  label_url: 'https://labels.example.invalid/label.pdf',
})
function fixture() {
  const source: any = order(),
    operations: any[] = []
  const ops = {
    listAdminOperations: jest.fn(async (filter: any) =>
      operations.filter((row) => row.operation_key === filter.operation_key),
    ),
    retrieveAdminOperation: jest.fn(async (id: string) => operations.find((row) => row.id === id)),
    createAdminOperations: jest.fn(async (input: any) => {
      const row = { ...input, id: `op_${operations.length}` }
      operations.push(row)
      return row
    }),
    updateAdminOperations: jest.fn(async (input: any) => {
      const row = operations.find((row) => row.id === input.id)
      Object.assign(row, input)
      return row
    }),
  }
  const query = { graph: jest.fn(async () => ({ data: [source] })) }
  const scope = {
    resolve: (key: string) =>
      key === 'admin_operations'
        ? ops
        : key === 'query'
          ? query
          : key === 'locking'
            ? { execute: async (_key: any, callback: any) => callback() }
            : key === 'fulfillment'
              ? { retrieveShippingOption: async () => ({ provider_id: 'shippo-test_shippo' }) }
              : null,
  }
  const quote: any = {
    id: 'quote_one',
    operation_key: 'quote_one',
    kind: 'shippo-quote',
    resource_id: 'order_one',
    status: 'quoted',
    payload: {
      actor: 'user_one',
      mode: 'test',
      fingerprint: orderFingerprint(source),
      expires: Date.now() + 60000,
      parcel: { weight: 3, length: 6, width: 4, height: 3 },
      rates: [
        { id: 'rate_one', amount: '4.25', currency: 'USD', carrier: 'USPS', service: 'Ground' },
      ],
    },
  }
  return { source, operations, ops, query, scope, quote }
}
beforeEach(() => {
  process.env = {
    ...originalEnv,
    APP_ENV: 'test',
    SHIPPO_LABELS_ENABLED: 'true',
    SHIPPO_LABEL_MODE: 'test',
    SHIPPO_API_KEY: 'shippo_test_mock',
    SHIPPO_LABEL_WEBSITE_CHANNEL_IDS: 'sc_website',
    SHIPPO_FROM_NAME: 'Fixture',
    SHIPPO_FROM_STREET1: 'Fixture origin',
    SHIPPO_FROM_CITY: 'Test',
    SHIPPO_FROM_STATE: 'NC',
    SHIPPO_FROM_ZIP: '00000',
    SHIPPO_FROM_COUNTRY: 'US',
  }
  fulfill.mockReset()
  dispatch.mockReset()
})
afterEach(() => {
  process.env = originalEnv
})
async function withQuote(f: ReturnType<typeof fixture>) {
  const request = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: [
          {
            object_id: 'rate_one',
            amount: '4.25',
            currency: 'USD',
            provider: 'USPS',
            servicelevel: { name: 'Ground' },
          },
        ],
      }),
    } as Response)
  const response = await quoteLabel(
    f.scope,
    'order_one',
    { weight: 3, length: 6, width: 4, height: 3 },
    'user_one',
    request,
  )
  return response.quote_id
}
it('requires deliberate activation, correct credentials and known website channels', () => {
  expect(labelConfiguration().test).toBe(true)
  process.env.SHIPPO_LABELS_ENABLED = 'false'
  expect(() => labelConfiguration()).toThrow('not enabled')
  process.env.SHIPPO_LABELS_ENABLED = 'true'
  process.env.SHIPPO_API_KEY = 'shippo_live_mock'
  expect(() => labelConfiguration()).toThrow('test token')
})
it.each(['etsy', 'unpaid', 'canceled', 'partial', 'foreign', 'refunded', 'uncaptured'])(
  'blocks unsupported %s orders before quotes or charges',
  (type) => {
    const source: any = order()
    if (type === 'etsy') source.metadata = { etsy_receipt_id: 123 }
    if (type === 'unpaid') source.payment_collections[0].status = 'not_paid'
    if (type === 'canceled') source.status = 'canceled'
    if (type === 'partial') source.items[0].detail.fulfilled_quantity = 1
    if (type === 'refunded') source.payment_collections[0].refunded_amount = 5
    if (type === 'uncaptured') source.payment_collections[0].captured_amount = 0
    if (type === 'foreign') source.shipping_address.country_code = 'ca'
    expect(() => assertWebsiteOrder(source, ['sc_website'])).toThrow()
  },
)
it('quotes without buying and stores server-owned rates bound to order and actor', async () => {
  const f = fixture()
  await withQuote(f)
  expect(f.operations[0]).toMatchObject({
    kind: 'shippo-quote',
    resource_id: 'order_one',
    payload: { actor: 'user_one', rates: [{ id: 'rate_one', amount: '4.25' }] },
  })
  expect(f.operations[0].payload).not.toHaveProperty('shipping_address')
})
it('persists purchase intent first and returns the same purchased label on replay', async () => {
  const f = fixture(),
    quoteId = await withQuote(f)
  const request = jest.fn(async (_url, init) => {
    const payload = JSON.parse(init!.body as string)
    expect(f.operations.find((row) => row.id === payload.metadata)?.status).toBe('purchasing')
    return { ok: true, json: async () => transaction(payload.metadata) } as Response
  })
  const first = await purchaseLabel(f.scope, 'order_one', quoteId, 'rate_one', 'user_one', request)
  const second = await purchaseLabel(f.scope, 'order_one', quoteId, 'rate_one', 'user_one', request)
  expect(first).toEqual(second)
  expect(request).toHaveBeenCalledTimes(1)
})
it('blocks a second paid request after an uncertain network result', async () => {
  const f = fixture(),
    quoteId = await withQuote(f),
    request = jest.fn().mockRejectedValue(new Error('network timeout'))
  await expect(
    purchaseLabel(f.scope, 'order_one', quoteId, 'rate_one', 'user_one', request),
  ).rejects.toThrow('timeout')
  await expect(
    purchaseLabel(f.scope, 'order_one', quoteId, 'rate_one', 'user_one', request),
  ).rejects.toThrow('pending or uncertain')
  expect(request).toHaveBeenCalledTimes(1)
  const operation = f.operations.find((row) => row.kind === 'shippo-label')
  const reconcile = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ results: [transaction(operation.id)], next: null }),
    } as Response)
  expect((await reconcileLabel(f.scope, 'order_one', reconcile)).label?.tracking_number).toBe(
    'TRACK',
  )
  expect(reconcile.mock.calls[0][1].method).toBe('GET')
})
it('rejects stale address, unquoted rate, actor mismatch and expired quotes without purchase', async () => {
  for (const kind of ['stale', 'rate', 'actor', 'expired']) {
    const f = fixture(),
      quoteId = await withQuote(f),
      request = jest.fn()
    if (kind === 'stale') f.source.shipping_address.address_1 = 'Changed'
    if (kind === 'expired') f.operations[0].payload.expires = 0
    await expect(
      purchaseLabel(
        f.scope,
        'order_one',
        quoteId,
        kind === 'rate' ? 'injected_rate' : 'rate_one',
        kind === 'actor' ? 'user_other' : 'user_one',
        request,
      ),
    ).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  }
})
it('attaches a bought label through native fulfillment, never repurchasing', async () => {
  const f = fixture(),
    quoteId = await withQuote(f)
  await purchaseLabel(
    f.scope,
    'order_one',
    quoteId,
    'rate_one',
    'user_one',
    jest.fn(
      async (_url, init) =>
        ({
          ok: true,
          json: async () => transaction(JSON.parse(init!.body as string).metadata),
        }) as Response,
    ),
  )
  fulfill.mockResolvedValue({ result: { id: 'ful_one' } })
  expect(await attachPurchasedLabel(f.scope, 'order_one', 'user_one')).toEqual({
    fulfillment_id: 'ful_one',
  })
  expect(fulfill.mock.calls[0][0].input).toMatchObject({
    order_id: 'order_one',
    items: [{ id: 'orli_one', quantity: 1 }],
    no_notification: true,
  })
})
it('dispatches only its own confirmed fulfillment and suppresses test notifications', async () => {
  const f = fixture()
  f.operations.push({
    id: 'op_label',
    operation_key: 'shippo-purchase:order_one',
    kind: 'shippo-label',
    status: 'purchased',
    payload: {
      mode: 'test',
      label: transactionLabel(transaction('op_label')),
      items: [{ id: 'orli_one', quantity: 1 }],
    },
  })
  f.source.fulfillments = [
    { id: 'ful_one', metadata: { admin_label_id: 'op_label' }, shipped_at: null },
  ]
  await dispatchPurchasedLabel(f.scope, 'order_one')
  expect(dispatch.mock.calls[0][0].input).toMatchObject({
    no_notification: true,
    fulfillment_id: 'ful_one',
  })
  f.source.fulfillments[0].shipped_at = '2026-10-13'
  await dispatchPurchasedLabel(f.scope, 'order_one')
  expect(dispatch).toHaveBeenCalledTimes(1)
})
