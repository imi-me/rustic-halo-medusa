import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ETSY_MODULE } from '../../../../modules/etsy'
import { parseEtsyWebhook, verifyEtsyWebhookSignature } from '../../../../lib/etsy/webhook'

function header(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (process.env.ETSY_WEBHOOK_INGEST_ENABLED !== 'true') {
    return res.status(503).json({ message: 'Etsy webhook intake is disabled.' })
  }
  const secret = process.env.ETSY_WEBHOOK_SIGNING_SECRET?.trim()
  const webhookId = header(req.headers['webhook-id'])
  const timestamp = header(req.headers['webhook-timestamp'])
  const signature = header(req.headers['webhook-signature'])
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || '')
  if (!secret || !webhookId || !timestamp || !signature || !rawBody.length) {
    return res.status(401).json({ message: 'Invalid Etsy webhook.' })
  }
  let envelope
  try {
    if (!verifyEtsyWebhookSignature({ webhookId, timestamp, signature, rawBody, secret })) {
      return res.status(401).json({ message: 'Invalid Etsy webhook.' })
    }
    envelope = parseEtsyWebhook(rawBody)
  } catch {
    return res.status(400).json({ message: 'Invalid Etsy webhook.' })
  }
  try {
    const service = req.scope.resolve(ETSY_MODULE) as {
      getReadConnection(): Promise<{ shop_id: number }>
      recordWebhookDelivery(input: {
        webhookId: string, eventType: string, shopId: number, receiptId: number,
        resourceUrl: string, emittedAt: Date,
      }): Promise<{ duplicate: boolean }>
    }
    const connection = await service.getReadConnection()
    if (connection.shop_id !== envelope.shopId) return res.status(403).json({ message: 'Etsy shop mismatch.' })
    const result = await service.recordWebhookDelivery({
      webhookId, eventType: envelope.eventType, shopId: envelope.shopId,
      receiptId: envelope.receiptId, resourceUrl: envelope.resourceUrl,
      emittedAt: new Date(Number(timestamp) * 1000),
    })
    return res.status(200).json({ accepted: true, duplicate: result.duplicate, processingEnabled: false })
  } catch {
    return res.status(503).json({ message: 'Etsy webhook journal is unavailable.' })
  }
}
