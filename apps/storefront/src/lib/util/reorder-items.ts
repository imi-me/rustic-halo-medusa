export type ReorderLine = { variantId: string; quantity: number }
/** Resume after the last confirmed line if the cart rejects an unavailable item. */
export async function reorderItems(
  lines: ReorderLine[],
  start: number,
  add: (line: ReorderLine) => Promise<void>,
  confirmed: (nextIndex: number) => void
) {
  for (let index = start; index < lines.length; index++) {
    await add(lines[index])
    confirmed(index + 1)
  }
}
