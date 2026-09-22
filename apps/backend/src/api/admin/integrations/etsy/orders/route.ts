import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ETSY_MODULE } from '../../../../../modules/etsy'
import { listEtsyShopReceipts, refreshEtsyAccessToken } from '../../../../../lib/etsy/client'
import { EtsyOrderReadScope, etsyReadConfig } from '../../../../../lib/etsy/oauth'
import { reportWindow, summarizeEtsyReceipt } from '../../../../../lib/etsy/order-report'
import { decryptEtsyToken, encryptEtsyToken } from '../../../../../lib/etsy/token-vault'

const pageSize = 100
const maximumReceipts = 500

type EtsyService = {
  getReadConnection(): Promise<{ id: string, shop_id: number, encrypted_refresh_token: string, scopes: unknown }>
  recordRead(input: { id: string, encryptedRefreshToken: string, accessExpiresAt: Date }): Promise<unknown>
}

function grantedScopes(value: unknown) {
  if (!value || typeof value !== 'object') return []
  const granted = (value as { granted?: unknown }).granted
  return Array.isArray(granted) ? granted.filter((scope): scope is string => typeof scope === 'string') : []
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (process.env.ETSY_ORDER_REPORT_ENABLED !== 'true') {
    return res.status(503).json({ code: 'report_disabled', message: 'The Etsy order report is not enabled.' })
  }
  const config = etsyReadConfig()
  const secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!config || !secret) return res.status(503).json({ code: 'not_configured', message: 'Etsy is not configured.' })
  let window
  try { window = reportWindow(req.query.days) }
  catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid report range.' }) }
  try {
    const service = req.scope.resolve(ETSY_MODULE) as EtsyService
    const connection = await service.getReadConnection()
    if (!grantedScopes(connection.scopes).includes(EtsyOrderReadScope)) {
      return res.status(409).json({ code: 'reauthorization_required', message: 'Reconnect Etsy to allow read-only order reporting.' })
    }
    const refreshed = await refreshEtsyAccessToken({
      keystring: config.keystring,
      secret,
      refreshToken: decryptEtsyToken(connection.encrypted_refresh_token),
    })
    await service.recordRead({
      id: connection.id,
      encryptedRefreshToken: encryptEtsyToken(refreshed.refresh_token),
      accessExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    })
    let offset = 0
    let total = 0
    const receipts: unknown[] = []
    do {
      const page = await listEtsyShopReceipts({
        keystring: config.keystring,
        secret,
        accessToken: refreshed.access_token,
        shopId: connection.shop_id,
        minCreated: window.minCreated,
        maxCreated: window.maxCreated,
        offset,
        limit: pageSize,
      })
      total = page.total
      receipts.push(...page.receipts)
      offset += page.receipts.length
      if (!page.receipts.length) break
    } while (offset < total && offset < maximumReceipts)
    return res.json({
      readOnly: true,
      shopId: connection.shop_id,
      days: window.days,
      total,
      fetched: receipts.length,
      truncated: total > maximumReceipts,
      orders: receipts.map(summarizeEtsyReceipt),
      privacy: { buyerIdentityStored: false, shippingAddressStored: false, rawResponseStored: false },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const reason = /^Etsy (?:refresh|receipts unavailable) \(HTTP \d{3}\)\.$/.test(message) ? message : 'Etsy order report could not be completed.'
    console.error(`Etsy order report failed: ${reason}`)
    return res.status(502).json({ message: reason })
  }
}
