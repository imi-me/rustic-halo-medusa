import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Modules } from '@medusajs/framework/utils'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
import { assertProductionEnvironment } from './production-commerce'
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
} from '@medusajs/medusa/core-flows'

export const parcelSchema = z
  .object({
    weight: z.number().positive().max(1120),
    length: z.number().positive().max(108),
    width: z.number().positive().max(108),
    height: z.number().positive().max(108),
  })
  .strict()
const digest = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function labelConfiguration(env = process.env) {
  if (env.SHIPPO_LABELS_ENABLED !== 'true')
    throw new Error(
      'Shippo labels are not enabled. Configure the label workflow before buying postage.',
    )
  const test = env.SHIPPO_LABEL_MODE === 'test'
  if (test) {
    if (
      !['local', 'staging', 'test'].includes(env.APP_ENV ?? '') ||
      !env.SHIPPO_API_KEY?.startsWith('shippo_test_')
    )
      throw new Error(
        'Test labels require an isolated local/staging environment and Shippo test token.',
      )
  } else {
    if (
      env.SHIPPO_LABEL_MODE !== 'live' ||
      env.SHIPPO_LIVE_LABELS_ENABLED !== 'true' ||
      !env.SHIPPO_API_KEY?.startsWith('shippo_live_')
    )
      throw new Error('Live label purchasing requires explicit production label activation.')
    assertProductionEnvironment(env)
  }
  const channels = (env.SHIPPO_LABEL_WEBSITE_CHANNEL_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!channels.length || channels.some((id) => !/^sc_[A-Za-z0-9]+$/.test(id)))
    throw new Error('Configure the verified website sales channel IDs before buying labels.')
  const origin = Object.fromEntries(
    ['name', 'street1', 'street2', 'city', 'state', 'zip', 'country', 'phone', 'email'].map((field) => [
      field,
      env[`SHIPPO_FROM_${field.toUpperCase()}`]?.trim() ?? '',
    ]),
  )
  if (
    ['name', 'street1', 'city', 'state', 'zip', 'country'].some((field) => !origin[field]) ||
    origin.country.toUpperCase() !== 'US'
  )
    throw new Error('A complete US shipping origin is required.')
  return { test, channels, origin, key: env.SHIPPO_API_KEY! }
}
export function assertWebsiteOrder(order: any, channels: string[]) {
  if (
    !order ||
    order.status === 'canceled' ||
    order.metadata?.etsy_receipt_id ||
    order.metadata?.source === 'etsy' ||
    !channels.includes(order.sales_channel_id)
  )
    throw new Error(
      'Shippo labels are limited to verified website orders. Buy Etsy labels in Etsy.',
    )
  if (
    !(order.payment_collections ?? []).length ||
    order.payment_collections.some(
      (row: any) =>
        row.status !== 'completed' ||
        !Number.isFinite(Number(row.amount)) ||
        !Number.isFinite(Number(row.captured_amount)) ||
        Number(row.captured_amount) < Number(row.amount) ||
        Number(row.refunded_amount ?? 0) !== 0,
    )
  )
    throw new Error('Confirm full payment before buying postage.')
  const address = order.shipping_address
  if (
    address?.country_code?.toLowerCase() !== 'us' ||
    ['address_1', 'city', 'province', 'postal_code'].some((key) => !address?.[key])
  )
    throw new Error('A complete US shipping address is required.')
  if (
    !order.items?.length ||
    order.items.some(
      (item: any) =>
        item.requires_shipping === false ||
        Number(item.detail?.fulfilled_quantity ?? 0) > 0 ||
        Number(item.detail?.shipped_quantity ?? 0) > 0 ||
        Number(item.quantity) <= 0,
    )
  )
    throw new Error(
      'This workflow supports one package containing all physical, unfulfilled order items. Use dedicated fulfillment tools for split shipments.',
    )
  if (order.shipping_methods?.length !== 1 || !order.shipping_methods[0].shipping_option_id)
    throw new Error('Review the order shipping method before buying a label.')
}
export const orderFingerprint = (order: any) =>
  digest({
    id: order.id,
    status: order.status,
    sales_channel_id: order.sales_channel_id,
    shipping_address: order.shipping_address,
    shipping_methods: order.shipping_methods,
    items: order.items,
    payment_collections: order.payment_collections,
  })
