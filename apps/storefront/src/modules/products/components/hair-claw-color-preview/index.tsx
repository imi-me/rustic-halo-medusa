"use client"

import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  getHealingHeartsColor,
  healingHeartsColors,
} from "@lib/brand/healing-hearts-colors"

const HairClawColorPreview = () => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = getHealingHeartsColor(searchParams.get("color"))

  const chooseColor = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("color", slug)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <fieldset className="rh-color-preview">
      <legend>Choose base color</legend>
      <div className="rh-color-preview-grid">
        {healingHeartsColors.map((color) => (
          <button
            key={color.slug}
            type="button"
            className="rh-color-preview-choice"
            aria-pressed={selected.slug === color.slug}
            onClick={() => chooseColor(color.slug)}
          >
            <span className="rh-color-preview-image">
              <Image src={color.image} alt="" fill sizes="64px" />
            </span>
            <span>{color.name}</span>
          </button>
        ))}
      </div>
      {selected.slug !== "black" && (
        <p className="rh-color-preview-note" role="status">
          {selected.name} is a visual preview. Its purchasable catalog variant
          has not been attached yet.
        </p>
      )}
    </fieldset>
  )
}

export default HairClawColorPreview
