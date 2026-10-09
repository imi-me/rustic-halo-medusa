import { Suspense } from "react"

import { OptionValueIds } from "@lib/util/product-option-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import CatalogHeading from "@modules/store/components/catalog-heading"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = ({
  query,
  sortBy,
  page,
  countryCode,
  optionValueIds,
}: {
  query?: string
  sortBy?: SortOptions
  page?: string
  countryCode: string
  optionValueIds?: OptionValueIds
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <div
      className="rh-catalog-page content-container"
      data-testid="category-container"
    >
      <div className="w-full">
        <CatalogHeading title={query ? `Search results for “${query}”` : "Explore the collection"} subtitle={query ? undefined : "Find something that feels like you."} sortBy={sort} titleTestId="store-page-title" />
        <Suspense key={`${query}-${pageNumber}-${sort}`} fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            query={query}
            sortBy={sort}
            page={pageNumber}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default StoreTemplate
