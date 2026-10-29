import { HttpTypes } from "@medusajs/types"
/** Retain valid navigation in older catalogs that use collections instead of categories. */
export function brandCategoryHref(
  handle: string,
  categories: HttpTypes.StoreProductCategory[],
  collections: HttpTypes.StoreCollection[]
) {
  if (categories.some((category) => category.handle === handle))
    return `/categories/${handle}`
  const aliases: Record<string, string[]> = {
    "hair-claws": ["hair-accessories-claws-and-clips"],
    earrings: ["earrings"],
    "home-decor": ["signs-for-your-space", "home-decor"],
  }
  const collection = collections.find((collection) =>
    aliases[handle]?.includes(collection.handle)
  )
  return collection ? `/collections/${collection.handle}` : "/store"
}
