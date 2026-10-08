import ShippoTestService from '../shippo-test/service'
import { productionCommerce } from '../../lib/production-commerce'

/** Live quotes only. Labels remain a separate, owner-controlled fulfillment action. */
export default class ShippoLiveService extends ShippoTestService {
  static identifier = 'shippo-live'
  async getFulfillmentOptions() { return [{ id: 'usps_ground_advantage', name: 'USPS Ground Advantage' }] }
  async createFulfillment(): Promise<never> { throw Error('Quote provider cannot purchase labels; fulfill through the approved shipping workflow.') }
  protected shippingSettings() {
    if (!productionCommerce(process.env).shipping) throw Error('Production shipping quotes are disabled.')
    return process.env
  }
}
