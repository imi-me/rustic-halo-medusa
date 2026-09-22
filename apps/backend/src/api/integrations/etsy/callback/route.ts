import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ETSY_MODULE } from '../../../../modules/etsy'
import { exchangeEtsyCode, getEtsyOwnedShopByName } from '../../../../lib/etsy/client'
import { etsyReadConfig } from '../../../../lib/etsy/oauth'
import { encryptEtsyToken } from '../../../../lib/etsy/token-vault'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const config = etsyReadConfig(), secret = process.env.ETSY_SHARED_SECRET?.trim()
  const body = req.body as { code?: unknown, verifier?: unknown } | undefined
  if (!config || !secret || typeof body?.code !== 'string' || typeof body?.verifier !== 'string') return res.status(503).json({ message: 'Etsy read connection is not configured.' })
  let stage = 'token-exchange'
  try {
    const tokens = await exchangeEtsyCode({ keystring: config.keystring, secret, code: body.code, verifier: body.verifier, redirectUri: config.callbackUrl })
    stage = 'shop-lookup'
    const expectedShop = process.env.ETSY_SHOP_NAME?.trim().toLowerCase()
    if (!expectedShop || !tokens.user_id) throw new Error('Etsy shop configuration is incomplete.')
    const shop = await getEtsyOwnedShopByName({ keystring: config.keystring, secret, shopName: expectedShop, userId: tokens.user_id })
    stage = 'save-connection'
    const service = req.scope.resolve(ETSY_MODULE) as { saveReadConnection(input: { shopId: number, encryptedRefreshToken: string, accessExpiresAt: Date, scopes: string[] }): Promise<unknown> }
    await service.saveReadConnection({ shopId: shop.shop_id, encryptedRefreshToken: encryptEtsyToken(tokens.refresh_token), accessExpiresAt: new Date(Date.now() + (tokens.expires_in as number) * 1000), scopes: [...config.scopes] })
    return res.json({ connected: true, shopId: shop.shop_id, scopes: config.scopes })
  } catch (error) {
    // Only our fixed Etsy errors are safe to log. Persistence errors may contain token data.
    const message = error instanceof Error ? error.message : ''
    const reason = /^Etsy (?:authorization failed|shops unavailable|public shop lookup unavailable) \(HTTP \d{3}\)\.$/.test(message)
      ? message
      : ['Etsy shop configuration is incomplete.', 'Etsy shop identity needs review.', 'Etsy returned invalid shop data.', 'Etsy token encryption is not configured.'].includes(message)
        ? message
        : 'Internal connection step failed.'
    console.error(`Etsy callback failed at ${stage}: ${reason}`)
    return res.status(502).json({ message: 'Etsy connection could not be completed.' })
  }
}
