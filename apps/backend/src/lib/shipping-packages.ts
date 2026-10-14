import { z } from 'zod'
import starter from '../scripts/data/shipping-packages.json'
export const SHIPPING_KEY = 'shipping_package_v1'
export const assignmentSchema = z.object({ package_id: z.string().max(100).default(''), units_per_box: z.number().int().min(1).max(100).nullable().default(null), ships_alone: z.boolean().default(false), packing_group: z.enum(['standard', 'hair_claws', 'earrings']).default('standard') }).strict()
export type PackageAssignment = z.infer<typeof assignmentSchema>
export const emptyAssignment = (): PackageAssignment => assignmentSchema.parse({})
const limitSchema = z.object({ hair_claws: z.number().int().min(0).max(100), earring_pairs: z.number().int().min(0).max(100) }).strict().refine(row => row.hair_claws + row.earring_pairs > 0, 'A packing combination must hold at least one item.')
export const packageSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), name: z.string().trim().min(1).max(100), active: z.boolean(), length: z.number().positive().max(108), width: z.number().positive().max(108), height: z.number().positive().max(108), packaging_weight: z.number().nonnegative().max(1120), capacity: z.number().int().min(1).max(100), combine_products: z.boolean(), accessory_limits: z.array(limitSchema).max(20).default([]) }).strict()
export type ShippingPackage = z.infer<typeof packageSchema>
export const packagesSchema = z.object({ packages: z.array(packageSchema).min(1).max(100), type_defaults: z.record(z.string().max(100), z.string().max(100)).default({}) }).strict().superRefine((value, ctx) => {
  if (new Set(value.packages.map(row => row.id)).size !== value.packages.length || new Set(value.packages.map(row => row.name.toLowerCase())).size !== value.packages.length) ctx.addIssue({ code: 'custom', message: 'Packages need unique names and IDs.' })
  if (Object.values(value.type_defaults).some(id => !value.packages.some(row => row.id === id && row.active))) ctx.addIssue({ code: 'custom', message: 'Product type defaults must use active packages.' })
})
export type PackageConfig = z.infer<typeof packagesSchema> & { revision: string }
export function defaultPackages(): PackageConfig {
  return { revision: 'initial', type_defaults: {}, packages: starter.packages.map(row => ({ ...row, name: ({ 'hair-claw-box': 'Hair claw / accessory box', 'earring-box': 'Earring box', '14-inch-sign-box': '14-inch sign box' } as Record<string, string>)[row.id], active: true, combine_products: row.id !== '14-inch-sign-box', accessory_limits: row.id === 'hair-claw-box' ? starter.accessory_box_limits : [] })).map(row => packageSchema.parse({ id: row.id, name: row.name, active: row.active, length: row.length, width: row.width, height: row.height, packaging_weight: row.packaging_weight, capacity: row.capacity, combine_products: row.combine_products, accessory_limits: row.accessory_limits })) }
}
