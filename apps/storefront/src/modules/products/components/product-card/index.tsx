"use client"

import Image from "next/image"
import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { isProductSoldOut } from "@lib/util/product-availability"
import { visibleProductOptions } from "@lib/util/product-options"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const swatchColors: Record<string, string> = {
  black: "#292925", blue: "#587c9b", blush: "#ce9b9a", brown: "#71533d",
  clear: "#e9e6dc", cream: "#e5d6ba", espresso: "#3a2b28", green: "#687b57",
  ivory: "#eee7d7", mint: "#aac8b4", navy: "#354763", "ocean blue": "#447390",
  pink: "#c78f91", purple: "#89749b", red: "#a6554d", sage: "#9aa78b",
  "sky blue": "#9abbd0", slate: "#77818a", tan: "#bd9a73", taupe: "#9d8b80",
  terracotta: "#ae6950", tortoise: "#78553a", white: "#f3f0e9",
}

type CardColor = { label: string; variantId: string; image?: string }

function colorsForProduct(product: HttpTypes.StoreProduct): CardColor[] {
  const colorOption = product.options?.find((option) => /^(base |claw )?colou?r$/i.test(option.title || ""))
  const isHairClaw = product.collection?.handle === "hair-accessories-claws-and-clips" || /hair claw/i.test(product.title || "")
  if (!isHairClaw || !colorOption) return []

  const seen = new Set<string>()
  return (product.variants || []).flatMap((variant) => {
    const label = variant.options?.find((option) => option.option_id === colorOption.id || option.option?.id === colorOption.id)?.value
    if (!label || seen.has(label)) return []
    seen.add(label)
    return [{ label, variantId: variant.id, image: variant.images?.[0]?.url || undefined }]
  })
}

export default function ProductCard({ product }: { product: HttpTypes.StoreProduct }) {
  const [selected, setSelected] = useState<CardColor | null>(null)
  const colors = colorsForProduct(product)
  const images = [product.thumbnail, ...(product.images || []).map((image) => image.url)].filter((url): url is string => !!url)
  const primaryImage = selected?.image || images[0]
  const secondaryImage = !selected && images.find((url) => url !== primaryImage)
  const href = `/products/${product.handle}${selected ? `?v_id=${selected.variantId}` : ""}`
  const price = getProductPrice({ product }).cheapestPrice
  const amounts = new Set((product.variants || []).map((variant) => variant.calculated_price?.calculated_amount).filter((amount): amount is number => typeof amount === "number"))
  const hasOptions = visibleProductOptions(product.options).length > 0

  return (
    <article className="rh-product-card">
      <LocalizedClientLink href={href} className="rh-product-card-media" aria-label={`View ${product.title}`}>
        {primaryImage ? <Image src={primaryImage} alt={product.title || "Rustic Halo product"} fill sizes="(max-width: 640px) 46vw, 32vw" className="rh-product-card-image" /> : <span className="rh-product-card-fallback">Rustic Halo</span>}
        {secondaryImage && <Image src={secondaryImage} alt="" aria-hidden fill sizes="(max-width: 640px) 46vw, 32vw" className="rh-product-card-image rh-product-card-image-secondary" />}
        {isProductSoldOut(product) && <span className="rh-stock-badge">Sold out</span>}
      </LocalizedClientLink>
      <div className="rh-product-card-body">
        <h3><LocalizedClientLink href={href}>{product.title}</LocalizedClientLink></h3>
        {price && <p className="rh-product-card-price">{amounts.size > 1 ? "From " : ""}{price.calculated_price}</p>}
        {colors.length > 1 && <div className="rh-product-swatches" role="group" aria-label={`${product.title} base colors`}>
          {colors.slice(0, 5).map((color) => <button key={color.variantId} type="button" title={color.label} aria-label={`Preview ${color.label} base color for ${product.title}`} aria-pressed={selected?.variantId === color.variantId} className="rh-product-swatch" style={{ backgroundColor: swatchColors[color.label.toLowerCase()] || "#d4c8b6" }} onClick={() => setSelected(color)} />)}
          {colors.length > 5 && <span>+{colors.length - 5}</span>}
        </div>}
        <LocalizedClientLink href={href} className="rh-product-card-action">{hasOptions ? "Choose options" : "View details"}<span aria-hidden="true">→</span></LocalizedClientLink>
      </div>
    </article>
  )
}
