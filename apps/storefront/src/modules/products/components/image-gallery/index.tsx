"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  getHealingHeartsColor,
  HEALING_HEARTS_HANDLE,
  HEALING_HEARTS_PRIMARY_IMAGE,
  healingHeartsColors,
  healingHeartsReferenceViews,
} from "@lib/brand/healing-hearts-colors"
import { happyCowColors, HAPPY_COW_HANDLE } from "@lib/brand/happy-cow-colors"
import { useHappyCowPreview } from "@modules/products/components/happy-cow-color-preview-context"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productHandle?: string
  orientation?: "square" | "portrait"
}

const ImageGallery = ({
  images,
  productHandle,
  orientation = "square",
}: ImageGalleryProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHealingHeartsProof = productHandle === HEALING_HEARTS_HANDLE
  const selectedColorSlug = searchParams.get("color")
  const selectedColor = getHealingHeartsColor(selectedColorSlug)
  const [hoveredColorSlug, setHoveredColorSlug] = useState<string | null>(null)
  const [activeReferenceView, setActiveReferenceView] = useState<string | null>(null)
  const {
    canPreviewFourInch,
    previewColorSlug,
    setPreviewColorSlug,
  } = useHappyCowPreview()
  const isHappyCowProof = productHandle === HAPPY_COW_HANDLE && canPreviewFourInch
  const selectedPreviewColor =
    happyCowColors.find((color) => color.slug === previewColorSlug) ??
    happyCowColors[0]
  const displayedColor = getHealingHeartsColor(
    hoveredColorSlug === "primary"
      ? null
      : hoveredColorSlug ?? selectedColorSlug
  )
  const proofImages = [
    {
      id: "healing-hearts-primary",
      url: HEALING_HEARTS_PRIMARY_IMAGE,
      label: "Themed primary image",
    },
    ...healingHeartsColors.map((color) => ({
      id: `healing-hearts-${color.slug}`,
      url: color.image,
      label: `${color.name} base color`,
    })),
  ]
  const usableImages = isHealingHeartsProof
    ? proofImages
    : images.filter((image) => !!image.url)
  const [activeIndex, setActiveIndex] = useState(0)
  const proofIndex = hoveredColorSlug === "primary"
    ? 0
    : hoveredColorSlug
    ? healingHeartsColors.findIndex(
        (color) => color.slug === hoveredColorSlug
      ) + 1
    : selectedColorSlug
    ? Math.max(
        1,
        healingHeartsColors.findIndex(
          (color) => color.slug === selectedColor.slug
        ) + 1
      )
    : 0
  const displayedIndex = isHealingHeartsProof ? proofIndex : activeIndex
  const activeImage = usableImages[displayedIndex]
  const selectedReferenceView = healingHeartsReferenceViews.find(
    (view) => view.id === activeReferenceView
  )
  const mainImage = selectedReferenceView ?? activeImage
  const activeImageScale =
    isHealingHeartsProof && displayedIndex > 0 && !selectedReferenceView
      ? healingHeartsColors[displayedIndex - 1]?.imageScale ?? 1
      : 1
  if (!mainImage?.url) return null

  if (isHappyCowProof && selectedPreviewColor) {
    return (
      <div className="rh-image-gallery rh-proof-gallery" aria-label="Happy Cow 4-inch color previews">
        <div className="rh-proof-gallery-layout">
          <div className="rh-proof-gallery-main">
            <div className="rh-gallery-primary" data-orientation="square">
              <Image
                src={selectedPreviewColor.image}
                priority
                alt={`Happy Cow 4-inch hair claw visual preview in ${selectedPreviewColor.name}`}
                fill
                sizes="(max-width: 760px) 100vw, 40vw"
                className="rh-gallery-image"
              />
            </div>
            <div className="rh-proof-gallery-thumbnails" aria-label="Choose a 4-inch plastic-color preview">
              {happyCowColors.map((color) => (
                <button
                  key={color.slug}
                  type="button"
                  className="rh-proof-gallery-thumbnail"
                  aria-label={`Preview 4-inch Happy Cow clip in ${color.name}`}
                  aria-pressed={selectedPreviewColor.slug === color.slug}
                  onClick={() => setPreviewColorSlug(color.slug)}
                >
                  <span className="rh-proof-gallery-thumbnail-image" data-orientation="square">
                    <Image src={color.image} alt="" fill sizes="140px" />
                  </span>
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <fieldset className="rh-proof-swatch-rail">
              <legend>Plastic color preview</legend>
              {happyCowColors.map((color) => (
                <button
                  key={color.slug}
                  type="button"
                  className="rh-proof-swatch-choice"
                  aria-label={`Preview ${color.name} plastic`}
                  aria-pressed={selectedPreviewColor.slug === color.slug}
                  onClick={() => setPreviewColorSlug(color.slug)}
                >
                  <span className="rh-proof-swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                  <span>{color.name}</span>
                </button>
              ))}
            </fieldset>
            <p className="rh-color-preview-note" role="status">
              {selectedPreviewColor.name} is a visual preview only. It does not change the selected size, price, availability, or the item added to your cart.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const chooseImage = (index: number) => {
    setActiveReferenceView(null)
    if (!isHealingHeartsProof) {
      setActiveIndex(index)
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    if (index === 0) {
      params.delete("color")
    } else {
      params.set("color", healingHeartsColors[index - 1].slug)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const chooseProofColor = (slug: string) => {
    setActiveReferenceView(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("color", slug)
    router.replace(`${pathname}?${params.toString()}`)
  }

  if (isHealingHeartsProof) {
    return (
      <div className="rh-image-gallery rh-proof-gallery" aria-label="Product images and base colors">
        <div className="rh-proof-gallery-layout">
          <div className="rh-proof-gallery-main">
            <div className="rh-gallery-primary" data-orientation={orientation}>
              <Image
                src={mainImage.url}
                priority
                alt={
                  selectedReferenceView
                    ? `4-inch Taupe sample hair claw, ${selectedReferenceView.label.toLowerCase()}`
                    : displayedIndex === 0
                    ? "Healing Hearts hair claw in a healthcare-themed setting"
                    : `Healing Hearts hair claw in ${displayedColor.name}`
                }
                fill
                sizes="(max-width: 760px) 100vw, 40vw"
                className="rh-gallery-image"
                style={{ transform: `scale(${activeImageScale})` }}
              />
            </div>
            <div className="rh-proof-gallery-thumbnails" aria-label="Choose a base-color image">
              {healingHeartsColors.map((color, index) => (
                <button
                  key={color.slug}
                  type="button"
                  className="rh-proof-gallery-thumbnail"
                  aria-label={`Show ${color.name} base color`}
                  aria-pressed={selectedColor.slug === color.slug}
                  onClick={() => chooseImage(index + 1)}
                >
                  <span
                    className="rh-proof-gallery-thumbnail-image"
                    data-orientation={orientation}
                  >
                    <Image
                      src={color.image}
                      alt=""
                      fill
                      sizes="140px"
                      style={{ transform: `scale(${color.imageScale})` }}
                    />
                  </span>
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
            <section className="rh-proof-reference-views" aria-label="Additional 4-inch Taupe sample views">
              <p className="rh-proof-reference-heading">Additional views · 4-inch Taupe sample</p>
              <div className="rh-proof-reference-grid">
                {healingHeartsReferenceViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    className="rh-proof-gallery-thumbnail"
                    aria-label={`Show 4-inch Taupe sample ${view.label.toLowerCase()}`}
                    aria-pressed={activeReferenceView === view.id}
                    onClick={() => setActiveReferenceView(view.id)}
                  >
                    <span className="rh-proof-gallery-thumbnail-image" data-orientation={orientation}>
                      <Image src={view.url} alt="" fill sizes="140px" />
                    </span>
                    <span>{view.label}</span>
                  </button>
                ))}
              </div>
              <p className="rh-proof-reference-note">Reference views show the Taupe sample and clasp; the engraved front is shown in the main product images.</p>
            </section>
          </div>
          <fieldset className="rh-proof-swatch-rail">
            <legend>Base color</legend>
            <button
              type="button"
              className="rh-proof-primary-choice"
              aria-pressed={displayedIndex === 0}
              onClick={() => chooseImage(0)}
              onMouseEnter={() => {
                setActiveReferenceView(null)
                setHoveredColorSlug("primary")
              }}
              onFocus={() => {
                setActiveReferenceView(null)
                setHoveredColorSlug("primary")
              }}
            >
              Themed primary
            </button>
            {healingHeartsColors.map((color) => (
              <button
                key={color.slug}
                type="button"
                className="rh-proof-swatch-choice"
                aria-pressed={selectedColor.slug === color.slug}
                onClick={() => chooseProofColor(color.slug)}
                onMouseEnter={() => {
                  setActiveReferenceView(null)
                  setHoveredColorSlug(color.slug)
                }}
                onFocus={() => {
                  setActiveReferenceView(null)
                  setHoveredColorSlug(color.slug)
                }}
              >
                <span
                  className="rh-proof-swatch"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden="true"
                />
                <span>{color.name}</span>
              </button>
            ))}
          </fieldset>
        </div>
      </div>
    )
  }

  return (
    <div className="rh-image-gallery" aria-label="Product images">
      <div className="rh-gallery-primary" data-orientation={orientation}><Image src={activeImage.url} priority alt={`Product image ${displayedIndex + 1}`} fill sizes="(max-width: 760px) 100vw, 45vw" className="rh-gallery-image" /></div>
      {usableImages.length > 1 && <div className="rh-gallery-thumbnails" aria-label="Choose a product image">
        {usableImages.map((image, index) => <button key={image.id || image.url} type="button" className="rh-gallery-thumbnail" aria-label={`Show product image ${index + 1}`} aria-pressed={index === displayedIndex} onClick={() => chooseImage(index)}><Image src={image.url!} alt="" fill sizes="72px" className="rh-gallery-thumbnail-image" /></button>)}
      </div>}
    </div>
  )
}

export default ImageGallery
