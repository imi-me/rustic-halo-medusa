import { ADMIN_OPERATIONS } from '../modules/admin-operations'
export async function purchasedProviderLabel(
  container: any,
  order: any,
  additionalData: any,
  items: any[] = [],
) {
  if (!order?.id || typeof additionalData?.admin_label_id !== 'string')
    throw new Error('Buy and confirm a label in the order shipping section first.')
  const service = container[ADMIN_OPERATIONS]
  const operation = await service.retrieveAdminOperation(additionalData.admin_label_id)
  if (
    operation.kind !== 'shippo-label' ||
    operation.resource_id !== order.id ||
    operation.status !== 'purchased'
  )
    throw new Error('Purchased label does not belong to this order.')
  const planned = [...new Set(operation.payload.items.map((row: any) => row.id))].sort()
  const actual = [...new Set(items.map((row: any) => row.line_item_id))].sort()
  if (
    JSON.stringify(planned) !== JSON.stringify(actual) ||
    items.some((row) => Number(row.quantity) <= 0)
  )
    throw new Error('The purchased label must fulfill exactly its planned order items.')
  return {
    data: { shippo_transaction_id: operation.payload.label.transaction_id },
    labels: [
      {
        tracking_number: operation.payload.label.tracking_number,
        tracking_url: operation.payload.label.tracking_url,
        label_url: operation.payload.label.label_url,
      },
    ],
  }
}
