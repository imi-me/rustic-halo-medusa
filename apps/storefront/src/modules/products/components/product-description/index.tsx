import { cleanDescription, richDescription } from "@lib/util/product-description"
import { HttpTypes } from "@medusajs/types"

const decodeText = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
  .replace(/&(amp|lt|gt|quot|apos);/gi, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name.toLowerCase() as "amp" | "lt" | "gt" | "quot" | "apos"])

const inline = (text: string) => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : /^\*[^*]+\*$/.test(part) ? <em key={index}>{part.slice(1, -1)}</em> : part)

export default function ProductDescription({ product }: { product: HttpTypes.StoreProduct }) {
  const description = product.description ? decodeText(product.description).trim() : ""
  if (!description) return null
  if (richDescription(product.description || "")) return <section className="rh-product-description rh-rich-product-description" data-testid="product-description" dangerouslySetInnerHTML={{ __html: cleanDescription(product.description || "") }}/>
  const detailsMatch = description.match(/^\s*details\s*:\s*([\s\S]+)$/i)
  const details = detailsMatch?.[1].split(/(?:\r?\n|\s*[•]\s*)/).map((item) => item.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
  if (details && details.length > 1) return <section className="rh-product-description" aria-labelledby="product-details-summary"><h2 id="product-details-summary">Details</h2><ul>{details.map((detail, index) => <li key={`${detail}-${index}`}>{inline(detail)}</li>)}</ul></section>
  // Formatting is rendered as React text; raw HTML and links are never executed.
  const blocks: Array<{ list: boolean; lines: string[] }> = []
  for (const line of description.split(/\r?\n/)) {
    const list = /^[-•]\s/.test(line)
    if (!line.trim()) { blocks.push({ list: false, lines: [] }); continue }
    const last = blocks[blocks.length - 1]
    if (last && last.list === list && last.lines.length) last.lines.push(list ? line.slice(2) : line)
    else blocks.push({ list, lines: [list ? line.slice(2) : line] })
  }
  return <section className="rh-product-description" data-testid="product-description">{blocks.map((block, index) => {
    return block.list ? <ul key={index}>{block.lines.map((line, row) => <li key={row}>{inline(line)}</li>)}</ul> : block.lines.length ? <p key={index} style={{ whiteSpace: "pre-line", marginBottom: 12 }}>{inline(block.lines.join("\n"))}</p> : null
  })}</section>
}
