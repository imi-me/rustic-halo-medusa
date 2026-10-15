"use client"

import { healingHeartsColors } from "@lib/brand/healing-hearts-colors"
import styles from "./picker.module.css"

export default function ClawColorPicker({
  productName,
  value,
  onChange,
  compact = false,
  purchase = false,
  disabled = false,
  colors = healingHeartsColors,
}: {
  productName: string
  value: string
  onChange: (slug: string) => void
  compact?: boolean
  purchase?: boolean
  disabled?: boolean
  colors?: { name: string; slug: string; hex: string }[]
}) {
  const selected = colors.find(color => color.slug === value)
  return (
    <fieldset className={`${styles.picker}${compact ? ` ${styles.compact}` : ""}`}>
      <legend>Base color{purchase ? "" : " preview"}: <strong>{selected?.name}</strong></legend>
      <div className={styles.colors}>
        {colors.map(color => (
          <button
            key={color.slug}
            type="button"
            className={styles.choice}
            aria-label={`${purchase ? "Choose" : "Preview"} ${productName} in ${color.name}`}
            disabled={disabled}
            aria-pressed={value === color.slug}
            onClick={() => onChange(color.slug)}
          >
            <span className={styles.swatch} style={{ backgroundColor: color.hex }} aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>{color.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
