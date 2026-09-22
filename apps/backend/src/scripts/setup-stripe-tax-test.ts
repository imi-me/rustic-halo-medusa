import type { ExecArgs } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { assertShippingTestEnvironment } from '../lib/shipping-test-environment'

export default async function setupStripeTaxTest({ container }: ExecArgs) {
  assertShippingTestEnvironment(process.env)
  if (process.env.STRIPE_TAX_TEST_ENABLED !== 'true' || !process.env.STRIPE_API_KEY?.startsWith('sk_test_')) throw new Error('Enable test tax with test credentials first.')
  const tax = container.resolve(Modules.TAX)
  const us = (await tax.listTaxRegions({ country_code: 'us' })).find(region => !region.province_code && !region.parent_id)
  if (us && (await tax.listTaxRegions({ parent_id: us.id })).length) throw new Error('Review existing US child tax regions before changing the provider.')
  if (us) await tax.updateTaxRegions({ id: us.id, provider_id: 'tp_stripe-tax-test_stripe' })
  else await tax.createTaxRegions({ country_code: 'us', provider_id: 'tp_stripe-tax-test_stripe' })
  const regions = container.resolve(Modules.REGION)
  const candidates = await regions.listRegions({}, { relations: ['countries'] })
  const storeRegion = candidates.find(region => region.countries?.some(country => country.iso_2 === 'us'))
  if (!storeRegion) throw new Error('US commerce region was not found.')
  await regions.updateRegions(storeRegion.id, { automatic_taxes: true })
  console.log('US tax region uses the NC-only Stripe test provider. Live tax is not enabled.')
}
