export const HAPPY_COW_HANDLE = "happy-cow-hair-claw"

const happyCowPalette = [
  ["Black", "#222222"],
  ["Espresso", "#3b302c"],
  ["Mocha", "#6a5143"],
  ["Chocolate", "#81563f"],
  ["Caramel", "#ae7d4e"],
  ["Khaki", "#bd956b"],
  ["Taupe", "#927f6f"],
  ["Sand", "#d4b995"],
  ["Ivory", "#eee8dd"],
  ["Gray", "#929292"],
  ["Terracotta", "#b35e46"],
  ["Rose", "#bd8582"],
  ["Purple", "#735079"],
] as const

export const happyCowColors = happyCowPalette.map(([name, hex]) => {
  const slug = name.toLowerCase()

  return {
    name,
    slug,
    hex,
    image: `/images/hair-claws/happy-cow/recolor-v1/${slug}.webp`,
  }
})

export const isHappyCowFourInchSize = (value?: string) =>
  /^4(?:\s|["'″”]|$)/i.test(value?.trim() ?? "") && !/cate/i.test(value ?? "")
