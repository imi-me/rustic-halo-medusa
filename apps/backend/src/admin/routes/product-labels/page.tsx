import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ROLLS,
  SHEETS,
  getLabelDefaults,
  makeBarcodeDataUrl,
  printAverySheet,
  printRollLabels,
  setLabelDefault,
  withInvPrefix,
  type LabelData,
} from "@rustic-halo/label-printing"

type VariantPrice = { amount?: number | string; currency_code?: string }
type Variant = {
  id: string
  title?: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  prices?: VariantPrice[]
}
type Product = {
  id: string
  title: string
  status?: string | null
  variants?: Variant[]
}
type ProductResponse = { products: Product[]; count: number; limit: number; offset: number }

type CatalogLabel = {
  id: string
  productTitle: string
  variantTitle: string
  status: string
  sku: string
  barcode: string
  value: string
  price: string
}

type QueueEntry = CatalogLabel & { qty: number }

const PRINT_LIST_KEY = "rustic-halo-medusa-print-list-v1"

const readQueue = (): QueueEntry[] => {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(window.localStorage.getItem(PRINT_LIST_KEY) || "[]")
    return Array.isArray(value)
      ? value.filter((item): item is QueueEntry =>
          Boolean(item && typeof item.id === "string" && typeof item.qty === "number"))
      : []
  } catch {
    return []
  }
}

const firstPrice = (variant: Variant) => {
  const price = variant.prices?.find((entry) => entry.currency_code?.toLowerCase() === "usd")
    ?? variant.prices?.[0]
  return price?.amount === undefined ? "" : String(price.amount)
}

const labelTitle = (product: Product, variant: Variant) => {
  const title = variant.title?.trim() || ""
  return !title || title.toLowerCase() === "default" || title.toLowerCase() === "default variant"
    ? product.title
    : `${product.title} — ${title}`
}

const flattenProducts = (products: Product[]): CatalogLabel[] => products.flatMap((product) =>
  (product.variants ?? []).map((variant) => ({
    id: variant.id,
    productTitle: product.title,
    variantTitle: labelTitle(product, variant),
    status: product.status || "unknown",
    sku: variant.sku?.trim() || "",
    barcode: variant.barcode?.trim() || variant.upc?.trim() || variant.ean?.trim() || "",
    value: variant.barcode?.trim() || variant.upc?.trim() || variant.ean?.trim() || variant.sku?.trim() || "",
    price: firstPrice(variant),
  })))

