import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { Modules } from '@medusajs/framework/utils'
import { ETSY_MODULE } from '../../modules/etsy'
import { ADMIN_OPERATIONS } from '../../modules/admin-operations'
import { etsyWorkspaceAccess } from './listing-workspace'
import { assertPreparationAllowed, packingItems, preparationStatus, receiptDetails, safeWorkspaceError, summarizeWorkspaceReceipt, type PreparationStage, type WorkspaceReceipt } from './order-workspace'
import { readPackageConfig } from '../shipping-package-store'
import { planShipping } from '../shipping-plan'
import { readHistoricalMatches, resolveHistoricalPacking } from './historical-order-matches'
const prefix = (shop: number) => `etsy-order:${shop}:`
const syncKey = (shop: number) => `etsy-orders-sync:${shop}`
const enabled = () => { if (process.env.ETSY_ORDER_REPORT_ENABLED !== 'true') throw new Error('Etsy order workspace is disabled.') }
export async function workspaceShop(scope: any) {
  enabled()
  const connection = await scope.resolve(ETSY_MODULE).getReadConnection()
  if (!connection.scopes?.granted?.includes('transactions_r')) throw new Error('Reconnect Etsy with order-read permission before using this workspace.')
  return Number(connection.shop_id)
}
async function variants(scope: any) {
  const all: any[] = [], products = scope.resolve(Modules.PRODUCT)
  for (let skip = 0; skip < 20000; skip += 500) {
    const page = await products.listProductVariants({}, { select: ['id', 'sku', 'product_id', 'metadata'], take: 500, skip })
    all.push(...page)
    if (page.length < 500) return all
  }
  throw new Error('Product matching reached its review limit.')
}
async function rows(operations: any, shop: number) {
  return operations.listAdminOperations({ kind: 'etsy-order', resource_id: String(shop) }, { take: 1000 })
}
function view(row: any) {
  const p = row.payload
  return { ...p.order, stage: p.stage, revision: p.revision, fetchedAt: p.fetchedAt, preparationUpdatedAt: p.preparationUpdatedAt ?? null, fulfillment: preparationStatus(p.order, p.stage) }
}
export async function readOrderWorkspace(scope: any) {
  const shop = await workspaceShop(scope), ops = scope.resolve(ADMIN_OPERATIONS)
  const [saved, [sync]] = await Promise.all([rows(ops, shop), ops.listAdminOperations({ operation_key: syncKey(shop) })])
  const threshold = Date.now() - 90 * 86400000
  const orders = saved.map(view).filter((o: any) => !o.shipped && !o.canceled || Date.parse(o.createdAt) >= threshold).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return { orders, sync: sync?.payload ?? null, refreshIntervalMinutes: 15, privacy: { shippingAddressStored: false, buyerIdentityStored: false, personalizationStored: false }, labelsInEtsy: true }
}
async function readReceipt(access: any, id: number, request: typeof fetch) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid Etsy receipt ID.')
  const response = await request(`https://openapi.etsy.com/v3/application/shops/${access.shopId}/receipts/${id}?legacy=true`, { headers: access.headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Etsy order read (HTTP ${response.status}).`)
  const receipt: any = await response.json()
  if (receipt.receipt_id !== id || receipt.shop_id != null && receipt.shop_id !== access.shopId) throw new Error('Etsy returned a different shop or receipt.')
  return receipt
}
async function saveReceipt(ops: any, shop: number, order: WorkspaceReceipt, existing?: any) {
  // Never persist address, messages, personalization, emails, or the provider response.
  const payload = { order, stage: existing?.payload.stage ?? 'needs_making', revision: randomUUID(), fetchedAt: new Date().toISOString(), preparationUpdatedAt: existing?.payload.preparationUpdatedAt ?? null, preparationActor: existing?.payload.preparationActor ?? null }
  const data = { status: preparationStatus(order, payload.stage), payload }
  return existing ? ops.updateAdminOperations({ id: existing.id, ...data }) : ops.createAdminOperations({ operation_key: prefix(shop) + order.receiptId, kind: 'etsy-order', resource_id: String(shop), ...data })
}
export async function refreshOrderWorkspace(scope: any, request: typeof fetch = fetch) {
  const shop = await workspaceShop(scope)
  return scope.resolve(Modules.LOCKING).execute(`etsy-order-workspace:${shop}`, async () => {
    const ops = scope.resolve(ADMIN_OPERATIONS), [sync] = await ops.listAdminOperations({ operation_key: syncKey(shop) })
    const startedAt = new Date().toISOString()
    const saveSync = async (payload: any, status: string) => sync ? ops.updateAdminOperations({ id: sync.id, payload, status }) : ops.createAdminOperations({ operation_key: syncKey(shop), kind: 'etsy-order-sync', resource_id: String(shop), payload, status })
    try {
      const access = await etsyWorkspaceAccess(scope)
      if (access.shopId !== shop) throw new Error('Etsy shop connection changed.')
      const collected = new Map<number, any>(), now = Math.floor(Date.now() / 1000)
      let truncated = false
      for (const mode of ['recent', 'open']) {
        for (let offset = 0; offset < 500; offset += 100) {
          const endpoint = new URL(`https://openapi.etsy.com/v3/application/shops/${shop}/receipts`)
          const params: Record<string, string> = { legacy: 'true', limit: '100', offset: String(offset) }
          if (mode === 'recent') { params.min_created = String(now - 90 * 86400); params.max_created = String(now) }
          else { params.was_shipped = 'false'; params.was_canceled = 'false' }
          Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v))
          const response = await request(endpoint, { headers: access.headers, signal: AbortSignal.timeout(20000) })
          if (!response.ok) throw new Error(`Etsy orders unavailable (HTTP ${response.status}).`)
          const data: any = await response.json()
          if (!Array.isArray(data.results) || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid Etsy order response.')
          for (const receipt of data.results) { if (!Number.isSafeInteger(receipt.receipt_id) || receipt.receipt_id < 1) throw new Error('Invalid Etsy receipt.'); collected.set(receipt.receipt_id, receipt) }
          if (data.count > 500) truncated = true
          if (offset + data.results.length >= data.count || !data.results.length) break
        }
      }
      const existing = await rows(ops, shop)
      const oldOpen = existing.filter((row: any) => !row.payload.order.shipped && !row.payload.order.canceled && !collected.has(row.payload.order.receiptId))
      if (oldOpen.length > 100) truncated = true
      for (const row of oldOpen.slice(0, 100)) collected.set(row.payload.order.receiptId, await readReceipt(access, row.payload.order.receiptId, request))
      const identities = await variants(scope), matches = await readHistoricalMatches(ops, shop)
      // Validate every receipt before writing the first snapshot.
      const orders = [...collected.values()].map(r => summarizeWorkspaceReceipt(r, identities, matches))
      for (const order of orders) await saveReceipt(ops, shop, order, existing.find((row: any) => row.payload.order.receiptId === order.receiptId))
      await saveSync({ startedAt, lastSuccessAt: new Date().toISOString(), fetched: orders.length, truncated, error: null }, 'ok')
      return { fetched: orders.length, truncated }
    } catch (error) {
      await saveSync({ ...sync?.payload, startedAt, lastAttemptAt: new Date().toISOString(), error: safeWorkspaceError(error) }, 'failed')
      throw new Error(safeWorkspaceError(error))
    }
  }, { timeout: 5, expire: 600 })
}
export async function readOrderDetails(scope: any, id: number, request: typeof fetch = fetch) {
  const shop = await workspaceShop(scope)
  return scope.resolve(Modules.LOCKING).execute(`etsy-order-workspace:${shop}`, async () => {
    const ops = scope.resolve(ADMIN_OPERATIONS), access = await etsyWorkspaceAccess(scope)
    if (access.shopId !== shop) throw new Error('Etsy shop connection changed.')
    const raw = await readReceipt(access, id, request)
    const order = summarizeWorkspaceReceipt(raw, await variants(scope), await readHistoricalMatches(ops, shop))
    const [existing] = await ops.listAdminOperations({ operation_key: prefix(shop) + id })
    const saved = await saveReceipt(ops, shop, order, existing)
    let parcels: Awaited<ReturnType<typeof planShipping>> = [], packingMessage = ''
    try { parcels = await planShipping(await resolveHistoricalPacking(packingItems(order), scope.resolve(Modules.PRODUCT)), await readPackageConfig(ops), scope.resolve(Modules.PRODUCT)) }
    catch (error) { packingMessage = error instanceof Error ? error.message : 'Review package settings before packing.' }
    return { order: view(saved), details: receiptDetails(raw), parcels, packingMessage, readAt: new Date().toISOString(), etsyUrl: `https://www.etsy.com/your/orders/sold?order_id=${id}` }
  }, { timeout: 5, expire: 120 })
}
export async function savePreparation(scope: any, id: number, input: { stage: PreparationStage; expected_revision: string }, actor: string, request: typeof fetch = fetch) {
  const shop = await workspaceShop(scope)
  return scope.resolve(Modules.LOCKING).execute(`etsy-order-workspace:${shop}`, async () => {
    const ops = scope.resolve(ADMIN_OPERATIONS), [row] = await ops.listAdminOperations({ operation_key: prefix(shop) + id })
    if (!row || row.payload.revision !== input.expected_revision) throw new Error('This order changed. Reopen it before changing its preparation stage.')
    // Recheck Etsy immediately before local preparation changes, including cancellation/refund/shipment.
    const access = await etsyWorkspaceAccess(scope)
    if (access.shopId !== shop) throw new Error('Etsy shop connection changed.')
    const current = summarizeWorkspaceReceipt(await readReceipt(access, id, request), await variants(scope), await readHistoricalMatches(ops, shop))
    if (!isDeepStrictEqual(current, row.payload.order)) { await saveReceipt(ops, shop, current, row); throw new Error('Etsy order details changed. Reopen and review the latest order before changing its preparation stage.') }
    assertPreparationAllowed(current)
    const payload = { ...row.payload, stage: input.stage, revision: randomUUID(), preparationUpdatedAt: new Date().toISOString(), preparationActor: actor }
    const saved = await ops.updateAdminOperations({ id: row.id, status: preparationStatus(current, input.stage), payload })
    return view(saved)
  }, { timeout: 5, expire: 120 })
}
