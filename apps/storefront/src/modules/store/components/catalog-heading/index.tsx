import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import RefinementList from "../refinement-list"
import { SortOptions } from "../refinement-list/sort-products"

export default async function CatalogHeading({ title, sortBy, collectionHandle, subtitle, titleTestId }: {
  title: string
  sortBy: SortOptions
  collectionHandle?: string
  subtitle?: string
  titleTestId?: string
}) {
  const [{ collections }, productCategories] = await Promise.all([listCollections(), listCategories()])
  const categories = productCategories.filter((category) => !category.parent_category_id)
  const themes = collections.filter((collection) => collection.metadata?.grouping === "theme")
  return (
    <>
      <nav aria-label="Breadcrumb" className="rh-breadcrumb">
        <LocalizedClientLink href="/">Home</LocalizedClientLink><span aria-hidden="true">/</span>
        {collectionHandle ? <><LocalizedClientLink href="/store">Shop</LocalizedClientLink><span aria-hidden="true">/</span><span aria-current="page">{title}</span></> : <span aria-current="page">Shop</span>}
      </nav>
      <div className="rh-catalog-heading">
        <h1 data-testid={titleTestId}>{title}</h1>
        {subtitle && <p className="rh-catalog-subtitle">{subtitle}</p>}
      </div>
      <div className="rh-catalog-toolbar">
        <nav aria-label="Categories and collections" className="rh-collection-links">
          <LocalizedClientLink href="/store" aria-current={!collectionHandle ? "page" : undefined}>All products</LocalizedClientLink>
          {categories.map((category) => (
            <LocalizedClientLink key={category.id} href={`/categories/${category.handle}`}>{category.name}</LocalizedClientLink>
          ))}
          {themes.map((collection) => (
            <LocalizedClientLink key={collection.id} href={`/collections/${collection.handle}`} aria-current={collection.handle === collectionHandle ? "page" : undefined}>
              {collection.title}
            </LocalizedClientLink>
          ))}
        </nav>
        <RefinementList sortBy={sortBy} hideOptionsPicker />
      </div>
    </>
  )
}
