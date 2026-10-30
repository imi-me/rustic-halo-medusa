import LocalizedClientLink from "@modules/common/components/localized-client-link"
import RefinementList from "../refinement-list"
import { SortOptions } from "../refinement-list/sort-products"

export default function CatalogHeading({
  title,
  sortBy,
  collectionHandle,
  subtitle,
  titleTestId,
}: {
  title: string
  sortBy: SortOptions
  collectionHandle?: string
  subtitle?: string
  titleTestId?: string
}) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="rh-breadcrumb">
        <LocalizedClientLink href="/">Home</LocalizedClientLink>
        <span aria-hidden="true">/</span>
        {collectionHandle ? (
          <>
            <LocalizedClientLink href="/store">Shop</LocalizedClientLink>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{title}</span>
          </>
        ) : (
          <span aria-current="page">Shop</span>
        )}
      </nav>
      <div className="rh-catalog-header">
        <div className="rh-catalog-heading">
          <h1 data-testid={titleTestId}>{title}</h1>
          {subtitle && <p className="rh-catalog-subtitle">{subtitle}</p>}
        </div>
        <div className="rh-catalog-toolbar">
          <RefinementList sortBy={sortBy} hideOptionsPicker />
        </div>
      </div>
    </>
  )
}
