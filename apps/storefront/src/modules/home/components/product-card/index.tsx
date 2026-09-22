"use client"

import { useState } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "../hero/home.module.css"

export type HomeColor = {
  label: string
  variantId: string
  image?: string
}

export type HomeProduct = {
  id: string
  handle: string
  title: string
  image?: string
  price?: string
  soldOut: boolean
  hasOptions: boolean
  colors: HomeColor[]
}

const swatchColors: Record<string, string> = {
  black: "#292925",
  blue: "#587c9b",
  blush: "#ce9b9a",
  brown: "#71533d",
  clear: "#e9e6dc",
  cream: "#e5d6ba",
  espresso: "#3a2b28",
  green: "#687b57",
  ivory: "#eee7d7",
  mint: "#aac8b4",
  navy: "#354763",
  "ocean blue": "#447390",
  pink: "#c78f91",
  purple: "#89749b",
  red: "#a6554d",
  sage: "#9aa78b",
  "sky blue": "#9abbd0",
  slate: "#77818a",
  tan: "#bd9a73",
  taupe: "#9d8b80",
  terracotta: "#ae6950",
  tortoise: "#78553a",
  white: "#f3f0e9",
}

export default function HomeProductCard({ product }: { product: HomeProduct }) {
  const [selected, setSelected] = useState<HomeColor | null>(null)
  const selectedImage = selected?.image || product.image
  const productHref = `/products/${product.handle}${selected ? `?v_id=${selected.variantId}` : ""}`

  return (
    <article className={styles.productCard}>
      <LocalizedClientLink href={productHref} className={styles.productMedia} aria-label={`View ${product.title}`}>
        {selectedImage ? (
          <Image src={selectedImage} alt={product.title} fill sizes="(max-width: 560px) 46vw, (max-width: 1000px) 30vw, 20vw" className={styles.productImage} />
        ) : <span className={styles.imageFallback}>Rustic Halo</span>}
        {product.soldOut && <span className={styles.soldOut}>Sold out</span>}
      </LocalizedClientLink>
      <div className={styles.productBody}>
        <h3><LocalizedClientLink href={productHref}>{product.title}</LocalizedClientLink></h3>
        {product.colors.length > 1 && (
          <div className={styles.swatches} role="group" aria-label={`${product.title} base colors`}>
            {product.colors.slice(0, 5).map((color) => (
              <button
                key={color.variantId}
                type="button"
                title={color.label}
                aria-label={`Preview ${color.label} base color for ${product.title}`}
                aria-pressed={selected?.variantId === color.variantId}
                className={styles.swatch}
                style={{ backgroundColor: swatchColors[color.label.toLowerCase()] || "#d4c8b6" }}
                onClick={() => setSelected(color)}
              />
            ))}
            {product.colors.length > 5 && <span className={styles.moreColors}>+{product.colors.length - 5}</span>}
          </div>
        )}
        <p className={styles.price}>{product.price || "View details"}</p>
        <LocalizedClientLink href={productHref} className={styles.productAction}>
          {product.hasOptions ? "Choose options" : "View details"} <span aria-hidden="true">→</span>
        </LocalizedClientLink>
      </div>
    </article>
  )
}
