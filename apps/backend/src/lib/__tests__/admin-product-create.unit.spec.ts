const create = jest.fn(),
  stock = jest.fn()
jest.mock('@medusajs/medusa/core-flows', () => ({
  createProductsWorkflow: () => ({ run: create }),
  createInventoryLevelsWorkflow: () => ({ run: stock }),
}))
import { allocateBarcodes, createAdminProduct, creationSchema } from '../admin-product-create'
import { emptyEtsyDraft } from '../product-admin'
const input = () => ({
  inventory_mode: 'stocked' as const,
  request_id: 'fa742b60-d897-41b1-a39d-54e3b1018aaf',
  title: 'Fixture',
  description: 'Fixture',
  handle: 'fixture',
  type_id: null,
  collection_id: null,
  shipping_profile_id: 'sp_one',
  sales_channels: ['sc_one'],
  categories: [],
  tags: [],
  weight: 28,
  material: 'wood',
  images: [],
  thumbnail: null,
  options: [{ title: 'Style', values: ['Standard'] }],
  variants: [
    {
      title: 'Standard',
      sku: 'FIXTURE',
      barcode: '000123',
      price: 15,
      options: { Style: 'Standard' },
      stock: [{ location_id: 'sloc_one', quantity: 3 }],
    },
  ],
  etsy: emptyEtsyDraft(),
})
it('preserves direct barcode text and checks collisions including leading zeros', async () => {
  const products = { listProductVariants: jest.fn().mockResolvedValue([]) }
  expect(await allocateBarcodes(products, [{ barcode: '000123' }])).toEqual(['000123'])
  expect(products.listProductVariants).toHaveBeenCalledWith({ barcode: '000123' }, { take: 2 })
  products.listProductVariants.mockResolvedValue([{ id: 'variant_other' }])
  await expect(
    allocateBarcodes(products, [{ barcode: '000123', id: 'variant_one' }]),
  ).rejects.toThrow('already assigned')
})
it('allocates distinct internal scanner codes without pretending they are UPCs', async () => {
  const barcodes = await allocateBarcodes({ listProductVariants: async () => [] }, [
    { barcode: '' },
    { barcode: '' },
  ])
  expect(barcodes.every((barcode) => /^RH[0-9A-F]{16}$/.test(barcode))).toBe(true)
  expect(new Set(barcodes).size).toBe(2)
})
it('rejects duplicate manually entered barcodes inside one product', async () => {
  await expect(
    allocateBarcodes({ listProductVariants: async () => [] }, [
      { barcode: '001' },
      { barcode: '001' },
    ]),
  ).rejects.toThrow('already assigned')
})
it('rejects malformed creation data before any product or inventory writes', () => {
  expect(
    creationSchema.safeParse({ ...input(), variants: [{ ...input().variants[0], price: -1 }] })
      .success,
  ).toBe(false)
  expect(creationSchema.safeParse({ ...input(), publish: true }).success).toBe(false)
})
it('retries partial stock initialization without recreating a product or adding stock twice', async () => {
  let operation: any = null,
    product: any = null,
    level: any = null
  const ops = {
    listAdminOperations: async () => (operation ? [operation] : []),
    createAdminOperations: async (row: any) => (operation = { ...row, id: 'op_one' }),
    updateAdminOperations: async (row: any) => Object.assign(operation, row),
  }
  const products = {
    listProducts: async () => (product ? [product] : []),
    listProductVariants: async () => [],
  }
  const inventory = {
    listInventoryItems: async () => [{ id: 'iitem_one' }],
    listInventoryLevels: async () => (level ? [level] : []),
  }
  const scope = {
    resolve: (key: string) =>
      key === 'product'
        ? products
        : key === 'inventory'
          ? inventory
          : key === 'admin_operations'
            ? ops
            : { execute: async (_key: string, fn: any) => fn() },
  }
  create.mockImplementation(async (request: any) => {
    product = { id: 'prod_one', metadata: request.input.products[0].metadata }
    return { result: [product] }
  })
  stock
    .mockRejectedValueOnce(new Error('temporary stock failure'))
    .mockImplementationOnce(async () => {
      level = { stocked_quantity: 3 }
      return { result: [] }
    })
  await expect(createAdminProduct(scope, input())).rejects.toThrow('stock failure')
  expect(await createAdminProduct(scope, input())).toEqual({ id: 'prod_one' })
  expect(await createAdminProduct(scope, input())).toEqual({ id: 'prod_one' })
  expect(create).toHaveBeenCalledTimes(1)
  expect(stock).toHaveBeenCalledTimes(2)
  expect(create.mock.calls[0][0].input.products[0]).toMatchObject({
    status: 'draft',
    variants: [{ barcode: '000123', manage_inventory: true, allow_backorder: false }],
  })
  await expect(createAdminProduct(scope, { ...input(), title: 'Changed request' })).rejects.toThrow(
    'creation request changed',
  )
})

it('reserves entered barcodes from unconfirmed creations', async () => {
  await expect(allocateBarcodes({ listProductVariants: async () => [] }, [{ barcode: '00123' }], ['00123'])).rejects.toThrow('already assigned')
})

