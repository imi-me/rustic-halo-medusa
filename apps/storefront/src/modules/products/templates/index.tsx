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
import { HappyCowPreviewProvider } from "@modules/products/components/happy-cow-color-preview-context"
import SharedClawGallery from "@modules/products/components/shared-claw-gallery"
import { GalleryControlsProvider } from "@modules/products/components/gallery-controls"
import ProductDescription from "@modules/products/components/product-description"
import { isHairClaw } from "@lib/util/is-hair-claw"

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

  const galleryOrientation =
    product.metadata?.gallery_orientation === "portrait" ? "portrait" : "square"
  const compact = isHairClaw(product)

  return (
    <>
      <HappyCowPreviewProvider>
        <GalleryControlsProvider>
        <div className={`content-container rh-product-layout${compact ? " rh-product-compact" : ""}`} data-testid="product-container">
          <div className="rh-product-gallery"><SharedClawGallery product={product}><ImageGallery images={images} productHandle={product.handle} orientation={galleryOrientation} /></SharedClawGallery></div>
          <div className="rh-product-details">
            <ProductInfo product={product} />
            {compact ? <p className="rh-product-intro">Handcrafted hair accessories, made to order.</p> : <>
              <ProductShare title={product.title || "Rustic Halo product"} countryCode={countryCode} handle={product.handle || ""} />
              <p className="rh-made-to-order">Made to order <span aria-hidden="true">·</span> Ships in 3–5 business days</p>
            </>}
            <Suspense fallback={<ProductActions disabled product={product} region={region} />}>
              <ProductActionsWrapper id={product.id} region={region} />
            </Suspense>
            {compact ? <p className="rh-compact-production">Made to order <span aria-hidden="true">·</span> Ships in 3–5 business days</p> : <ProductTabs product={product} />}
          </div>
          {compact && <div className="rh-product-story">
            <div><h2>About this hair claw</h2><ProductDescription product={product} /></div>
            <div><ProductTabs product={product} /><ProductShare title={product.title || "Rustic Halo product"} countryCode={countryCode} handle={product.handle || ""} /></div>
          </div>}
        </div>
        </GalleryControlsProvider>
      </HappyCowPreviewProvider>
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
