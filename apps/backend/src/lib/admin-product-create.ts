import { clawSize } from './hair-claw-colors'
import { newProductIsHairClaw, validateNewClawOffers } from './new-hair-claw'
import { planClawOrderChoices } from './hair-claw-order-choices'
import { PRODUCT_SEO_KEY } from './product-seo-values'
import { productSeoSchema } from './product-seo'
import { assignmentSchema, SHIPPING_KEY } from './shipping-packages'
import { readPackageConfig } from './shipping-package-store'
import { validateAssignments } from './shipping-assignment'
import { cleanDescription, richDescription } from './product-description'
import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { Modules } from '@medusajs/framework/utils'
import { createProductsWorkflow, createInventoryLevelsWorkflow } from '@medusajs/medusa/core-flows'
import { ADMIN_OPERATIONS } from '../modules/admin-operations'
import { etsyDraftSchema, ETSY_DRAFT_KEY } from './product-admin'

const identifier = z.string().regex(/^[a-z]+_[A-Za-z0-9]+$/)
export const creationSchema = z
  .object({
    shipping: assignmentSchema.optional(),
    inventory_mode: z.enum(['stocked', 'made_to_order']).default('stocked'),
    request_id: z.string().uuid(),
    title: z.string().trim().min(1).max(250),
    description: z.string().max(10000),
    handle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type_id: identifier.nullable(),
    collection_id: identifier.nullable(),
    shipping_profile_id: identifier,
    sales_channels: z.array(identifier).max(50),
    categories: z.array(identifier).max(50),
    tags: z.array(identifier).max(100),
    weight: z.number().nonnegative().nullable(),
    material: z.string().max(200),
    images: z.array(z.object({ url: z.string().url().max(2000) }).strict()).max(30),
    thumbnail: z.string().url().nullable(),
    options: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(100),
            values: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    variants: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(250),
            sku: z.string().trim().min(1).max(100),
            barcode: z.string().trim().max(100),
            shipping: assignmentSchema.optional(),
            weight: z.number().positive().nullable().optional(),
            price: z.number().finite().nonnegative().max(1000000),
            options: z.record(z.string(), z.string()),
            stock: z
              .array(
                z
                  .object({
                    location_id: identifier,
                    quantity: z.number().int().min(0).max(1000000),
                  })
                  .strict(),
              )
              .max(50),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    etsy: etsyDraftSchema,
    seo: productSeoSchema.optional(),
  })
  .strict()
