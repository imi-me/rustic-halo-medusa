import { z } from 'zod'
export const productSeoSchema = z.object({ title: z.string().trim().max(100), description: z.string().trim().max(320) }).strict()
export const parseProductSeoUpdate = (value: unknown) => value === null ? null : productSeoSchema.parse(value)
