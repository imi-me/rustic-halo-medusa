// Catalog imports use straight quotes, curly quotes, double primes and inch
// labels. Only explicit 2/4-inch sizes qualify; never infer from a missing size.
export function hairClawSize(value?: string): "2" | "4" | undefined {
  const clean = value?.trim()
  if (clean === "2" || clean === "4") return clean
  const match = clean?.match(/(?:^|\s)([24])\s*(?:["“”″]|in(?:ch(?:es)?)?\.?)$/i)
  return match?.[1] as "2" | "4" | undefined
}

export function resolveHairClawSize({
  selectedSize,
  sizeValues,
  reviewedFour,
}: {
  selectedSize?: string
  sizeValues?: string[]
  reviewedFour: boolean
}) {
  if (selectedSize) return hairClawSize(selectedSize)
  if (sizeValues?.length === 1) return hairClawSize(sizeValues[0])
  return reviewedFour && (!sizeValues || sizeValues.some(v => hairClawSize(v) === "4"))
    ? "4" : undefined
}
