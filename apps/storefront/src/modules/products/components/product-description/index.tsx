import { HttpTypes } from "@medusajs/types"

const decodeText = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
  .replace(/&(amp|lt|gt|quot|apos);/gi, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name.toLowerCase() as "amp" | "lt" | "gt" | "quot" | "apos"])

export default function ProductDescription({ product }: { product: HttpTypes.StoreProduct }) {
  const description = product.description ? decodeText(product.description).trim() : ""
  if (!description) return null
  const detailsMatch = description.match(/^\s*details\s*:\s*([\s\S]+)$/i)
  const details = detailsMatch?.[1].split(/(?:\r?\n|\s*[•]\s*)/).map((item) => item.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
  if (details && details.length > 1) return <section className="rh-product-description" aria-labelledby="product-details-summary"><h2 id="product-details-summary">Details</h2><ul>{details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul></section>
  return <p className="rh-product-description" data-testid="product-description">{description}</p>
}
