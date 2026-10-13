"use client"

import { healingHeartsColors } from "@lib/brand/healing-hearts-colors"
import styles from "./picker.module.css"

export default function ClawColorPicker({
  productName,
  value,
  onChange,
}: {
  productName: string
  value: string
  onChange: (slug: string) => void
}) {
  const selected = healingHeartsColors.find(color => color.slug === value)
  return (
    <fieldset className={styles.picker}>
      <legend>Base color preview: <strong>{selected?.name}</strong></legend>
      <div className={styles.colors}>
        {healingHeartsColors.map(color => (
          <button
            key={color.slug}
            type="button"
            className={styles.choice}
            aria-label={`Preview ${productName} in ${color.name}`}
            aria-pressed={value === color.slug}
            onClick={() => onChange(color.slug)}
          >
            <span className={styles.swatch} style={{ backgroundColor: color.hex }} aria-hidden="true" />
            <span>{color.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
