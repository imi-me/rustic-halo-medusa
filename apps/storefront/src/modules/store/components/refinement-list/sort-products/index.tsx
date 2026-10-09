"use client"

import { useId } from "react"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: string) => void
  "data-testid"?: string
}

const sortOptions = [
  {
    value: "created_at",
    label: "Latest Arrivals",
  },
  {
    value: "price_asc",
    label: "Price: Low to high",
  },
  {
    value: "price_desc",
    label: "Price: High to low",
  },
]

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const selectId = useId()

  return (
    <div className="rh-sort-control">
      <label htmlFor={selectId} className="text-sm whitespace-nowrap">Sort by</label>
      <select
        id={selectId}
        value={sortBy}
        onChange={(event) => setQueryParams("sortBy", event.target.value)}
        data-testid={dataTestId || "product-sort"}
        className="rh-product-sort"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

export default SortProducts
