import type { Entity, Price } from './inline-edit'
export type PriceRow = { key: string; id?: string; currency_code: string; min_quantity: string; max_quantity: string; rules: Record<string, string> }
export const priceRows = (prices: Price[] = []): PriceRow[] => prices.map(price => ({ key: price.id, id: price.id, currency_code: price.currency_code, min_quantity: price.min_quantity == null ? '' : String(price.min_quantity), max_quantity: price.max_quantity == null ? '' : String(price.max_quantity), rules: { ...price.rules ?? {} } }))
export const baseRow = (row: PriceRow) => !Object.keys(row.rules).length && !row.min_quantity && !row.max_quantity
export function pricePayload(original: Price[], rows: PriceRow[], amounts: Record<string, string>): Entity[] {
  if (new Set(rows.map(row => row.key)).size !== rows.length || JSON.stringify(Object.keys(amounts).sort()) !== JSON.stringify(rows.map(row => row.key).sort())) throw new Error('Prices changed. Reload this product before editing.')
  const seen = new Set<string>()
  return rows.map(row => {
    if (row.id && !original.some(price => price.id === row.id)) throw new Error('Prices changed. Reload this product before editing.')
    const value = amounts[row.key].trim()
    if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Each price must be zero or a positive number. Use Remove price to remove one.')
    const currency = row.currency_code.trim().toLowerCase()
    if (!/^[a-z]{3}$/.test(currency)) throw new Error('Choose a valid currency for every price.')
    const quantity = (value: string) => { if (value === '') return null; const number = Number(value); if (!Number.isSafeInteger(number) || number < 1) throw new Error('Price quantities must be positive whole numbers.'); return number }
    const min = quantity(row.min_quantity), max = quantity(row.max_quantity)
    if (min != null && max != null && max < min) throw new Error('Maximum price quantity cannot be below minimum quantity.')
    const identity = JSON.stringify([currency, min, max, Object.entries(row.rules).sort()])
    if (seen.has(identity)) throw new Error('Two prices have the same currency, region and quantity range. Keep one price for that combination.')
    seen.add(identity)
    const existing = original.find(price => price.id === row.id)
    return { ...(row.id ? { id: row.id } : {}), currency_code: currency, amount: Number(value), min_quantity: min === null && existing?.min_quantity == null && existing ? existing.min_quantity : min, max_quantity: max === null && existing?.max_quantity == null && existing ? existing.max_quantity : max, rules: row.rules }
  })
}