export async function labelOrder(scope: any, id: string) {
  const { data } = await scope
    .resolve('query')
    .graph({
      entity: 'order',
      filters: { id },
      fields: [
        'id',
        'status',
        'metadata',
        'sales_channel_id',
        'shipping_address.*',
        'shipping_methods.*',
        'items.*',
        'items.detail.*',
        'payment_collections.id',
        'payment_collections.status',
        'payment_collections.amount',
        'payment_collections.captured_amount',
        'payment_collections.refunded_amount',
        'fulfillments.*',
        'fulfillments.labels.*',
      ],
    })
  return data[0]
}
async function shippo(
  path: string,
  config: ReturnType<typeof labelConfiguration>,
  body?: any,
  request: typeof fetch = fetch,
) {
  const response = await request(`https://api.goshippo.com/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `ShippoToken ${config.key}`,
      'Content-Type': 'application/json',
      'SHIPPO-API-VERSION': '2018-02-08',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok)
    throw new Error(
      'Shippo request could not be confirmed. Review the label status before retrying.',
    )
  return response.json() as Promise<any>
}
const safeUrl = (value: any) =>
  typeof value === 'string' &&
  /^https:\/\//.test(value) &&
  !new URL(value).username &&
  !new URL(value).password
export function transactionLabel(transaction: any) {
  if (
    transaction.status !== 'SUCCESS' ||
    !transaction.object_id ||
    !transaction.tracking_number ||
    !safeUrl(transaction.label_url) ||
    !safeUrl(transaction.tracking_url_provider)
  )
    throw new Error(
      'Shippo label is pending or incomplete. Reconcile its status before buying another.',
    )
  return {
    transaction_id: transaction.object_id,
    tracking_number: transaction.tracking_number,
    tracking_url: transaction.tracking_url_provider,
    label_url: transaction.label_url,
  }
}
export async function quoteLabel(
  scope: any,
  orderId: string,
  parcel: z.infer<typeof parcelSchema>,
  actor: string,
  request: typeof fetch = fetch,
) {
  const config = labelConfiguration(),
    order = await labelOrder(scope, orderId)
  assertWebsiteOrder(order, config.channels)
  const option = await scope
    .resolve(Modules.FULFILLMENT)
    .retrieveShippingOption(order.shipping_methods[0].shipping_option_id, {
      relations: ['service_zone', 'service_zone.fulfillment_set'],
    })
  if (!option.provider_id?.startsWith(config.test ? 'shippo-test_' : 'shippo-live_'))
    throw new Error(
      'This order must use the matching Shippo shipping provider before purchasing a label.',
    )
  const address = order.shipping_address
  const shipment = await shippo(
    'shipments/',
    config,
    {
      address_from: config.origin,
      address_to: {
        name: `${address.first_name ?? ''} ${address.last_name ?? ''}`.trim() || address.company || '',
        company: address.company ?? '',
        ...(address.phone ? { phone: address.phone } : {}),
        street1: address.address_1,
        street2: address.address_2 ?? '',
        city: address.city,
        state: address.province,
        zip: address.postal_code,
        country: 'US',
      },
      parcels: [
        {
          ...Object.fromEntries(Object.entries(parcel).map(([key, value]) => [key, String(value)])),
          distance_unit: 'in',
          mass_unit: 'oz',
        },
      ],
      async: false,
    },
    request,
  )
  const rates = (shipment.rates ?? [])
    .filter(
      (rate: any) =>
        rate.currency === 'USD' &&
        Number.isFinite(Number(rate.amount)) &&
        Number(rate.amount) > 0 &&
        /^(USPS|UPS)$/i.test(rate.provider),
    )
    .map((rate: any) => ({
      id: rate.object_id,
      carrier: rate.provider,
      service: rate.servicelevel?.name ?? rate.servicelevel?.token,
      amount: String(rate.amount),
      currency: rate.currency,
      days: rate.estimated_days ?? null,
    }))
  if (!rates.length)
    throw new Error('No USPS or UPS rates were returned for the confirmed package.')
  const operation = await scope
    .resolve(ADMIN_OPERATIONS)
    .createAdminOperations({
      operation_key: `shippo-quote:${randomUUID()}`,
      kind: 'shippo-quote',
      resource_id: orderId,
      status: 'quoted',
      payload: {
        actor,
        mode: config.test ? 'test' : 'live',
        fingerprint: orderFingerprint(order),
      address_hash: digest(order.shipping_address),
        origin_hash: digest(config.origin),
        expires: Date.now() + 15 * 60000,
        parcel,
        rates,
      },
    })
  return { quote_id: operation.id, test: config.test, rates, parcel }
}
export async function purchaseLabel(
  scope: any,
  orderId: string,
  quoteId: string,
  rateId: string,
  actor: string,
  request: typeof fetch = fetch,
) {
  const config = labelConfiguration(),
    ops = scope.resolve(ADMIN_OPERATIONS)
  return scope.resolve(Modules.LOCKING).execute(
    `shippo-label:${orderId}`,
    async () => {
      const [existing] = await ops.listAdminOperations({
        operation_key: `shippo-purchase:${orderId}`,
      })
      if (existing) {
        if (existing.status === 'purchased')
          return {
            id: existing.id,
            ...existing.payload.label,
            test: existing.payload.mode === 'test',
          }
        if (existing.status === 'failed') await ops.softDeleteAdminOperations(existing.id)
        else
          throw new Error(
            'A label purchase is already pending or uncertain. Use Check purchase status; do not buy another label.',
          )
      }
      const quote = await ops.retrieveAdminOperation(quoteId)
      const order = await labelOrder(scope, orderId)
      assertWebsiteOrder(order, config.channels)
      if (
        quote.kind !== 'shippo-quote' ||
        quote.resource_id !== orderId ||
        quote.payload.actor !== actor ||
        quote.payload.expires < Date.now() ||
        quote.payload.mode !== (config.test ? 'test' : 'live') ||
        quote.payload.origin_hash !== digest(config.origin) ||
        quote.payload.fingerprint !== orderFingerprint(order)
      )
        throw new Error('The quote expired or the order changed. Request fresh rates.')
      const rate = quote.payload.rates.find((row: any) => row.id === rateId)
      if (!rate) throw new Error('Select a rate from this order’s quote.')
      // Persist intent before the paid request. Network failure or process restart
      // cannot turn a repeated click into another transaction.
      const operation = await ops.createAdminOperations({
        operation_key: `shippo-purchase:${orderId}`,
        kind: 'shippo-label',
        resource_id: orderId,
        status: 'purchasing',
        payload: {
          actor,
          mode: quote.payload.mode,
          quote_id: quoteId,
          rate,
          parcel: quote.payload.parcel,
          fingerprint: quote.payload.fingerprint,
        address_hash: quote.payload.address_hash,
          items: order.items.map((item: any) => ({ id: item.id, quantity: Number(item.quantity) })),
          shipping_option_id: order.shipping_methods[0].shipping_option_id,
        },
      })
      const transaction = await shippo(
        'transactions/',
        config,
        { rate: rateId, label_file_type: 'PDF_4x6', async: false, metadata: operation.id },
        request,
      )
      if (transaction.object_id)
        await ops.updateAdminOperations({
          id: operation.id,
          payload: { ...operation.payload, transaction_id: transaction.object_id },
        })
      if (transaction.test !== config.test)
        throw new Error(
          'Shippo transaction mode does not match this workflow. Review the account before proceeding.',
        )
      if (transaction.status === 'ERROR') {
        await ops.updateAdminOperations({
          id: operation.id,
          status: 'failed',
          payload: { ...operation.payload, transaction_id: transaction.object_id ?? null },
        })
        throw new Error(
          'Shippo confirmed this attempt failed without creating a label. Request fresh rates before trying again.',
        )
      }
      const label = transactionLabel(transaction)
      await ops.updateAdminOperations({
        id: operation.id,
        status: 'purchased',
        payload: { ...operation.payload, transaction_id: transaction.object_id, label },
      })
      return { id: operation.id, ...label, test: config.test }
    },
    { timeout: 5, expire: 300 },
  )
}
export async function reconcileLabel(scope: any, orderId: string, request: typeof fetch = fetch) {
  const config = labelConfiguration(),
    ops = scope.resolve(ADMIN_OPERATIONS)
  return scope.resolve(Modules.LOCKING).execute(
    `shippo-label:${orderId}`,
    async () => {
      const [operation] = await ops.listAdminOperations({
        operation_key: `shippo-purchase:${orderId}`,
      })
      if (!operation) return { label: null }
      if (operation.payload.mode !== (config.test ? 'test' : 'live'))
        throw new Error(
          'The saved label belongs to a different Shippo mode. Review its original account.',
        )
      let transaction
      if (operation.payload.transaction_id)
        transaction = await shippo(
          `transactions/${operation.payload.transaction_id}/`,
          config,
          undefined,
          request,
        )
      else {
        // Bound read-only reconciliation. Missing records never authorize rebuying.
        for (let page = 1; page <= 5 && !transaction; page++) {
          const result = await shippo(
            `transactions/?page=${page}&results=100`,
            config,
            undefined,
            request,
          )
          transaction = result.results?.find((row: any) => row.metadata === operation.id)
          if (!result.next) break
        }
      }
      if (!transaction)
        throw new Error(
          `Purchase is unconfirmed. Check Shippo using reference ${operation.id}; another purchase is blocked.`,
        )
      if (transaction.metadata !== operation.id)
        throw new Error('Shippo transaction does not match this order’s purchase reference.')
      if (transaction.test !== config.test)
        throw new Error(
          'Shippo transaction mode does not match this workflow. Review the account before proceeding.',
        )
      if (transaction.status === 'ERROR') {
        await ops.updateAdminOperations({
          id: operation.id,
          status: 'failed',
          payload: { ...operation.payload, transaction_id: transaction.object_id },
        })
        return { label: null, status: 'failed' }
      }
      const label = transactionLabel(transaction)
      await ops.updateAdminOperations({
        id: operation.id,
        status: 'purchased',
        payload: { ...operation.payload, label, transaction_id: transaction.object_id },
      })
      return {
        label: {
          id: operation.id,
          ...label,
          test: config.test,
          fulfillment_id: operation.payload.fulfillment_id ?? null,
        },
      }
    },
    { timeout: 5, expire: 300 },
  )
}
export async function attachPurchasedLabel(scope: any, orderId: string, actor: string) {
  const ops = scope.resolve(ADMIN_OPERATIONS)
  return scope.resolve(Modules.LOCKING).execute(
    `shippo-label:${orderId}`,
    async () => {
      const [operation] = await ops.listAdminOperations({
        operation_key: `shippo-purchase:${orderId}`,
      })
      if (operation?.status !== 'purchased')
        throw new Error('A confirmed purchased label is required.')
      if (operation.payload.mode !== (labelConfiguration().test ? 'test' : 'live'))
        throw new Error('The purchased label belongs to a different Shippo mode.')
      const order = await labelOrder(scope, orderId)
      const existing = order.fulfillments?.find(
        (row: any) => row.metadata?.admin_label_id === operation.id,
      )
      if (existing) return { fulfillment_id: existing.id }
      const config = labelConfiguration()
      assertWebsiteOrder(order, config.channels)
      if (operation.payload.fingerprint !== orderFingerprint(order))
        throw new Error(
          'Order changed after label purchase. Review the purchased label and fulfillment before proceeding.',
        )
      const { result } = await createOrderFulfillmentWorkflow(scope).run({
        input: {
          order_id: orderId,
          items: operation.payload.items,
          shipping_option_id: operation.payload.shipping_option_id,
          created_by: actor,
          no_notification: true,
          metadata: { admin_label_id: operation.id },
          additional_data: { admin_label_id: operation.id },
        },
      })
      await ops.updateAdminOperations({
        id: operation.id,
        payload: { ...operation.payload, fulfillment_id: result.id },
      })
      return { fulfillment_id: result.id }
    },
    { timeout: 5, expire: 300 },
  )
}
export async function dispatchPurchasedLabel(scope: any, orderId: string) {
  return scope.resolve(Modules.LOCKING).execute(
    `shippo-label:${orderId}`,
    async () => {
      const [operation] = await scope
        .resolve(ADMIN_OPERATIONS)
        .listAdminOperations({ operation_key: `shippo-purchase:${orderId}` })
      const order = await labelOrder(scope, orderId)
      const fulfillment = order?.fulfillments?.find(
        (row: any) => row.metadata?.admin_label_id === operation?.id && !row.canceled_at,
      )
      if (operation?.payload.mode !== (labelConfiguration().test ? 'test' : 'live'))
        throw new Error('The purchased label belongs to a different Shippo mode.')
      if (operation?.status !== 'purchased' || !fulfillment)
        throw new Error('Attach the confirmed label to fulfillment first.')
      if (fulfillment.shipped_at) return { shipped: true }
    if (operation.payload.address_hash && operation.payload.address_hash !== digest(order.shipping_address)) throw new Error('Shipping address changed after the label was purchased. Review the label and fulfillment before carrier handoff.')
      await createOrderShipmentWorkflow(scope).run({
        input: {
          order_id: orderId,
          fulfillment_id: fulfillment.id,
          items: operation.payload.items,
          labels: [operation.payload.label],
          no_notification: operation.payload.mode === 'test',
        },
      })
      return { shipped: true }
    },
    { timeout: 5, expire: 300 },
  )
}
