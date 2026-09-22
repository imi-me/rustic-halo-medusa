import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import snapshot from "./data/rustic-halo-pilot.json"

export default async function setupShippoShipping({ container }: ExecArgs) {
  const url = new URL(process.env.DATABASE_URL || "")
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/rustic_halo_local" || url.username !== "rustic_halo_local") throw new Error("Requires isolated local database")
  if (process.env.STRIPE_TEST_ENABLED !== "true" || !process.env.STRIPE_API_KEY?.startsWith("sk_test_")) throw new Error("Requires Stripe test mode")
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id", "name", "fulfillment_sets.id", "fulfillment_providers.id"], filters: { name: "Shopify On-line Store — Local Snapshot" } })
  if (locations.length !== 1) throw new Error("Expected the imported online stock location")
  const location = locations[0]
  const providers = await fulfillment.listFulfillmentProviders({ id: "shippo-test_shippo" })
  if (!providers.length) throw new Error("Shippo test provider unavailable")
  let [profile] = await fulfillment.listShippingProfiles({ name: "Local test products" })
  if (!profile) profile = await fulfillment.createShippingProfiles({ name: "Local test products", type: "default" })
  let [set] = await fulfillment.listFulfillmentSets({ name: "Local checkout test shipping" }, { relations: ["service_zones"] })
  if (!set) set = await fulfillment.createFulfillmentSets({ name: "Local checkout test shipping", type: "shipping", service_zones: [{ name: "United States — test only", geo_zones: [{ type: "country", country_code: "us" }] }] })
  if (!location.fulfillment_sets?.some(s => s?.id === set.id)) await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_set_id: set.id } })
  if (!location.fulfillment_providers?.some(p => p?.id === "shippo-test_shippo")) await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_provider_id: "shippo-test_shippo" } })
  const { data: products } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata", "shipping_profile.id"], filters: { handle: snapshot.products.map(p => p.handle) } })
  for (const product of products) {
    if (product.metadata?.shopify_id !== snapshot.products.find(p => p.handle === product.handle)?.id) throw new Error("Product source mismatch")
    if (product.shipping_profile && product.shipping_profile.id !== profile.id) throw new Error("Preserving existing shipping profile; review required")
    if (!product.shipping_profile) await link.create({ [Modules.PRODUCT]: { product_id: product.id }, [Modules.FULFILLMENT]: { shipping_profile_id: profile.id } })
  }
  const name = "USPS Ground Advantage — TEST"
  if (!(await fulfillment.listShippingOptions({ name })).length) await createShippingOptionsWorkflow(container).run({ input: [{
    name, price_type: "calculated", provider_id: "shippo-test_shippo", service_zone_id: set.service_zones[0].id, shipping_profile_id: profile.id,
    type: { label: "Test shipping", description: "Local checkout testing only. Actual postage is not configured. Made to order; ships in 3–5 business days.", code: "local-test" },
    data: { id: "usps_ground_advantage" },
    rules: [{ attribute: "enabled_in_store", value: "true", operator: "eq" }, { attribute: "is_return", value: "false", operator: "eq" }],
  }] })
  const placeholders = await fulfillment.listShippingOptions({ name: "TEST ONLY — Shipping placeholder" }, { relations: ["rules"] })
  for (const option of placeholders) {
    for (const rule of option.rules || []) {
      if (rule.attribute === "enabled_in_store") await fulfillment.updateShippingOptionRules({ id: rule.id, attribute: rule.attribute, operator: "eq", value: "false" })
    }
  }
  console.log("Shippo calculated test option ready. No labels purchased.")
}
