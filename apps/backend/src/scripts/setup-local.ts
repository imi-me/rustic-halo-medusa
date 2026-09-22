import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStoresWorkflow,
  updateStoresWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

// A minimal empty store for this Mac. Never imports products or business records.
export default async function setupLocal({ container }: ExecArgs) {
  const url = new URL(process.env.DATABASE_URL || "")
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/rustic_halo_local" ||
    url.username !== "rustic_halo_local"
  ) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Local setup requires the dedicated loopback development database.")
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sales = container.resolve(Modules.SALES_CHANNEL)
  let [channel] = await sales.listSalesChannels({ name: "Local Development" })
  if (!channel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Local Development" }] },
    })
    channel = result[0]
  }

  const stores = container.resolve(Modules.STORE)
  const existingStores = await stores.listStores()
  if (!existingStores.length) {
    await createStoresWorkflow(container).run({
      input: { stores: [{
        name: "Rustic Halo — Local Development",
        supported_currencies: [{ currency_code: "usd", is_default: true }],
        default_sales_channel_id: channel.id,
      }] },
    })
  } else if (existingStores[0].name !== "Rustic Halo — Local Development") {
    const [, productCount] = await container.resolve(Modules.PRODUCT).listAndCountProducts()
    const [, orderCount] = await container.resolve(Modules.ORDER).listAndCountOrders()
    const [, customerCount] = await container.resolve(Modules.CUSTOMER).listAndCountCustomers()
    const [, regionCount] = await container.resolve(Modules.REGION).listAndCountRegions()
    if (existingStores.length !== 1 || existingStores[0].name !== "Medusa Store" ||
      productCount || orderCount || customerCount || regionCount) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Existing store data found; refusing to change its configuration.")
    }
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: existingStores[0].id },
        update: {
          name: "Rustic Halo — Local Development",
          supported_currencies: [{ currency_code: "usd", is_default: true }],
          default_sales_channel_id: channel.id,
        },
      },
    })
  }

  const regions = container.resolve(Modules.REGION)
  if (!(await regions.listRegions()).length) {
    await createRegionsWorkflow(container).run({
      input: { regions: [{
        name: "United States — Local Test",
        currency_code: "usd",
        countries: ["us"],
        automatic_taxes: false,
        payment_providers: ["pp_system_default"],
      }] },
    })
  }

  const keys = container.resolve(Modules.API_KEY)
  let [key] = await keys.listApiKeys({ title: "Local Storefront", type: "publishable" })
  if (!key) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Local Storefront", type: "publishable", created_by: "" }] },
    })
    key = result[0]
  }
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: key.id, add: [channel.id] },
  })

  const envPath = resolve(process.cwd(), "../storefront/.env.local")
  const env = readFileSync(envPath, "utf8")
  if (/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=\s*$/m.test(env)) {
    writeFileSync(envPath, env.replace(/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=[^\r\n]*/m,
      `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key.token}`), { mode: 0o600 })
  } else {
    logger.info("Existing storefront publishable key preserved.")
  }
  logger.info("Empty local store ready. No products, inventory, customers, or orders were imported.")
}
