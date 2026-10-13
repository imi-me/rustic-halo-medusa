import { z } from 'zod'

export const HAIR_CLAW_KEY = 'hair_claw_overlays_v1'
const cornerSchema = z.object({x:z.number().min(-240).max(240),y:z.number().min(-240).max(240)}).strict()
const cornersSchema = z.array(cornerSchema).length(4).refine(points => points.length===4 && points.every((a,i) => {
  const b=points[(i+1)%4],c=points[(i+2)%4]
  return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x) > .01
}), 'Keep four distinct corners in order without crossing the image.')
export const recipeSchema = z.object({
  file_id: z.string().min(1).max(500).optional(),
  image_id: z.string().min(1).max(500).optional(),
  width: z.number().int().min(1).max(6000),
  height: z.number().int().min(1).max(6000),
  scale: z.number().min(0.1).max(3),
  x: z.number().min(-120).max(120),
  y: z.number().min(-120).max(120),
  editor_version: z.literal(2).optional(),
  rotation: z.number().min(-180).max(180).optional(),
  source_rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  skew_x: z.number().min(-35).max(35).optional(),
  skew_y: z.number().min(-35).max(35).optional(),
  corners: cornersSchema.optional(),
  mirror_x: z.boolean().optional(),
  mirror_y: z.boolean().optional(),
  fit: z.enum(['contain', 'cover']).optional(),
  side: z.enum(['left', 'right']).optional(),
  border: z.enum(['photo', 'template', 'none']).optional(),
  crop: z.object({ top:z.number().min(0).max(90), bottom:z.number().min(0).max(90), left:z.number().min(0).max(90), right:z.number().min(0).max(90) }).strict()
    .refine(c => c.top + c.bottom < 95 && c.left + c.right < 95, 'Keep at least 5% of the source photo.').optional(),
  vertical: z.boolean(),
  enabled: z.boolean(),
}).strict().refine(r => Boolean(r.file_id) !== Boolean(r.image_id), 'Choose one saved overlay or product photo.')
  .refine(r => !r.image_id || r.editor_version === 2, 'Product photos require the current editor.')
  .refine(r => r.editor_version === 2 || (r.scale >= .8 && r.scale <= 1.01 && Math.abs(r.x) <= 50 && Math.abs(r.y) <= 50 && r.rotation === undefined && r.skew_x === undefined && r.skew_y === undefined && r.crop === undefined && r.corners === undefined && r.mirror_x === undefined && r.mirror_y === undefined), 'Use the current editor for expanded placement controls.')
export const saveSchema = z.object({
  size: z.enum(['2', '4']),
  finish: z.enum(['natural', 'cbc']).optional(),
  price: z.number().finite().min(0).max(1000000).optional(),
  pricing_revision: z.string().nullable().optional(),
  revision: z.string().nullable(),
  recipe: recipeSchema.nullable(),
}).strict()
export const templates = [
  { size: '4', ready: true, clip_width_mm: 103, wood_width_mm: 101.524414, wood_height_mm: 37.523926 },
  { size: '2', ready: false, wood_width_mm:48, wood_height_mm:30, reason: 'The 2-inch wood outline is supplied; a measured plastic claw reference is still needed.' },
]
