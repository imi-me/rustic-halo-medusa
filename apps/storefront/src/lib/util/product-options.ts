import { HttpTypes } from "@medusajs/types"

export const isDefaultTitleOption = (
  option: HttpTypes.StoreProductOption
) => {
  const values = option.values ?? []

  return (
    option.title?.trim().toLowerCase() === "title" &&
    values.length === 1 &&
    values[0]?.value?.trim().toLowerCase() === "default title"
  )
}

export const defaultTitleSelections = (
  options: HttpTypes.StoreProductOption[] | null | undefined
) =>
  Object.fromEntries(
    (options ?? [])
      .filter(isDefaultTitleOption)
      .map((option) => [option.id, option.values?.[0]?.value])
  ) as Record<string, string | undefined>

export const visibleProductOptions = (
  options: HttpTypes.StoreProductOption[] | null | undefined
) => (options ?? []).filter((option) => !isDefaultTitleOption(option))
