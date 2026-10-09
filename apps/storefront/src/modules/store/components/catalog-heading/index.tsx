import { listCollections } from "@lib/data/collections"
import { homeCollectionTiles } from "@lib/brand/home-collections"
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
  const { collections } = await listCollections()
  const categories = collections.filter((collection) => collection.handle !== "best-sellers")
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
        <nav aria-label="Product collections" className="rh-collection-links">
          <LocalizedClientLink href="/store" aria-current={!collectionHandle ? "page" : undefined}>All products</LocalizedClientLink>
          {categories.map((collection) => (
            <LocalizedClientLink key={collection.id} href={`/collections/${collection.handle}`} aria-current={collection.handle === collectionHandle ? "page" : undefined}>
              {homeCollectionTiles.find((tile) => tile.handle === collection.handle)?.label || collection.title}
            </LocalizedClientLink>
          ))}
        </nav>
        <RefinementList sortBy={sortBy} hideOptionsPicker />
      </div>
    </>
  )
}