const ProductLabelsPage = () => {
  const defaults = useMemo(() => getLabelDefaults(), [])
  const [catalog, setCatalog] = useState<CatalogLabel[]>([])
  const [queue, setQueue] = useState<QueueEntry[]>(readQueue)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("published")
  const [message, setMessage] = useState(defaults.message)
  const [invPrefix, setInvPrefix] = useState(defaults.invPrefix)
  const [mode, setMode] = useState<"sheet" | "roll">(defaults.mode)
  const [sheetId, setSheetId] = useState(defaults.sheetId)
  const [rollId, setRollId] = useState(defaults.rollId)
  const [customW, setCustomW] = useState(defaults.customW)
  const [customH, setCustomH] = useState(defaults.customH)
  const [startPosition, setStartPosition] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("Loading product variants…")

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setNotice("Loading product variants…")
    try {
      const products: Product[] = []
      let offset = 0
      let count = 0
      do {
        const params = new URLSearchParams({
          limit: "100",
          offset: String(offset),
          fields: "id,title,status,*variants,*variants.prices",
        })
        const response = await fetch(`/admin/products?${params}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        const body = await response.json() as ProductResponse | { message?: string }
        if (!response.ok || !("products" in body)) {
          throw new Error("message" in body && body.message ? body.message : "The catalog is unavailable.")
        }
        products.push(...body.products)
        count = body.count
        offset += body.products.length
        if (body.products.length === 0) break
      } while (offset < count)
      const rows = flattenProducts(products).sort((a, b) => a.variantTitle.localeCompare(b.variantTitle))
      setCatalog(rows)
      setNotice(`${rows.length} variants ready for label selection.`)
    } catch (error) {
      setCatalog([])
      setNotice(error instanceof Error ? error.message : "The catalog is unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => {
    try { window.localStorage.setItem(PRINT_LIST_KEY, JSON.stringify(queue)) } catch { /* optional persistence */ }
  }, [queue])

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.filter((item) => {
      if (status !== "all" && item.status !== status) return false
      if (!terms.length) return true
      const haystack = [item.productTitle, item.variantTitle, item.sku, item.barcode].join(" ").toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }, [catalog, query, status])

  const addToQueue = (item: CatalogLabel) => {
    if (!item.value) return
    setQueue((current) => {
      const existing = current.find((entry) => entry.id === item.id)
      return existing
        ? current.map((entry) => entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry)
        : [...current, { ...item, qty: 1 }]
    })
  }

  const updateQty = (id: string, qty: number) => setQueue((current) =>
    qty <= 0 ? current.filter((entry) => entry.id !== id) : current.map((entry) => entry.id === id ? { ...entry, qty } : entry))

  const labels = useMemo<LabelData[]>(() => queue.flatMap((entry) =>
    Array.from({ length: entry.qty }, () => ({
      title: entry.variantTitle,
      value: invPrefix ? withInvPrefix(entry.value) : entry.value,
      price: entry.price,
      message,
    }))), [queue, message, invPrefix])

  const sheet = SHEETS.find((entry) => entry.id === sheetId) ?? SHEETS[0]
  const roll = ROLLS.find((entry) => entry.id === rollId) ?? ROLLS[0]
  const rollW = roll.id === "custom" ? Number(customW) : roll.w
  const rollH = roll.id === "custom" ? Number(customH) : roll.h
  const preview = labels[0]
  const previewBarcode = useMemo(() => preview ? makeBarcodeDataUrl(preview.value, false) : null, [preview])

  const print = async () => {
    if (!labels.length) return
    setLabelDefault("mode", mode)
    setLabelDefault("sheet", sheetId)
    setLabelDefault("roll", rollId)
    setLabelDefault("customW", customW)
    setLabelDefault("customH", customH)
    setLabelDefault("message", message)
    setLabelDefault("invPrefix", String(invPrefix))
    if (mode === "sheet") {
      printAverySheet(sheet, startPosition, labels)
    } else {
      if (!Number.isFinite(rollW) || !Number.isFinite(rollH) || rollW <= 0 || rollH <= 0) {
        setNotice("Enter a valid custom label width and height.")
        return
      }
      await printRollLabels(rollW, rollH, "landscape", labels)
    }
    setNotice(`Prepared ${labels.length} label${labels.length === 1 ? "" : "s"} for the print dialog.`)
  }

  return <div className="flex flex-col gap-4">
    <Container className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base px-6 py-4">
        <div>
          <Heading level="h1">Product labels</Heading>
          <Text size="small" className="text-ui-fg-subtle">Market Suite layout · Medusa variants · printing only</Text>
        </div>
        <Button variant="secondary" size="small" onClick={() => void loadCatalog()} disabled={loading}>Refresh catalog</Button>
      </div>
      <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <input className="rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, or barcode" aria-label="Search products" />
            <select className="rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Product status">
              <option value="published">Published</option><option value="draft">Draft</option><option value="all">All statuses</option>
            </select>
          </div>
          <Text size="small" className="mb-3 text-ui-fg-subtle">{notice}</Text>
          <div className="max-h-[32rem] overflow-auto rounded-md border border-ui-border-base">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-ui-border-base bg-ui-bg-subtle"><tr>
                <th className="px-3 py-2 font-medium">Product / variant</th><th className="px-3 py-2 font-medium">SKU</th><th className="px-3 py-2 font-medium">Barcode source</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>{filtered.slice(0, 250).map((item) => <tr key={item.id} className="border-b border-ui-border-base">
                <td className="px-3 py-3"><div className="font-medium">{item.variantTitle}</div><div className="text-xs text-ui-fg-subtle">{item.status}</div></td>
                <td className="px-3 py-3 font-mono text-xs">{item.sku || "—"}</td>
                <td className="px-3 py-3 font-mono text-xs">{item.barcode || (item.sku ? "SKU fallback" : "Missing")}</td>
                <td className="px-3 py-3 text-right"><Button size="small" variant="secondary" disabled={!item.value} onClick={() => addToQueue(item)}>Add</Button></td>
              </tr>)}</tbody>
            </table>
            {!loading && filtered.length === 0 ? <div className="px-4 py-8 text-center text-sm text-ui-fg-subtle">No matching variants.</div> : null}
          </div>
          {filtered.length > 250 ? <Text size="xsmall" className="mt-2 text-ui-fg-subtle">Showing the first 250 matches. Refine the search to narrow the list.</Text> : null}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-md border border-ui-border-base p-4">
            <div className="mb-3 flex items-center justify-between"><Heading level="h2">Print list</Heading><Text size="small">{labels.length} labels</Text></div>
            <div className="max-h-52 space-y-2 overflow-auto">
              {queue.map((entry) => <div key={entry.id} className="flex items-center gap-2 rounded-md bg-ui-bg-subtle p-2">
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{entry.variantTitle}</div><div className="truncate font-mono text-xs text-ui-fg-subtle">{entry.value}</div></div>
                <input className="w-16 rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-1 text-sm" type="number" min="0" max="999" value={entry.qty} onChange={(event) => updateQty(entry.id, Number(event.target.value))} aria-label={`Quantity for ${entry.variantTitle}`} />
              </div>)}
              {!queue.length ? <Text size="small" className="text-ui-fg-subtle">Add products from the catalog.</Text> : null}
            </div>
            {queue.length ? <Button className="mt-3" size="small" variant="transparent" onClick={() => setQueue([])}>Clear list</Button> : null}
          </div>

          <div className="rounded-md border border-ui-border-base p-4">
            <Heading level="h2">Label setup</Heading>
            <div className="mt-3 grid gap-3">
              <label className="text-sm">Printer format<select className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={mode} onChange={(event) => setMode(event.target.value as "sheet" | "roll")}><option value="sheet">Avery sheet</option><option value="roll">Roll / single label</option></select></label>
              {mode === "sheet" ? <>
                <label className="text-sm">Sheet<select className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={sheetId} onChange={(event) => setSheetId(event.target.value)}>{SHEETS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                <label className="text-sm">Start position<input className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" type="number" min="1" max={sheet.cols * sheet.rows} value={startPosition} onChange={(event) => setStartPosition(Math.max(1, Number(event.target.value)))} /></label>
              </> : <>
                <label className="text-sm">Roll size<select className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={rollId} onChange={(event) => setRollId(event.target.value)}>{ROLLS.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                {rollId === "custom" ? <div className="grid grid-cols-2 gap-2"><label className="text-sm">Width (in)<input className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={customW} onChange={(event) => setCustomW(event.target.value)} /></label><label className="text-sm">Height (in)<input className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={customH} onChange={(event) => setCustomH(event.target.value)} /></label></div> : null}
              </>}
              <label className="text-sm">Optional message<input className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2" value={message} maxLength={80} onChange={(event) => setMessage(event.target.value)} placeholder="Rustic Halo" /></label>
              <label className="flex items-start gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3 text-sm">
                <input className="mt-0.5" type="checkbox" checked={invPrefix} onChange={(event) => setInvPrefix(event.target.checked)} aria-label="Prepend INV for AntiqueSoft" />
                <span><span className="block font-medium">AntiqueSoft barcode</span><span className="block text-xs text-ui-fg-subtle">Prepend INV to the printed and scanned value. Medusa data stays unchanged.</span></span>
              </label>
            </div>
          </div>

          <div className="rounded-md border border-ui-border-base bg-white p-3 text-black">
            <Text size="xsmall" className="mb-2 text-center text-gray-500">Label preview</Text>
            {preview ? <div className="flex min-h-28 flex-col items-center justify-center overflow-hidden border border-dashed border-gray-300 p-2 text-center">
              <div className="max-w-full truncate text-xs font-semibold">{preview.title}</div>
              {previewBarcode ? <img className="my-1 max-h-14 max-w-full" src={previewBarcode} alt="Barcode preview" /> : null}
              <div className="flex w-full justify-between gap-2 font-mono text-xs"><span>{preview.value}</span><strong>{preview.price ? `$${preview.price}` : ""}</strong></div>
              {message ? <div className="mt-1 max-w-full truncate text-xs font-semibold">{message}</div> : null}
            </div> : <div className="flex min-h-28 items-center justify-center text-sm text-gray-500">Add a product to preview.</div>}
          </div>
          <Button disabled={!labels.length} onClick={() => void print()}>Print {labels.length || ""} label{labels.length === 1 ? "" : "s"}</Button>
        </aside>
      </div>
    </Container>
  </div>
}

export const config = defineRouteConfig({ label: "Product labels", rank: 65 })
export default ProductLabelsPage
