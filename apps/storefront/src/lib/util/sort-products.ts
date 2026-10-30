import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

/**
 * Sort the complete matching catalog before pagination. Retired or unknown
 * sort values fall back to latest arrivals, including old price-sort links.
 */
export function sortProducts(
  products: HttpTypes.StoreProduct[],
  sortBy: SortOptions
): HttpTypes.StoreProduct[] {
  const sortedProducts = [...products]

  if (sortBy === "title_asc" || sortBy === "title_desc") {
    sortedProducts.sort((a, b) => {
      const diff = a.title.localeCompare(b.title, "en", {
        sensitivity: "base",
        numeric: true,
      }) || a.id.localeCompare(b.id)
      return sortBy === "title_asc" ? diff : -diff
    })
  } else {
    sortedProducts.sort((a, b) => {
      return (
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      )
    })
  }

  return sortedProducts
}
