import { TaxReporting } from './test-reporting'
import { productionCommerce } from '../production-commerce'
export class LiveTaxReporting extends TaxReporting {
  constructor(key: string) {
    if (!productionCommerce(process.env).tax) throw Error('Live tax reporting is disabled.')
    super(key, true)
  }
}
