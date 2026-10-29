"use client"
import { HttpTypes } from "@medusajs/types"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { addToCart } from "@lib/data/cart"
import { reorderItems } from "@lib/util/reorder-items"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
export default function ReorderButton({
  items,
}: {
  items: HttpTypes.StoreOrderLineItem[]
}) {
  const { countryCode } = useParams<{ countryCode: string }>()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [next, setNext] = useState(0)
  const [error, setError] = useState("")
  const valid = items.length > 0 && items.every((item) => !!item.variant_id)
  async function reorder() {
    setPending(true)
    setError("")
    try {
      await reorderItems(
        items.map((item) => ({
          variantId: item.variant_id!,
          quantity: item.quantity,
        })),
        next,
        (line) => addToCart({ ...line, countryCode }),
        setNext
      )
      router.push(`/${countryCode}/cart`)
    } catch {
      setError(
        "Some pieces could not be added. They may be unavailable. Check your bag or try the remaining pieces again."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="rh-b-reorder">
      <button
        className="rh-b-button"
        type="button"
        onClick={reorder}
        disabled={!valid || pending}
      >
        {pending
          ? "Adding pieces…"
          : next
          ? "Add remaining pieces to bag"
          : "Add these pieces to bag"}
      </button>
      {!valid && (
        <p>
          Some options are no longer available. Explore the collection for
          current pieces.
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <LocalizedClientLink href="/cart">
            View your bag ↗
          </LocalizedClientLink>
        </p>
      )}
    </div>
  )
}
