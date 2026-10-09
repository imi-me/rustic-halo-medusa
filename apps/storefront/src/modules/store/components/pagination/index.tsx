"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function LoadMore({
  page,
  shown,
  total,
}: {
  page: number
  shown: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    if (isPending) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page + 1))
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="rh-load-more" data-testid="product-load-more">
      <p role="status">Showing {shown} of {total} products</p>
      {shown < total && (
        <button
          type="button"
          className="rh-ui-button rh-ui-button-primary"
          onClick={loadMore}
          disabled={isPending}
          aria-busy={isPending}
          aria-controls="catalog-products"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  )
}
