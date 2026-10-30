"use client"

import { HttpTypes } from "@medusajs/types"
import ProductPhoto from "../product-photo"
import { ReactNode, useEffect, useState } from "react"
import styles from "./gallery.module.css"

export default function ClawMediaGallery({
  product,
  preview,
  viewKey,
  colorHex,
}: {
  product: HttpTypes.StoreProduct
  preview: ReactNode
  viewKey: string
  colorHex: string
}) {
  const [photoId, setPhotoId] = useState<string | null>(null)
  const photos = (product.images || []).filter(image => Boolean(image.url))
  const photo = photos.find(image => image.id === photoId)
  const photoIndex = photos.findIndex(image => image.id === photoId)

  // A changed purchase color/size returns to its preview. Merely inspecting an
  // original photo never changes the selected variant or saved artwork fit.
  useEffect(() => setPhotoId(null), [product.id, viewKey])

  return <div className={styles.gallery} aria-label={`${product.title} images`}>
    <div className={styles.main}>
      <div style={{ display: photo ? "none" : undefined }} aria-hidden={Boolean(photo)}>{preview}</div>
      {photo && <div className="rh-gallery-primary" data-orientation="square">
        <ProductPhoto src={photo.url!} alt={`${product.title} — original photo ${photoIndex + 1}`} sizes="(max-width: 760px) 100vw, 50vw" className="rh-gallery-image" />
      </div>}
    </div>
    <div className={styles.thumbnails} role="group" aria-label="Choose a product photo or color preview">
      <button type="button" className={styles.thumbnail} aria-label="Show color preview" aria-pressed={!photo} onClick={() => setPhotoId(null)}>
        <span className={styles.color} style={{ backgroundColor: colorHex }} aria-hidden="true" />
        <span className={styles.previewLabel}>Preview</span>
      </button>
      {photos.map((image, index) => <button key={image.id} type="button" className={styles.thumbnail} aria-label={`Show original photo ${index + 1}`} aria-pressed={photo?.id === image.id} onClick={() => setPhotoId(image.id)}>
        <ProductPhoto src={image.url!} alt="" sizes="64px" className={styles.thumbnailImage} />
      </button>)}
    </div>
  </div>
}
