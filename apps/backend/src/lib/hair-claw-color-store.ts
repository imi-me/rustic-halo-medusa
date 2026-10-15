import { randomUUID } from 'node:crypto'
import { clawPaletteSchema, defaultClawColors } from './hair-claw-colors'
const key = 'hair-claw-colors:v1'
export async function readClawPalette(operations: any) {
  const [row] = await operations.listAdminOperations({ operation_key: key })
  return row ? { colors: clawPaletteSchema.parse(row.payload.colors), revision: String(row.payload.revision) } : { colors: defaultClawColors, revision: 'default-v1' }
}
export async function saveClawPalette(operations: any, input: unknown, expected: string) {
  const colors = clawPaletteSchema.parse(input), current = await readClawPalette(operations)
  if (current.revision !== expected) throw Error('Shared colors changed in another window. Reload before saving; your draft is kept.')
  if (current.colors.some(c => !colors.some(n => n.slug === c.slug && n.name === c.name))) throw Error('Retire colors instead of deleting or renaming them, so saved variants and orders remain valid.')
  const [row] = await operations.listAdminOperations({ operation_key: key })
  const payload = { colors, revision: randomUUID() }
  if (row) await operations.updateAdminOperations({ id: row.id, payload })
  else await operations.createAdminOperations({ operation_key: key, kind: 'hair-claw-colors', resource_id: 'global', status: 'configured', payload })
  return payload
}