it('accepts optional search overrides without changing legacy creation payloads', () => {
  const legacy = creationSchema.parse(input())
  expect(Object.prototype.hasOwnProperty.call(legacy, 'seo')).toBe(false)
  expect(creationSchema.parse({ ...input(), seo: { title: 'Specific title', description: 'A useful summary.' } }).seo).toEqual({ title: 'Specific title', description: 'A useful summary.' })
  expect(creationSchema.safeParse({ ...input(), seo: { title: 'x'.repeat(101), description: '' } }).success).toBe(false)
})
it('requires hair-claw color to be an order choice before allocating identifiers or stock',async()=>{
 const products={retrieveProductType:async()=>({value:'Hair Claw'})},ops={listAdminOperations:jest.fn()}
 const scope={resolve:(name:string)=>name==='product'?products:name==='admin_operations'?ops:{execute:async(_key,fn)=>fn()}}
 const data:any={...input(),type_id:'ptyp_claw',options:[{title:'Base color',values:['Black']}],variants:[{...input().variants[0],options:{'Base color':'Black'}}]}
 await expect(createAdminProduct(scope,data)).rejects.toThrow('Color is recorded on orders')
 expect(ops.listAdminOperations).not.toHaveBeenCalled()
 data.options=[{title:'Finish',values:['Natural']}];data.variants[0].options={Finish:'Natural'}
 await expect(createAdminProduct(scope,data)).rejects.toThrow('actual physical size')
 expect(ops.listAdminOperations).not.toHaveBeenCalled()
})

it('creates only the chosen size/finish identities and carries order colors into Etsy preparation', async () => {
 const { sellableColorVariants, colorExport } = require('../product-admin')
 const { planColorSharing } = require('../etsy/color-sharing')
 let operation: any, product: any
 const ops = { listAdminOperations: async (filter: any) => operation && Object.entries(filter).every(([key,value]) => operation[key] === value) ? [operation] : [], createAdminOperations: async data => operation = { ...data, id: 'op_new' }, updateAdminOperations: async data => Object.assign(operation,data) }
 const products = { retrieveProductType: async () => ({ value: 'Hair Claw' }), listProducts: async () => product ? [product] : [], listProductVariants: async () => [], retrieveProduct: async () => product, updateProducts: async (_id,data) => { product.metadata = data.metadata } }
 const scope = { resolve: key => key === 'product' ? products : key === 'inventory' ? { listInventoryItems: async () => [{id:'item'}] } : key === 'admin_operations' ? ops : { execute: async (_key,fn) => fn() } }
 create.mockClear()
 create.mockImplementation(async ({input}) => {
  const row = input.products[0]
  const options = row.options.map((o,index) => ({ ...o, id: 'option_'+index, values: o.values.map(value => ({value})) }))
  product = { ...row, id:'prod_new', options, variants: row.variants.map((v,index) => ({...v,id:'variant_'+index,options:options.map(o=>({option_id:o.id,value:v.options[o.title]}))})) }
  return {result:[product]}
 })
 const data = {...input(), type_id:'ptyp_claw',title:'New Hair Claw', inventory_mode:'made_to_order' as const, options:[{title:'Size',values:['2 inch','4 inch']},{title:'Finish',values:['Natural','Colors by Cate']}], variants:[
  {...input().variants[0],sku:'CLAW-2',barcode:'000123',options:{Size:'2 inch',Finish:'Natural'},price:8,stock:[]},
  {...input().variants[0],sku:'CLAW-4-CATE',barcode:'000124',options:{Size:'4 inch',Finish:'Colors by Cate'},price:16,stock:[]},
 ]}
 await createAdminProduct(scope,data)
 expect(product.variants.map(v=>[v.sku,v.barcode])).toEqual([['CLAW-2','000123'],['CLAW-4-CATE','000124']])
 expect(product.metadata.hair_claw_template_v2).toMatchObject({color_mode:'order',variant_ids:['variant_0','variant_1']})
 const choices = sellableColorVariants(product).filter(v=>['Black','Rose'].includes(v.metadata.base_claw_color))
 const selection = colorExport(product,{...emptyEtsyDraft(),listing_id:'123',colors:choices.map(v=>({variant_id:v.id,quantity:5,image_url:''}))})
 expect(selection.order_options).toMatchObject({offer_name:'Size / Finish',color_changes_sku:false})
 expect(selection.order_options.offers).toHaveLength(2)
 const inventory = {products:selection.order_options.offers.map(o=>({sku:o.sku,property_values:[{property_id:513,property_name:'Size / Finish',values:[o.value],value_ids:[]}],offerings:[{price:{amount:o.sku==='CLAW-2'?800:1600,divisor:100,currency_code:'USD'},quantity:5,is_enabled:true,readiness_state_id:42}]})),sku_on_property:[513],price_on_property:[513],quantity_on_property:[513]}
 const plan = planColorSharing(inventory,selection,'')
 expect(plan.body.products).toHaveLength(4)
 expect(new Set(plan.body.products.map(p=>p.sku))).toEqual(new Set(['CLAW-2','CLAW-4-CATE']))
 expect(plan.body.sku_on_property).toEqual([513])
 expect(plan.body.products.every(p=>p.property_values.some(v=>v.property_name==='Color'))).toBe(true)
 await createAdminProduct(scope,data)
 expect(create).toHaveBeenCalledTimes(1)
 expect(product.variants).toHaveLength(2)
})
