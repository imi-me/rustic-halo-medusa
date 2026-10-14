import { purchasedProviderLabel } from '../shippo-provider-label'
const operation = () => ({
  kind: 'shippo-label',
  resource_id: 'order_one',
  status: 'purchased',
  payload: {
    items: [{ id: 'orli_one', quantity: 1 }],
    label: {
      transaction_id: 'tx_one',
      label_url: 'https://labels.example.invalid/one.pdf',
      tracking_number: 'TRACK',
      tracking_url: 'https://carrier.example.invalid/TRACK',
    },
  },
})
it('attaches only an already purchased label to its exact planned order items', async () => {
  const container = { admin_operations: { retrieveAdminOperation: async () => operation() } }
  const output = await purchasedProviderLabel(
    container,
    { id: 'order_one' },
    { admin_label_id: 'op_one' },
    [{ line_item_id: 'orli_one', quantity: 1 }],
  )
  expect(output.labels[0].tracking_number).toBe('TRACK')
  await expect(
    purchasedProviderLabel(container, { id: 'order_other' }, { admin_label_id: 'op_one' }, [
      { line_item_id: 'orli_one', quantity: 1 },
    ]),
  ).rejects.toThrow('does not belong')
  await expect(
    purchasedProviderLabel(container, { id: 'order_one' }, { admin_label_id: 'op_one' }, [
      { line_item_id: 'orli_other', quantity: 1 },
    ]),
  ).rejects.toThrow('exactly its planned')
})
it('cannot buy or attach a label through the quote provider alone', async () => {
  await expect(purchasedProviderLabel({}, { id: 'order_one' }, {})).rejects.toThrow(
    'Buy and confirm',
  )
})
