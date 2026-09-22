import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

export default async function setupStripeTest({ container }: ExecArgs) {
  const url = new URL(process.env.DATABASE_URL || "")
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/rustic_halo_local" || url.username !== "rustic_halo_local") throw new Error("Requires isolated local database")
  if (process.env.STRIPE_TEST_ENABLED !== "true" || !process.env.STRIPE_API_KEY?.startsWith("sk_test_")) throw new Error("Configure Stripe test credentials first")
  const regions = await container.resolve(Modules.REGION).listRegions({ name: "United States — Local Test" })
  if (regions.length !== 1) throw new Error("Expected exactly one local test region")
  const providers = await container.resolve(Modules.PAYMENT).listPaymentProviders({ id: "pp_stripe_stripe", is_enabled: true })
  if (!providers.length) throw new Error("Stripe provider is not available; check configuration")
  await updateRegionsWorkflow(container).run({ input: { selector: { id: regions[0].id }, update: { payment_providers: ["pp_stripe_stripe"] } } })
  console.log("Local test region uses Stripe test payments. Manual checkout removed from this region.")
}
