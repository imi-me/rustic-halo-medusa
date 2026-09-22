"use client"

import { Link, Share } from "@medusajs/icons"
import { useState } from "react"

type ProductShareProps = {
  title: string
  countryCode: string
  handle: string
}

export default function ProductShare({ title, countryCode, handle }: ProductShareProps) {
  const [feedback, setFeedback] = useState("")
  const [manualLink, setManualLink] = useState("")

  const productLink = () => {
    const current = new URL(window.location.href)
    const selectedVariant = current.searchParams.get("v_id")
    const productUrl = new URL(`/${countryCode}/products/${handle}`, current.origin)
    if (selectedVariant) productUrl.searchParams.set("v_id", selectedVariant)
    return productUrl.href
  }

  const copyLink = async () => {
    const link = productLink()
    setFeedback("")
    setManualLink("")

    try {
      await navigator.clipboard.writeText(link)
      setFeedback("Product link copied")
    } catch {
      setManualLink(link)
      setFeedback("Select and copy this product link")
    }
  }

  const shareProduct = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} | Rustic Halo`, url: productLink() })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    await copyLink()
  }

  return (
    <div className="rh-product-share">
      <button type="button" onClick={shareProduct} aria-label={`Share ${title}`}>
        <Share aria-hidden="true" /> <span>Share this product</span>
      </button>
      <button type="button" onClick={copyLink} aria-label={`Copy link to ${title}`}>
        <Link aria-hidden="true" /> <span>Copy link</span>
      </button>
      <span className="rh-share-feedback" role="status" aria-live="polite">{feedback}</span>
      {manualLink && <input aria-label="Product link to copy" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} />}
    </div>
  )
}
