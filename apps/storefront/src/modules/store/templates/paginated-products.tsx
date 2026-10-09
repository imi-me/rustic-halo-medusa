import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { LoadMore } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  q?: string
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  query,
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  optionValueIds,
}: {
  query?: string
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const loadedPages = Number.isFinite(page)
    ? Math.min(1000, Math.max(1, Math.floor(page)))
    : 1
  const queryParams: PaginatedProductsParams = {
    limit: PRODUCT_LIMIT * loadedPages,
  }

  if (query) queryParams.q = query

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products, count },
  } = await listProductsWithSort({
    page: 1,
    queryParams,
    sortBy,
    countryCode,
    optionValueIds,
  })

  return (
    <>
      {products.length > 0 && <p className="rh-product-count" aria-live="polite">{count} {count === 1 ? "product" : "products"}</p>}
      {products.length === 0 && <div className="rh-empty-results"><h2>{query ? "No matching products yet" : "New things are on their way"}</h2><p>{query ? "Try another search, or browse our current shop while we prepare this collection." : "Explore our current shop for available designs."}</p><a href="https://rustichalo.com/collections/all" target="_blank" rel="noreferrer">Visit our current shop ↗</a></div>}
      <ul
        id="catalog-products"
        className="rh-catalog-grid"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={region} />
            </li>
          )
        })}
      </ul>
      {count > 0 && (
        <LoadMore page={loadedPages} shown={products.length} total={count} />
      )}
    </>
  )
}
