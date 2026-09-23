"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useState } from "react"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const usableImages = images.filter((image) => !!image.url)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = usableImages[activeIndex]
  if (!activeImage?.url) return null

  return (
    <div className="rh-image-gallery" aria-label="Product images">
      <div className="rh-gallery-primary"><Image src={activeImage.url} priority alt={`Product image ${activeIndex + 1}`} fill sizes="(max-width: 760px) 100vw, 45vw" className="rh-gallery-image" /></div>
      {usableImages.length > 1 && <div className="rh-gallery-thumbnails" aria-label="Choose a product image">
        {usableImages.map((image, index) => <button key={image.id || image.url} type="button" className="rh-gallery-thumbnail" aria-label={`Show product image ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)}><Image src={image.url!} alt="" fill sizes="72px" className="rh-gallery-thumbnail-image" /></button>)}
      </div>}
    </div>
  )
}

export default ImageGallery
