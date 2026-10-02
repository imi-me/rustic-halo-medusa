export const HEALING_HEARTS_HANDLE = "healing-hearts-nurse-hair-claw"

export const HEALING_HEARTS_PRIMARY_IMAGE =
  "/images/hair-claws/healing-hearts/primary-themed.jpg"

export const healingHeartsReferenceViews = [
  {
    id: "side-profile",
    label: "Side profile",
    url: "/images/hair-claws/healing-hearts/side-profile-taupe.jpg",
  },
  {
    id: "back-clasp",
    label: "Back and clasp",
    url: "/images/hair-claws/healing-hearts/back-clasp-taupe.jpg",
  },
] as const

const healingHeartsPalette = [
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

export const healingHeartsColors = healingHeartsPalette.map(([name, hex]) => {
  const slug = name.toLowerCase()

  return {
    name,
    slug,
    hex,
    image: `/images/hair-claws/healing-hearts/recolor-v6/${slug}.webp`,
    imageScale: 1,
  }
})

export const getHealingHeartsColor = (value?: string | null) =>
  healingHeartsColors.find((color) => color.slug === value?.toLowerCase()) ??
  healingHeartsColors[0]
