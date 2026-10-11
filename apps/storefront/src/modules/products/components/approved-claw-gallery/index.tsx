"use client"

import { ReactNode, useId, useState } from "react"
import { approvedClawPreviews, ApprovedClawHandle } from "@lib/brand/approved-claw-previews"
import { healingHeartsColors } from "@lib/brand/healing-hearts-colors"

export default function ApprovedClawGallery({ handle, children }: { handle: ApprovedClawHandle; children: ReactNode }) {
  const recipe = approvedClawPreviews[handle]
  const [colorSlug, setColorSlug] = useState("black")
  const [side, setSide] = useState<"left" | "right">("left")
  const [failed, setFailed] = useState(false)
  const id = useId().replace(/:/g, "")
  const color = healingHeartsColors.find(item => item.slug === colorSlug)!
  // Mirror the complete face/handle together, preserving upright artwork and equal-axis scale.
  // Markup is a bundled, reviewed SVG constant; no external/user HTML is accepted.
  const svg = recipe.svg
    .replaceAll("__COLOR__", color.hex)
    .replaceAll("__SIDE__", side === "right" ? "translate(36.895884 0) scale(-1 1)" : "")
    .replace(/\bid="([^"]+)"/g, (_, value) => `id="${id}-${value}"`)
    .replace(/url\(#([^)]*)\)/g, (_, value) => `url(#${id}-${value})`)

  if (failed) return <>{children}</>

  return <div className="rh-approved-claw-gallery" aria-label={`${recipe.name} 4-inch color previews`}>
    <img src={recipe.image} alt="" hidden onError={() => setFailed(true)} />
    <div style={{ width: "100%", aspectRatio: "1", background: "#fff" }} dangerouslySetInnerHTML={{ __html: svg }} />
    <fieldset style={{ border: 0, padding: 0, minWidth: 0, margin: "16px 0" }}>
      <legend style={{ fontSize: 13, marginBottom: 12 }}>Base color preview: <strong>{color.name}</strong></legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {healingHeartsColors.map(item => <button key={item.slug} type="button" aria-label={`Preview ${recipe.name} in ${item.name}`} aria-pressed={item.slug === colorSlug} title={item.name} onClick={() => setColorSlug(item.slug)} style={{ width: 40, height: 40, borderRadius: "50%", background: item.hex, border: "4px solid #fff", boxShadow: item.slug === colorSlug ? "0 0 0 2px #444344" : "0 0 0 1px #b6b3b6", cursor: "pointer" }} />)}
      </div>
    </fieldset>
    <div role="group" aria-label="Preview handle side" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      {(["left", "right"] as const).map(value => <button key={value} type="button" aria-pressed={side === value} onClick={() => setSide(value)} style={{ padding: "8px 12px", border: "1px solid #b6b3b6", borderRadius: 4, background: side === value ? "#edf3f6" : "white", color: "#444344" }}>Handle {value}</button>)}
    </div>
    <p style={{ fontSize: 12, lineHeight: 1.6, color: "#676567", margin: "0 0 20px" }} role="status">{color.name} is a visual color preview. It does not change the item, price, or available options added to your cart.</p>
    <details><summary style={{ cursor: "pointer", padding: "12px 0", borderTop: "1px solid #ddd" }}>Original product photos</summary>{children}</details>
  </div>
}
