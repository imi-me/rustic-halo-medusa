"use client"

import { ReactNode, useId, useState } from "react"
import GalleryControls from "@modules/products/components/gallery-controls"
import ClawColorPicker from "@modules/products/components/claw-color-picker"
import { healingHeartsColors } from "@lib/brand/healing-hearts-colors"
import { everyPawOverlay } from "@lib/brand/every-paw-overlay"
import { countrySkiesBorderFit } from "@lib/brand/country-skies-overlay"
import { goldenLoveOverlay as template } from "@lib/brand/golden-love-overlay"
import { goldenLoveBorderFit, goldenLoveEngravedBorder } from "@lib/brand/golden-love-border-fit"

export default function GoldenLoveGallery({ children, design = "golden-love" }: { children: ReactNode; design?: "golden-love" | "country-skies" | "every-paw" }) {
  const isEveryPaw = design === "every-paw"
  const isCountrySkies = design === "country-skies"
  const name = isEveryPaw ? "Every Paw Matters" : isCountrySkies ? "Country Skies" : "Golden Love"
  const borderFit = isCountrySkies ? countrySkiesBorderFit : goldenLoveBorderFit
  const imagePath = isEveryPaw ? "/images/hair-claws/every-paw/wood-overlay-v1.png" : isCountrySkies ? "/images/hair-claws/country-skies/wood-overlay-v1.png" : "/images/hair-claws/golden-love/wood-overlay-v2.png"
  const [colorSlug, setColorSlug] = useState(isEveryPaw ? "black" : "taupe")
  const [failed, setFailed] = useState(false)
  const id = useId().replace(/:/g, "")
  const color = healingHeartsColors.find((item) => item.slug === colorSlug)!
  const scale = (template.clipLengthMm - 2 * template.revealMm) / template.woodLengthMm
  const length = template.woodLengthMm * scale
  // Mirror the upper curve around the horizontal center for an even handle.
  const handlePath = `M 4 ${length * .33} C -4 ${length * .34} -9 ${length * .30} -13 ${length * .28} Q -16 ${length * .27} -16 ${length * .31} L -16 ${length * .69} Q -16 ${length * .73} -13 ${length * .72} C -9 ${length * .70} -4 ${length * .66} 4 ${length * .67} Z`
  // Turn the supplied outline, preserving its geometry, to match the upright dog photo.
  const pathTransform = `translate(${template.woodWidthMm} ${template.woodLengthMm}) rotate(180) translate(${-template.originX} ${-template.originY}) ${template.cutTransform}`
  const borderTransform = `translate(${template.woodWidthMm} ${template.woodLengthMm}) rotate(180) translate(${-template.originX} ${-template.originY}) ${goldenLoveEngravedBorder.transform}`

  if (failed) return <>{children}</>

  return (
    <div className={isEveryPaw ? "rh-every-paw-gallery" : isCountrySkies ? "rh-country-skies-gallery" : "rh-golden-love-gallery"} aria-label={`${name} 4-inch color previews`}>
      <div style={{ width: "100%", aspectRatio: "1", background: "#fff" }}>
        <svg viewBox={isEveryPaw ? "-12 -51 125 125" : "-45 -12 125 125"} role="img" aria-labelledby={`${id}-title`} style={{ width: "100%", height: "100%", display: "block" }}>
          <title id={`${id}-title`}>{`${name} 4-inch hair claw in ${color.name}, with a 1/16-inch colored rim`}</title>
          <defs>
            <clipPath id={`${id}-wood`}><path d={template.cutPath} transform={pathTransform} /></clipPath>
            <clipPath id={`${id}-engraving`}><path d={goldenLoveEngravedBorder.path} transform={borderTransform} /></clipPath>
            <mask id={`${id}-outward-border`} maskUnits="userSpaceOnUse" x={-20} y={-10} width={80} height={130}>
              <rect x={-20} y={-10} width={80} height={130} fill="white" />
              {/* Preserve the original 0.3 mm inner edge; the wider stroke grows outward. */}
              <path d={goldenLoveEngravedBorder.path} transform={borderTransform} fill="black" stroke="white" strokeWidth={0.6} strokeLinejoin="round" />
            </mask>
            <filter id={`${id}-rounded-edge`} x="-30%" y="-10%" width="160%" height="120%">
              <feGaussianBlur stdDeviation=".12" />
            </filter>
            <linearGradient id={`${id}-handle`} gradientUnits="userSpaceOnUse" x1={-16} y1={0} x2={2} y2={0}>
              <stop offset="0" stopColor="white" stopOpacity=".16" /><stop offset=".12" stopColor="black" stopOpacity=".05" /><stop offset=".4" stopColor="black" stopOpacity=".12" /><stop offset=".7" stopColor="black" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity="0" />
            </linearGradient>
            <filter id={`${id}-shadow`} x="-80%" y="-20%" width="260%" height="160%">
              <feDropShadow in="SourceGraphic" dx="-3" dy="2" stdDeviation="3.5" floodOpacity=".22" result="ambient" />
              <feDropShadow in="ambient" dx="-.6" dy=".8" stdDeviation=".55" floodOpacity=".18" />
            </filter>
          </defs>
          <g transform={isEveryPaw ? `translate(${length} 0) rotate(90)` : undefined}>
          <g filter={`url(#${id}-shadow)`}>
            <g filter={`url(#${id}-rounded-edge)`}>
              <path d={handlePath} fill={color.hex} />
              <path d={handlePath} fill={`url(#${id}-handle)`} />
            </g>
            <g transform={`scale(${scale})`}>
              <path d={template.cutPath} transform={pathTransform} fill={color.hex} stroke={color.hex} strokeWidth={2 * template.revealMm / scale} strokeLinejoin="round" filter={`url(#${id}-rounded-edge)`} />
              <g clipPath={`url(#${id}-wood)`}>
                <path d={template.cutPath} transform={pathTransform} fill={isCountrySkies || isEveryPaw ? "#eee0c5" : "#e8cd9f"} />
                <g clipPath={`url(#${id}-engraving)`}>{isEveryPaw ? (
                  <g transform={everyPawOverlay.transform}>
                    <defs><clipPath id={`${id}-source-interior`}><polygon points={everyPawOverlay.sourceInterior} /></clipPath></defs>
                    <image clipPath={`url(#${id}-source-interior)`} href={imagePath} width={everyPawOverlay.width} height={everyPawOverlay.height} onError={() => setFailed(true)} />
                    <path d={everyPawOverlay.ecgJoin} fill="#73330c" />
                  </g>
                ) : borderFit.map((band, index) => (
                  <svg key={index} x={-20} y={band.y} width={80} height={band.height} viewBox={`-20 ${band.y} 80 ${band.height}`} overflow="hidden">
                    <image href={imagePath} x={band.imageX} y={band.imageY} width={band.imageWidth} height={band.imageHeight} preserveAspectRatio="none" onError={() => setFailed(true)} />
                  </svg>
                ))}</g>
                <g mask={`url(#${id}-outward-border)`}>
                  <path d={goldenLoveEngravedBorder.path} transform={borderTransform} fill="none" stroke={isCountrySkies || isEveryPaw ? "#956234" : "#552914"} strokeWidth={1.8} strokeLinejoin="round" />
                </g>
              </g>
            </g>
          </g>
          </g>
        </svg>
      </div>
    <GalleryControls>
    <ClawColorPicker compact productName={name} value={colorSlug} onChange={setColorSlug} />
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#676567", margin: "0 0 20px" }} role="status">{color.name} is a visual color preview. It does not change the item, price, or available options added to your cart.</p>
          </GalleryControls>
<details><summary style={{ cursor: "pointer", padding: "12px 0", borderTop: "1px solid #ddd" }}>Original product photos</summary>{children}</details>
    </div>
  )
}
