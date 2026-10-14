import { randomUUID } from 'node:crypto'
import { defaultPackages, packagesSchema, type PackageConfig } from './shipping-packages'
const key = 'shipping-packages:v1'
export async function readPackageConfig(operations: any): Promise<PackageConfig> {
  const [row] = await operations.listAdminOperations({ operation_key: key })
  if (!row) return defaultPackages()
  return { ...packagesSchema.parse(row.payload.config), revision: String(row.payload.revision) }
}
export async function savePackageConfig(operations: any, input: unknown, expected: string) {
  const parsed = packagesSchema.parse(input)
  const current = await readPackageConfig(operations)
  if (current.revision !== expected) throw new Error('Packages changed in another window. Reload before saving; your edits are kept.')
  if (current.packages.some(row => !parsed.packages.some(next => next.id === row.id))) throw new Error('Archive packages instead of deleting them, so existing product assignments remain valid.')
  const [row] = await operations.listAdminOperations({ operation_key: key })
  const payload = { config: parsed, revision: randomUUID() }
  if (row) await operations.updateAdminOperations({ id: row.id, payload })
  else await operations.createAdminOperations({ operation_key: key, kind: 'shipping-packages', resource_id: 'global', status: 'configured', payload })
  return { ...parsed, revision: payload.revision }
}
