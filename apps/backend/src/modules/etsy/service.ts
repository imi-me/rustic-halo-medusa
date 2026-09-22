import { MedusaService } from '@medusajs/framework/utils'
import EtsyConnection from './models/etsy-connection'
import EtsyWebhookDelivery from './models/etsy-webhook-delivery'

class EtsyModuleService extends MedusaService({ EtsyConnection, EtsyWebhookDelivery }) {
  async getReadConnection() {
    const connections = await this.listEtsyConnections({}, { take: 2 })
    if (connections.length !== 1) throw new Error('Etsy connection configuration needs review.')
    return connections[0]
  }

  async saveReadConnection(input: {
    shopId: number
    encryptedRefreshToken: string
    accessExpiresAt: Date
    scopes: string[]
  }) {
    const existing = await this.listEtsyConnections({}, { take: 2 })
    if (existing.length > 1) throw new Error('Etsy connection configuration needs review.')
    const data = {
      shop_id: input.shopId,
      encrypted_refresh_token: input.encryptedRefreshToken,
      access_expires_at: input.accessExpiresAt,
      scopes: { granted: input.scopes },
      connected_at: new Date(),
    }
    return existing[0]
      ? this.updateEtsyConnections({ id: existing[0].id, ...data })
      : this.createEtsyConnections(data)
  }

  async recordRead(input: { id: string, encryptedRefreshToken: string, accessExpiresAt: Date }) {
    return this.updateEtsyConnections({
      id: input.id,
      encrypted_refresh_token: input.encryptedRefreshToken,
      access_expires_at: input.accessExpiresAt,
      last_read_at: new Date(),
    })
  }

  async recordWebhookDelivery(input: {
    webhookId: string
    eventType: string
    shopId: number
    receiptId: number
    resourceUrl: string
    emittedAt: Date
  }) {
    const existing = await this.listEtsyWebhookDeliveries({ webhook_id: input.webhookId }, { take: 2 })
    if (existing.length > 1) throw new Error('Etsy webhook journal needs review.')
    if (existing[0]) return { delivery: existing[0], duplicate: true }
    try {
      const delivery = await this.createEtsyWebhookDeliveries({
        webhook_id: input.webhookId,
        event_type: input.eventType,
        shop_id: input.shopId,
        receipt_id: input.receiptId,
        resource_url: input.resourceUrl,
        emitted_at: input.emittedAt,
        received_at: new Date(),
        status: 'received_unprocessed',
      })
      return { delivery, duplicate: false }
    } catch (error) {
      const raced = await this.listEtsyWebhookDeliveries({ webhook_id: input.webhookId }, { take: 2 })
      if (raced.length === 1) return { delivery: raced[0], duplicate: true }
      throw error
    }
  }
}

export default EtsyModuleService
