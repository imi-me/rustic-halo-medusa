import { HttpTypes } from "@medusajs/types"
import ProductCard from "../product-card"

export default async function ProductPreview({
  product,
  isFeatured: _isFeatured,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  return <ProductCard product={product} />
}
