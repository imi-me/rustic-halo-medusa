import { createHash } from 'node:crypto'

// Relation queries can return the same records in different orders. Metadata
// arrays retain their order because artwork points and other saved sequences matter.
function canonical(value: any, metadata = false): any {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    const rows = value.map(row => canonical(row, metadata))
    if (!metadata && rows.length && rows.every(row => typeof row?.id === 'string')) rows.sort((a, b) => a.id.localeCompare(b.id))
    return rows
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], metadata || key === 'metadata')]))
  return value
}
export function clawCatalogFingerprint(product: any) {
  return createHash('sha256').update(JSON.stringify(canonical(product))).digest('hex')
}
