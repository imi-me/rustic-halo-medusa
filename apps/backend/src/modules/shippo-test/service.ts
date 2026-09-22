import { AbstractFulfillmentProviderService } from '@medusajs/framework/utils'
import { CalculateShippingOptionPriceDTO } from '@medusajs/framework/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { assertShippingTestEnvironment } from '../../lib/shipping-test-environment'
import { shippingItems } from '../../lib/shipping-catalog'

// Local pilot only. This provider cannot purchase a label or use live credentials.
export default class ShippoTestService extends AbstractFulfillmentProviderService {
  static identifier = 'shippo-test'
  private root = process.env.APP_ROOT || resolve(process.cwd(), '../..')
  private cache = new Map<string, { until: number, amount: number }>()
  async getFulfillmentOptions() { return [{ id: 'usps_ground_advantage', name: 'USPS Ground Advantage — TEST' }] }
  async validateOption(data: Record<string, unknown>) { return data.id === 'usps_ground_advantage' }
  async canCalculate() { return true }
  async validateFulfillmentData() { return {} }
  async createFulfillment(): Promise<never> { throw new Error('Test quote provider cannot buy labels or fulfill orders.') }
  async calculatePrice(_option: CalculateShippingOptionPriceDTO['optionData'], _data: CalculateShippingOptionPriceDTO['data'], context: CalculateShippingOptionPriceDTO['context']) {
    assertShippingTestEnvironment(process.env)
    const env = process.env.APP_ENV === 'staging' ? process.env : Object.fromEntries(readFileSync(resolve(this.root, '.local/shippo.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const n = l.indexOf('='); return [l.slice(0,n), l.slice(n+1).trim().replace(/^["']|["']$/g, '')] }))
    if (!env.SHIPPO_API_KEY?.startsWith('shippo_test_')) throw new Error('Shippo test token required')
    const ctx = context as unknown as { currency_code: string, shipping_address: Record<string,string>, items: Array<{quantity:number,variant_sku?:string,variant?:{sku?:string}}> }
    // Medusa recalculates an existing shipping method when the last line is removed.
    // No parcel or external quote is needed for an empty cart.
    if (Array.isArray(ctx.items) && ctx.items.length === 0) {
      return { calculated_amount: 0, is_calculated_price_tax_inclusive: false }
    }
    const address = ctx.shipping_address
    if (ctx.currency_code !== 'usd' || address?.country_code?.toLowerCase() !== 'us' || !address.address_1 || !address.postal_code || !address.city || !address.province) throw new Error('A complete US shipping address is required')
    const items = shippingItems(ctx.items)
    const destination = { name: `${address.first_name || ''} ${address.last_name || ''}`.trim(), street1: address.address_1, street2: address.address_2 || '', city: address.city, state: address.province, zip: address.postal_code, country: 'US' }
    const cacheKey = JSON.stringify({ items, destination })
    const cached = this.cache.get(cacheKey)
    if (cached && cached.until > Date.now()) return { calculated_amount: cached.amount, is_calculated_price_tax_inclusive: false }
    const parcels = await new Promise<unknown[]>((accept, reject) => {
      const child = spawn('python3', ['-B', '-c', 'import json,sys; from shipping_parcels import build_parcels; print(json.dumps(build_parcels(json.load(sys.stdin))))'], { cwd: resolve(this.root, 'scripts') })
      let output = ''
      child.stdout.on('data', d => output += d)
      child.stderr.resume()
      child.on('error', reject)
      child.on('close', code => { if (code) reject(new Error('Unable to pack this order automatically.')); else { try { accept(JSON.parse(output)) } catch { reject(new Error('Invalid packing result')) } } })
      child.stdin.end(JSON.stringify(items))
    })
    const headers = { Authorization: `ShippoToken ${env.SHIPPO_API_KEY}`, 'Content-Type': 'application/json', 'SHIPPO-API-VERSION': '2018-02-08' }
    const origin = Object.fromEntries(['name','street1','city','state','zip','country'].map(k => [k, env[`SHIPPO_FROM_${k.toUpperCase()}`]]))
    let cents = 0
    for (const parcel of parcels) {
      const response = await fetch('https://api.goshippo.com/shipments/', { method: 'POST', headers, signal: AbortSignal.timeout(30000), body: JSON.stringify({ address_from: origin, address_to: destination, parcels: [parcel], async: false }) })
      if (!response.ok) throw new Error('Shipping quote unavailable. Please try again.')
      const shipment = await response.json()
      const rates = (shipment.rates || []).filter((r: {currency:string,servicelevel:{token:string}}) => r.currency === 'USD' && r.servicelevel.token === 'usps_ground_advantage')
      const amounts = rates.map((r: {amount:string}) => Math.round(Number(r.amount) * 100)).filter((n:number) => Number.isFinite(n) && n > 0)
      if (!amounts.length) throw new Error('USPS quote unavailable for this address.')
      cents += Math.min(...amounts)
    }
    if (this.cache.size > 100) this.cache.clear()
    this.cache.set(cacheKey, { until: Date.now() + 60000, amount: cents / 100 })
    return { calculated_amount: cents / 100, is_calculated_price_tax_inclusive: false }
  }
}
