"use client"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"
import { updateLocale } from "@lib/data/locale-actions"
import { updateRegion } from "@lib/data/cart"
export default function Preferences({
  regions,
  locales,
  locale,
}: {
  regions: HttpTypes.StoreRegion[]
  locales: Locale[]
  locale: string | null
}) {
  const { countryCode } = useParams<{ countryCode: string }>()
  const path = usePathname()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const countries = regions
    .flatMap((r) => r.countries || [])
    .filter((c) => !!c.iso_2)
  if (countries.length < 2 && locales.length < 2) return null
  const change = (action: () => Promise<unknown>) => {
    setError("")
    start(async () => {
      try {
        await action()
        router.refresh()
      } catch {
        setError("Could not update your preference. Please try again.")
      }
    })
  }
  return (
    <div className="rh-b-preferences">
      {countries.length > 1 && (
        <label>
          Ship to
          <select
            value={countryCode}
            disabled={pending}
            onChange={(e) =>
              change(() =>
                updateRegion(e.target.value, path.split(`/${countryCode}`)[1])
              )
            }
          >
            {countries.map((c) => (
              <option key={c.iso_2} value={c.iso_2}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {locales.length > 1 && (
        <label>
          Language
          <select
            value={locale || locales[0]?.code}
            disabled={pending}
            onChange={(e) => change(() => updateLocale(e.target.value))}
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
