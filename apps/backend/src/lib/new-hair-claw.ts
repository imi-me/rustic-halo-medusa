import { clawSize } from './hair-claw-colors'

export const newClawOffers = [
  { key: '2-natural', size: '2 inch', finish: 'Natural' },
  { key: '2-cbc', size: '2 inch', finish: 'Colors by Cate' },
  { key: '4-natural', size: '4 inch', finish: 'Natural' },
  { key: '4-cbc', size: '4 inch', finish: 'Colors by Cate' },
] as const
export function newProductIsHairClaw(type: any, title: string) {
  const value = type?.value?.trim()
  return value ? /^hair[ -]?claws?$/i.test(value) : /\bhair[ -]claws?\b/i.test(title)
}
export function validateNewClawOffers(input: { options: { title: string }[]; variants: { options: Record<string, string> }[] }) {
  if (input.options.some(option => /colou?r/i.test(option.title))) throw Error('Color is recorded on orders. Create only actual size and finish variants for hair claws.')
  if (input.options.some(option => !/^(?:claw )?(?:size|finish)$/i.test(option.title))) throw Error('Choose the actual physical size and finish for each hair-claw offer.')
  for (const variant of input.variants) if (!clawSize(Object.entries(variant.options).find(([name]) => /^(?:claw )?size$/i.test(name))?.[1])) throw Error('Choose the actual physical size for each hair-claw offer before creating it.')
}
