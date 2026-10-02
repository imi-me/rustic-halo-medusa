import { z } from 'zod'

export const HAIR_CLAW_KEY = 'hair_claw_overlays_v1'
export const recipeSchema = z.object({
  file_id: z.string().min(1).max(500),
  width: z.number().int().min(1).max(6000),
  height: z.number().int().min(1).max(6000),
  scale: z.number().min(0.8).max(1.01),
  x: z.number().min(-50).max(50),
  y: z.number().min(-50).max(50),
  vertical: z.boolean(),
  enabled: z.boolean(),
}).strict()
export const saveSchema = z.object({
  size: z.enum(['2', '4']),
  revision: z.string().nullable(),
  recipe: recipeSchema.nullable(),
}).strict()
export const templates = [
  { size: '4', ready: true, clip_width_mm: 103, wood_width_mm: 101.524414, wood_height_mm: 37.523926 },
  { size: '2', ready: false, wood_width_mm:48, wood_height_mm:30, reason: 'The 2-inch wood outline is supplied; a measured plastic claw reference is still needed.' },
]
