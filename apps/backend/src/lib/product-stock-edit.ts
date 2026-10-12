export type StockEdit = { stocked_quantity: number; expected: { stocked_quantity: number; reserved_quantity: number; updated_at: string } }
export function validateStockEdit(body: any): StockEdit {
  if (!body || Object.keys(body).some(key => !['stocked_quantity', 'expected'].includes(key)) || !Number.isSafeInteger(body.stocked_quantity) || body.stocked_quantity < 0 || !body.expected || !Number.isSafeInteger(body.expected.stocked_quantity) || !Number.isSafeInteger(body.expected.reserved_quantity) || typeof body.expected.updated_at !== 'string' || !body.expected.updated_at || !Number.isFinite(Date.parse(body.expected.updated_at)) || body.expected.reserved_quantity < 0) throw new Error('Enter a whole, non-negative on-hand quantity and reload current stock before saving.')
  return body
}
export function assertStockRevision(level: any, edit: StockEdit) {
  if (Number(level.stocked_quantity) !== edit.expected.stocked_quantity || Number(level.reserved_quantity) !== edit.expected.reserved_quantity || new Date(level.updated_at).toISOString() !== new Date(edit.expected.updated_at).toISOString()) {
    const error = new Error('Stock changed since this page loaded. Your remaining draft is kept; discard it to reload current quantities.')
    error.name = 'StockConflict'
    throw error
  }
  if (edit.stocked_quantity < Number(level.reserved_quantity)) throw new Error('On-hand quantity cannot be below reserved stock. Manage reservations in the inventory tools.')
}
