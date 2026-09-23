import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"

import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import ProductShare from "@modules/products/components/product-share"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <div className="content-container rh-product-layout" data-testid="product-container">
        <div className="rh-product-gallery"><ImageGallery images={images} /></div>
        <div className="rh-product-details">
          <ProductInfo product={product} />
          <ProductShare title={product.title || "Rustic Halo product"} countryCode={countryCode} handle={product.handle || ""} />
          <p className="rh-made-to-order">Made to order <span aria-hidden="true">·</span> Ships in 3–5 business days</p>
          <Suspense fallback={<ProductActions disabled product={product} region={region} />}>
            <ProductActionsWrapper id={product.id} region={region} />
          </Suspense>
          <ProductTabs product={product} />
        </div>
      </div>
      <div
        className="content-container rh-related-products"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
