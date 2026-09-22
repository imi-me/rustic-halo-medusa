import { completeCartWorkflow } from '@medusajs/medusa/core-flows'
import { MedusaError } from '@medusajs/framework/utils'
import { validateCartTax } from '../../lib/tax/validate-cart'

completeCartWorkflow.hooks.validate(async ({input}, {container}) => {
 try { await validateCartTax(container,input.id) }
 catch { throw new MedusaError(MedusaError.Types.INVALID_DATA,'We could not verify your checkout total. Please refresh checkout and try again.') }
})
