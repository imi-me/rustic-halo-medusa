import { HttpTypes } from "@medusajs/types"
import { brandCollections, brandPicks } from "./assets"

// Images are Rustic Halo photography; collection identities come from Medusa.
export const homeCollectionTiles = [
  { label: "Hair Claws", handle: "hair-accessories-claws-and-clips", image: brandCollections[1].image, alt: brandCollections[1].alt },
  { label: "Earrings", handle: "earrings", image: brandCollections[0].image, alt: brandCollections[0].alt },
  { label: "Signs", handle: "novelty-signs", image: brandCollections[2].image, alt: brandCollections[2].alt },
  { label: "Gifts", handle: "gifts-home-decor", image: brandPicks[4].image, alt: "Rustic Halo wooden goat door hanger" },
] as const

export const availableHomeCollections = (collections: HttpTypes.StoreCollection[]) =>
  homeCollectionTiles.filter((tile) => collections.some((collection) => collection.handle === tile.handle))
