import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { updateInventoryLevelsWorkflow } from '@medusajs/medusa/core-flows'
import { allowedOrigin } from '../../../../assistant/route'
import { validateStockEdit, assertStockRevision } from '../../../../../../lib/product-stock-edit'

export async function POST(req: AuthenticatedMedusaRequest<any>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!req.auth_context?.actor_id || req.auth_context.actor_type !== 'user') return res.sendStatus(401)
  if (!allowedOrigin(req)) return res.sendStatus(403)
  let edit
  try { edit = validateStockEdit(req.body) }
  catch (error) { return res.status(400).json({ message: (error as Error).message }) }
  const inventory = req.scope.resolve(Modules.INVENTORY)
  const locking = req.scope.resolve(Modules.LOCKING)
  try {
    // Use the same item lock as Medusa's fulfillment adjustments. Never write
    // reserved_quantity, delete a level, or force an availability override.
    const level = await locking.execute(req.params.id, async () => {
      const current = await inventory.retrieveInventoryLevelByItemAndLocation(req.params.id, req.params.location_id)
      assertStockRevision(current, edit)
      const { result } = await updateInventoryLevelsWorkflow(req.scope).run({ input: { updates: [{ inventory_item_id: req.params.id, location_id: req.params.location_id, stocked_quantity: edit.stocked_quantity }] } })
      return result[0]
    })
    return res.json({ level })
  } catch (error) {
    return res.status((error as Error).name === 'StockConflict' ? 409 : 400).json({ message: (error as Error).message || 'Stock could not be confirmed. Reload quantities before retrying.' })
  }
}
