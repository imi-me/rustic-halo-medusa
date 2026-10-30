"use client"

import { useId } from "react"

export type SortOptions = "title_asc" | "title_desc" | "created_at"

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
    value: "title_asc",
    label: "Name: A–Z",
  },
  {
    value: "title_desc",
    label: "Name: Z–A",
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
        value={sortOptions.some((option) => option.value === sortBy) ? sortBy : "created_at"}
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
