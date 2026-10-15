import { z } from 'zod'

export const CLAW_COLORS_KEY = 'hair_claw_colors_v1'
export type ClawColor = { name: string; slug: string; hex: string; active: boolean }
export const defaultClawColors: ClawColor[] = [
  ['Black', '#222222'], ['Espresso', '#3b302c'], ['Mocha', '#6a5143'],
  ['Chocolate', '#81563f'], ['Caramel', '#ae7d4e'], ['Khaki', '#bd956b'],
  ['Taupe', '#927f6f'], ['Sand', '#d4b995'], ['Ivory', '#eee8dd'],
  ['Gray', '#929292'], ['Terracotta', '#b35e46'], ['Rose', '#bd8582'],
  ['Purple', '#735079'],
].map(([name, hex]) => ({ name, hex, slug: name.toLowerCase(), active: true }))
export const colorSlug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const clawPaletteSchema = z.array(z.object({
  name: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/),
  slug: z.string().min(1).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  hex: z.string().regex(/^#[a-fA-F0-9]{6}$/), active: z.boolean(),
}).strict()).min(1).max(60).superRefine((colors, ctx) => {
  if (new Set(colors.map(c => c.name.toLowerCase())).size !== colors.length || new Set(colors.map(c => c.slug)).size !== colors.length || colors.some(c => colorSlug(c.name) !== c.slug)) ctx.addIssue({ code: 'custom', message: 'Use unique color names and matching color identifiers.' })
  if (!colors.some(c => c.active)) ctx.addIssue({ code: 'custom', message: 'Keep at least one shared color available.' })
})
export const clawExclusionsSchema = z.array(z.string().min(1).max(40)).max(60).refine(names => new Set(names.map(n => n.toLowerCase())).size === names.length, 'Remove duplicate color exclusions.')
export function variantClawColor(product: any, variant: any): string | undefined {
  return variant.metadata?.base_claw_color || variant.options?.find((o: any) => o.option_id === product.metadata?.hair_claw_template_v2?.color_option_id)?.value
}
export function clawColorAvailable(product: any, variant: any, palette?: ClawColor[]) {
  const name = variantClawColor(product, variant)
  if (!name) return true
  const excluded: string[] = product.metadata?.[CLAW_COLORS_KEY]?.excluded ?? []
  return !excluded.some(n => n.toLowerCase() === name.toLowerCase()) && (!palette || palette.some(c => c.active && c.name.toLowerCase() === name.toLowerCase()))
}
