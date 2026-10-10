"use client"

import { ReactNode, useId, useState } from "react"
import { healingHeartsColors } from "@lib/brand/healing-hearts-colors"
import { goldenLoveOverlay as template } from "@lib/brand/golden-love-overlay"
import { goldenLoveBorderFit } from "@lib/brand/golden-love-border-fit"

export default function GoldenLoveGallery({ children }: { children: ReactNode }) {
  const [colorSlug, setColorSlug] = useState("taupe")
  const [failed, setFailed] = useState(false)
  const id = useId().replace(/:/g, "")
  const color = healingHeartsColors.find((item) => item.slug === colorSlug)!
  const scale = (template.clipLengthMm - 2 * template.revealMm) / template.woodLengthMm
  const length = template.woodLengthMm * scale
  // Turn the supplied outline, preserving its geometry, to match the upright dog photo.
  const pathTransform = `translate(${template.woodWidthMm} ${template.woodLengthMm}) rotate(180) translate(${-template.originX} ${-template.originY}) ${template.cutTransform}`

  if (failed) return <>{children}</>

  return (
    <div className="rh-golden-love-gallery" aria-label="Golden Love 4-inch color previews">
      <div style={{ width: "100%", aspectRatio: "1", background: "#fff" }}>
        <svg viewBox="-45 -12 125 125" role="img" aria-labelledby={`${id}-title`} style={{ width: "100%", height: "100%", display: "block" }}>
          <title id={`${id}-title`}>{`Golden Love 4-inch hair claw in ${color.name}, with a 1/16-inch colored rim`}</title>
          <defs>
            <clipPath id={`${id}-wood`}><path d={template.cutPath} transform={pathTransform} /></clipPath>
            <linearGradient id={`${id}-plastic`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="white" stopOpacity=".18" /><stop offset=".45" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity=".16" />
            </linearGradient>
            <filter id={`${id}-shadow`} x="-40%" y="-10%" width="180%" height="130%"><feDropShadow dx="1" dy="1.5" stdDeviation="1" floodOpacity=".18" /></filter>
          </defs>
          <g filter={`url(#${id}-shadow)`}>
            <path d={`M 2 ${length * .33} C -4 ${length * .34} -9 ${length * .30} -13 ${length * .28} Q -16 ${length * .27} -16 ${length * .31} L -16 ${length * .68} Q -16 ${length * .72} -12 ${length * .71} L 2 ${length * .68} Z`} fill={color.hex} />
            <path d={`M 2 ${length * .33} C -4 ${length * .34} -9 ${length * .30} -13 ${length * .28} Q -16 ${length * .27} -16 ${length * .31} L -16 ${length * .68} Q -16 ${length * .72} -12 ${length * .71} L 2 ${length * .68} Z`} fill={`url(#${id}-plastic)`} />
            <g transform={`scale(${scale})`}>
              <path d={template.cutPath} transform={pathTransform} fill={color.hex} stroke={color.hex} strokeWidth={2 * template.revealMm / scale} strokeLinejoin="round" />
              <path d={template.cutPath} transform={pathTransform} fill={`url(#${id}-plastic)`} stroke={`url(#${id}-plastic)`} strokeWidth={2 * template.revealMm / scale} strokeLinejoin="round" />
              <g clipPath={`url(#${id}-wood)`}>
                <path d={template.cutPath} transform={pathTransform} fill="#e8cd9f" />
                {goldenLoveBorderFit.map((band, index) => (
                  <svg key={index} x={-20} y={band.y} width={80} height={band.height} viewBox={`-20 ${band.y} 80 ${band.height}`} overflow="hidden">
                    <image href="/images/hair-claws/golden-love/wood-overlay-v2.png" x={band.imageX} y={band.imageY} width={band.imageWidth} height={band.imageHeight} preserveAspectRatio="none" onError={() => setFailed(true)} />
                  </svg>
                ))}
              </g>
            </g>
          </g>
        </svg>
      </div>
      <fieldset style={{ border: 0, padding: 0, minWidth: 0, margin: "16px 0" }}>
        <legend style={{ fontSize: 13, marginBottom: 12 }}>Base color preview: <strong>{color.name}</strong></legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {healingHeartsColors.map((item) => <button key={item.slug} type="button" aria-label={`Preview Golden Love in ${item.name}`} aria-pressed={item.slug === colorSlug} title={item.name} onClick={() => setColorSlug(item.slug)} style={{ width: 40, height: 40, borderRadius: "50%", background: item.hex, border: "4px solid #fff", boxShadow: item.slug === colorSlug ? "0 0 0 2px #444344" : "0 0 0 1px #b6b3b6", cursor: "pointer" }} />)}
        </div>
      </fieldset>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#676567", margin: "0 0 20px" }} role="status">{color.name} is a visual color preview. It does not change the item, price, or available options added to your cart.</p>
      <details><summary style={{ cursor: "pointer", padding: "12px 0", borderTop: "1px solid #ddd" }}>Original product photos</summary>{children}</details>
    </div>
  )
}
