import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import snapshot from "./data/rustic-halo-pilot.json"

// Explicit owner policy: online products are made to order, shipping in 3–5 business days.
export default async function enableMadeToOrder({ container }: ExecArgs) {
  const url = new URL(process.env.DATABASE_URL || "")
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/rustic_halo_local" || url.username !== "rustic_halo_local") throw new Error("Requires isolated local database")
  const service = container.resolve(Modules.PRODUCT)
  for (const source of snapshot.products) {
    const [product] = await service.listProducts({ handle: source.handle })
    if (!product || product.metadata?.shopify_id !== source.id) throw new Error(`Pilot product mismatch: ${source.handle}`)
    const variants = await service.listProductVariants({ product_id: product.id })
    await updateProductVariantsWorkflow(container).run({ input: { product_variants: variants.map(v => ({ id: v.id, allow_backorder: true })) } })
  }
  console.log("Made-to-order purchasing enabled for imported online products; stock quantities preserved.")
}