export async function pendingBarcodes(scope: any, excludeKey?: string): Promise<string[]> {
  const operations = await scope.resolve(ADMIN_OPERATIONS).listAdminOperations(
    { kind: 'product-create', status: 'prepared' },
    { take: 1001 },
  )
  if (operations.length > 1000) throw new Error('Review unconfirmed product creations before assigning more barcodes.')
  return operations.filter((row: any) => row.operation_key !== excludeKey).flatMap((row: any) => row.payload.barcodes ?? [])
}
export async function allocateBarcodes(
  products: any,
  variants: Array<{ barcode: string; id?: string }>,
  reserved: string[] = [],
) {
  const seen = new Set<string>(reserved)
  const result: string[] = []
  for (const row of variants) {
    let barcode = row.barcode.trim()
    for (let attempt = 0; !barcode && attempt < 5; attempt++) {
      const candidate = `RH${randomBytes(8).toString('hex').toUpperCase()}`
      if (
        !(await products.listProductVariants({ barcode: candidate }, { take: 1 })).length &&
        !seen.has(candidate)
      )
        barcode = candidate
    }
    if (!barcode) throw new Error('Could not allocate a barcode. Try again.')
    const matches = await products.listProductVariants({ barcode }, { take: 2 })
    if (seen.has(barcode) || matches.some((match: any) => match.id !== row.id))
      throw new Error('Barcode is already assigned to another variant.')
    seen.add(barcode)
    result.push(barcode)
  }
  return result
}
export async function createAdminProduct(scope: any, input: z.infer<typeof creationSchema>) {
  const products = scope.resolve(Modules.PRODUCT),
    inventory = scope.resolve(Modules.INVENTORY),
    ops = scope.resolve(ADMIN_OPERATIONS)
  return scope.resolve(Modules.LOCKING).execute(
    'rh-admin-product-identifiers',
    async () => {
      const type = input.type_id ? await products.retrieveProductType(input.type_id) : null
      const hairClaw = newProductIsHairClaw(type, input.title)
      if (hairClaw) validateNewClawOffers(input)
      const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
      const key = `product-create:${input.request_id}`
      let [operation] = await ops.listAdminOperations({ operation_key: key })
      if (operation && operation.payload.hash !== hash)
        throw new Error(
          'This creation request changed. Reopen the saved product before editing it.',
        )
      if (operation?.status === 'complete') return { id: operation.resource_id }
      if (new Set(input.variants.map((row) => row.sku)).size !== input.variants.length)
        throw new Error('Every variant needs a unique SKU.')
      const names = input.options.map((option) => option.title)
      if (
        new Set(names).size !== names.length ||
        input.options.some((option) => new Set(option.values).size !== option.values.length)
      )
        throw new Error('Option names and values must be unique.')
      const combinations = input.variants.map((row) => {
        if (
          Object.keys(row.options).length !== names.length ||
          input.options.some((option) => !option.values.includes(row.options[option.title]))
        )
          throw new Error('Each variant must match the selected options.')
        if (new Set(row.stock.map((level) => level.location_id)).size !== row.stock.length)
          throw new Error('Each stock location can be entered once.')
        return JSON.stringify(names.map((name) => row.options[name]))
      })
      if (new Set(combinations).size !== combinations.length)
        throw new Error('Duplicate variant combination.')
      let product = (
        await products.listProducts({ handle: input.handle }, { relations: ['variants'] })
      )[0]
      if (product && product.metadata?.admin_creation_key !== key)
        throw new Error('That product handle is already in use.')
      if (!operation && (input.shipping || input.variants.some(variant => variant.shipping))) validateAssignments(await readPackageConfig(ops), { weight: input.weight, metadata: { [SHIPPING_KEY]: input.shipping } }, input.variants.map(variant => ({ weight: variant.weight, metadata: { [SHIPPING_KEY]: variant.shipping ?? {} } })))
      if (!operation) {
        if (
          (
            await products.listProductVariants(
              { sku: input.variants.map((row) => row.sku) },
              { take: 1 },
            )
          ).length
        )
          throw new Error('A SKU is already in use.')
      const barcodes = await allocateBarcodes(products, input.variants, await pendingBarcodes(scope, key))
        operation = await ops.createAdminOperations({
          operation_key: key,
          kind: 'product-create',
          resource_id: '',
          status: 'prepared',
          payload: { hash, barcodes },
        })
      }
      if (!product) {
      // Revalidate persisted allocations before a retry: another creation path
      // may have used an entered barcode while the first request was incomplete.
      await allocateBarcodes(products, operation.payload.barcodes.map((barcode: string) => ({ barcode })), await pendingBarcodes(scope, key))
        const { result } = await createProductsWorkflow(scope).run({
          input: {
            products: [
              {
                title: input.title,
                description: richDescription(input.description) ? cleanDescription(input.description) : input.description,
                handle: input.handle,
                status: 'draft',
                type_id: input.type_id,
                collection_id: input.collection_id,
                shipping_profile_id: input.shipping_profile_id,
                weight: input.weight,
                material: input.material || null,
                discountable: true,
                thumbnail: input.thumbnail,
                images: input.images,
                options: input.options,
                category_ids: input.categories,
                tag_ids: input.tags,
                sales_channels: input.sales_channels.map((id) => ({ id })),
                metadata: { ...(hairClaw ? {color_mode:'order',source_product_type:'Hair Claw'} : {}), admin_creation_key: key, [ETSY_DRAFT_KEY]: input.etsy, ...(input.seo ? { [PRODUCT_SEO_KEY]: input.seo } : {}), ...(input.shipping ? { [SHIPPING_KEY]: input.shipping } : {}) },
                variants: input.variants.map((variant, index) => ({
                  title: variant.title,
                  ...(variant.weight ? { weight: variant.weight } : {}),
                  sku: variant.sku,
                  barcode: operation.payload.barcodes[index],
                  options: variant.options,
                  prices: [{ currency_code: 'usd', amount: variant.price }],
                  manage_inventory: true,
                  allow_backorder: input.inventory_mode === 'made_to_order',
                  metadata: {
                    ...(variant.shipping ? { [SHIPPING_KEY]: variant.shipping } : {}),
                    inventory_mode: input.inventory_mode,
                    ...(hairClaw
                      ? {
                          color_mode: 'order',
                          physical_size: clawSize(Object.entries(variant.options).find(([key]) => /size/i.test(key))?.[1]),
                          claw_finish: (() => { const finish = Object.entries(variant.options).find(([key]) => /finish/i.test(key))?.[1]; return finish === 'Colors by Cate' ? 'cbc' : !finish || finish === 'Natural' ? 'natural' : finish })(),
                        }
                      : {}),
                  },
                })),
              },
            ],
          },
        })
        product = result[0]
      }
      // A stock retry finds the existing item/level and never adds quantities twice.
      for (const variant of input.variants) {
        const [item] = await inventory.listInventoryItems({ sku: variant.sku }, { take: 2 })
        if (!item)
          throw new Error(
            `Product created; stock for ${variant.sku} needs reconciliation. Retry this unchanged request.`,
          )
        for (const level of variant.stock) {
          const existing = await inventory.listInventoryLevels({
            inventory_item_id: item.id,
            location_id: level.location_id,
          })
          if (!existing.length)
            await createInventoryLevelsWorkflow(scope).run({
              input: {
                inventory_levels: [
                  {
                    inventory_item_id: item.id,
                    location_id: level.location_id,
                    stocked_quantity: level.quantity,
                  },
                ],
              },
            })
          else if (Number(existing[0].stocked_quantity) !== level.quantity)
            throw new Error(
              'Product created but stock changed. Open the product to review quantities.',
            )
        }
      }
      if (hairClaw) {
        const fresh = await products.retrieveProduct(product.id,{relations:['options','options.values','variants','variants.options']})
        const plan = planClawOrderChoices(fresh)
        if (!plan.current) await products.updateProducts(product.id,{metadata:plan.metadata})
      }
      await ops.updateAdminOperations({
        id: operation.id,
        status: 'complete',
        resource_id: product.id,
      })
      return { id: product.id }
    },
    { timeout: 5, expire: 300 },
  )
}
