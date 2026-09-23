import { HttpTypes } from "@medusajs/types"
import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-3">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="rh-product-collection"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <Heading
          level="h1"
          className="rh-product-title"
          data-testid="product-title"
        >
          {product.title}
        </Heading>
      </div>
    </div>
  )
}

export default ProductInfo
