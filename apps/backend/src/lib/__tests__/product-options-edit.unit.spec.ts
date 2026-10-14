import { optionsChanges, optionsSnapshot, type WorkspaceOption } from '../product-options-edit'
const original: WorkspaceOption[] = [{ id: 'opt_color', title: 'Color', is_exclusive: true, values: [{ id: 'val_rose', value: 'Rose' }, { id: 'val_blue', value: 'Blue' }] }]
it('retains option/value IDs and sends only changed links without touching variants', () => {
  expect(optionsChanges(original, original)).toEqual({ add: [], update: [], remove: [] })
  expect(optionsChanges(original, [{ ...original[0], values: [original[0].values[0], { value: 'Green' }] }])).toEqual({ add: [], remove: [], update: [{ product_option_id: 'opt_color', add: [{ value: 'Green' }], remove: ['val_blue'] }] })
  expect(optionsChanges(original, [...original, { title: 'Size', values: [{ value: 'Large' }] }]).add[0]).toEqual({ title: 'Size', is_exclusive: true, values: ['Large'], ranks: { Large: 1 } })
})
it('blocks accidental shared option mutation and duplicate or empty values', () => {
  expect(() => optionsChanges(original, [{ ...original[0], title: 'Finish' }])).toThrow('catalog')
  expect(() => optionsChanges([{ ...original[0], is_exclusive: false }], [{ ...original[0], values: [{ value: 'Green' }] }])).toThrow('shared')
  expect(() => optionsChanges(original, [{ title: 'Size', values: [] }])).toThrow('non-empty')
  expect(() => optionsChanges(original, [{ title: 'Size', values: [{ value: 'Large' }, { value: 'large' }] }])).toThrow('different')
  expect(() => optionsChanges(original, [...original, { title: ' color ', values: [{ value: 'Green' }] }])).toThrow('different name')
})
it('snapshots are stable across response order and detect changed value links', () => {
  expect(optionsSnapshot(original)).toBe(optionsSnapshot([{ ...original[0], values: [...original[0].values].reverse() }]))
  expect(optionsSnapshot(original)).not.toBe(optionsSnapshot([{ ...original[0], values: [original[0].values[0]] }]))
})
