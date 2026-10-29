import Image from "next/image"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import InteractiveLink from "@modules/common/components/interactive-link"
import CategoryLinks from "@modules/store/components/category-links"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  optionValueIds,
  query,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  query?: string
  optionValueIds?: OptionValueIds
}) {
  const photo =
    category.handle === "hair-claws"
      ? "/brand/editorial/country-skies.jpg"
      : category.handle === "home-decor"
      ? "/brand/editorial/welcome-succas.jpg"
      : category.handle === "earrings"
      ? "/brand/editorial/autumn-lace.jpg"
      : null
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="rh-catalog-page content-container"
      data-testid="category-container"
    >
      <div className="w-full">
        <nav className="rh-breadcrumb" aria-label="Breadcrumb">
          <LocalizedClientLink href="/">Home</LocalizedClientLink>
          <span aria-hidden="true">/</span>
          <LocalizedClientLink href="/store">Shop</LocalizedClientLink>
          <span aria-hidden="true">/</span>
          {parents &&
            parents.map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="mr-4 hover:text-black"
                  href={`/categories/${parent.handle}`}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                /
              </span>
            ))}
          <span aria-current="page">{category.name}</span>
        </nav>
        <div className="rh-catalog-heading">
          <div>
            <span className="rh-b-kicker">The Rustic Halo collection</span>
            <h1 data-testid="category-page-title">{category.name}</h1>
            {category.description && (
              <p className="rh-catalog-subtitle">{category.description}</p>
            )}
          </div>
          {photo && (
            <Image
              src={photo}
              alt={`${category.name} collection`}
              width={185}
              height={160}
              className="rh-b-category-photo"
            />
          )}
        </div>
        {category.category_children && (
          <div className="mb-8 text-base-large">
            <ul className="grid grid-cols-1 gap-2">
              {category.category_children?.map((c) => (
                <li key={c.id}>
                  <InteractiveLink href={`/categories/${c.handle}`}>
                    {c.name}
                  </InteractiveLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <CategoryLinks activeHandle={category.handle} />
        <div className="rh-catalog-toolbar">
          <form className="rh-b-category-search" role="search">
            <input
              type="search"
              name="q"
              defaultValue={query}
              aria-label="Search this collection"
              placeholder="Search this collection"
            />
            <input type="hidden" name="sortBy" value={sort} />
            <button type="submit" aria-label="Search this collection">
              ⌕
            </button>
          </form>
          <RefinementList sortBy={sort} hideOptionsPicker />
        </div>
        <Suspense
          key={`${category.id}-${sort}-${query}-${optionValueIds?.join(",")}`}
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            query={query}
            page={pageNumber}
            categoryId={category.id}
            countryCode={countryCode}
            optionValueIds={optionValueIds}
          />
        </Suspense>
      </div>
    </div>
  )
}
