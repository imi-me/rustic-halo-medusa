import { inventoryBody, planColorSharing } from '../color-sharing'
const property = (id: number, name: string, value: string) => ({
  property_id: id,
  property_name: name,
  value_ids: [id * 10],
  values: [value],
})
const inventory = () => ({
  products: [
    {
      sku: 'OLD-BLACK',
      property_values: [property(513, 'Size', '4”'), property(514, 'Color', 'Black')],
      offerings: [
        {
          quantity: 9,
          is_enabled: true,
          price: { amount: 1500, divisor: 100, currency_code: 'USD' },
          readiness_state_id: 123,
        },
      ],
    },
  ],
  price_on_property: [513],
  quantity_on_property: [513],
  sku_on_property: [513, 514],
})
const selection = (): any => ({
  product_id: 'prod_one',
  listing_id: '123',
  variants: [
    {
      sku: 'NEW-ROSE',
      color: 'Rose',
      options: { Size: '4 inch', Color: 'Rose', 'Claw finish': 'Natural' },
      price: 16,
      quantity: 4,
      image_url: '',
      inventory_mode: 'made_to_order_color_option',
    },
  ],
})
it('adds a third Finish property using the documented custom ID and preserves old offerings', () => {
  const source = inventory(),
    before = JSON.stringify(source)
  const plan = planColorSharing(source, selection(), 'Natural')
  expect(JSON.stringify(source)).toBe(before)
  expect(plan.body.products).toHaveLength(2)
  expect(plan.body.products[0].offerings[0]).toMatchObject({
    price: 15,
    quantity: 9,
    readiness_state_id: 123,
  })
  expect(plan.body.products[0].property_values[2]).toMatchObject({
    property_id: 516,
    values: ['Natural'],
  })
  expect(plan.body.products[1].property_values[0].values).toEqual(['4”'])
  expect(plan.body.quantity_on_property).toEqual([513, 514, 516])
})
it('requires explicit interpretation of existing finish before extending the listing', () => {
  expect(() => planColorSharing(inventory(), selection(), '')).toThrow('Specify the finish')
})
it('refuses pooled/stocked inventory and duplicate Etsy SKUs', () => {
  const input = selection()
  input.variants[0].inventory_mode = 'stocked'
  expect(() => planColorSharing(inventory(), input, 'Natural')).toThrow('channel stock allocation')
  const source = inventory()
  source.products.push(source.products[0])
  expect(() => planColorSharing(source, selection(), 'Natural')).toThrow('unique SKUs')
})
it('refuses an option combination already mapped to a different SKU', () => {
  const input = selection()
  input.variants[0].color = 'Black'
  input.variants[0].options.Color = 'Black'
  expect(() => planColorSharing(inventory(), input, 'Natural')).toThrow('different Etsy SKU')
})
it('updates only selected existing offerings and disables a zero allocation', () => {
  const input = selection()
  input.variants[0].sku = 'OLD-BLACK'
  input.variants[0].options.Color = 'Black'
  input.variants[0].quantity = 0
  const plan = planColorSharing(inventory(), input, 'Natural')
  expect(plan.body.products).toHaveLength(1)
  expect(plan.body.products[0].offerings[0]).toMatchObject({
    quantity: 0,
    is_enabled: false,
    price: 16,
  })
})
it('rejects unsupported currency instead of interpreting another currency as USD', () => {
  const source = inventory()
  source.products[0].offerings[0].price.currency_code = 'EUR'
  expect(() => inventoryBody(source)).toThrow('USD')
})

it('links a new Medusa SKU to the existing Etsy option without renaming its historical SKU', () => {
  const data = selection(); data.variants[0].options.Color = 'Black'; data.variants[0].color = 'Black'; data.variants[0].etsy_sku = 'OLD-BLACK'
  const plan = planColorSharing(inventory(), data, 'Natural')
  expect(plan.body.products).toHaveLength(1)
  expect(plan.body.products[0].sku).toBe('OLD-BLACK')
  expect(plan.changes[0].medusa_sku).toBe('NEW-ROSE')
})
it('shares colors under one original SKU with no color-dependent price, quantity or SKU',()=>{
 const source=inventory()
 source.products.push({...source.products[0],sku:'OLD-ROSE',property_values:[property(513,'Size','4”'),property(514,'Color','Rose')]})
 const input=selection();input.variants=['Black','Rose'].map(color=>({...input.variants[0],sku:'HC38737',etsy_sku:'HC38737',color_mode:'order',color,options:{Size:'4 inch',Color:color},price:15,quantity:9}))
 const result=planColorSharing(source,input,'')
 expect(result.body.products.map(p=>p.sku)).toEqual(['HC38737','HC38737'])
 expect(result.body.sku_on_property).toEqual([513]);expect(result.body.price_on_property).toEqual([513]);expect(result.body.quantity_on_property).toEqual([513])
 input.variants[1].quantity=2
 expect(()=>planColorSharing(source,input,'')).toThrow('share the original SKU, price and Etsy allocation')
})
it('requires review of conflicting unselected Etsy color stock instead of copying pooled inventory',()=>{
 const source=inventory(); source.products.push({...source.products[0],sku:'OLD-ROSE',property_values:[property(513,'Size','4”'),property(514,'Color','Rose')]})
 const input=selection(); input.variants[0]={...input.variants[0],color_mode:'order',sku:'HC38737',options:{Size:'4 inch',Color:'Black'}}
 expect(()=>planColorSharing(source,input,'')).toThrow('different prices or allocations')
})
it('keeps the reviewed original Etsy size SKU when the imported Medusa identity differs', () => {
 const input = selection()
 input.variants[0] = { ...input.variants[0], color_mode: 'order', sku: 'ORIGINAL-CREAM', etsy_sku: 'ORIGINAL', color: 'Black', options: { Size: '4 inch', Color: 'Black' }, price: 15, quantity: 9 }
 const result = planColorSharing(inventory(), input, '')
 expect(result.body.products[0].sku).toBe('ORIGINAL')
 expect(result.changes[0].medusa_sku).toBe('ORIGINAL-CREAM')
})
it('prepares a color choice for a new Etsy listing without new SKUs or changing other identities', () => {
 const source=inventory();source.products[0].sku='ORIGINAL';source.products[0].property_values=source.products[0].property_values.filter(p=>p.property_name!=='Color');source.sku_on_property=[513]
 const input=selection();input.variants=['Black','Rose'].map(color=>({...input.variants[0],sku:'ORIGINAL',etsy_sku:'ORIGINAL',color_mode:'order',color,options:{Size:'4 inch',Color:color},price:15,quantity:9}))
 const before=JSON.stringify(source),plan=planColorSharing(source,input,'')
 expect(JSON.stringify(source)).toBe(before)
 expect(plan.body.products.map(p=>p.sku)).toEqual(['ORIGINAL','ORIGINAL'])
 expect(plan.body.sku_on_property).toEqual([513])
 expect(plan.body.products[0].property_values.find(p=>p.property_name==='Color').property_id).toBe(514)
 input.variants[0].sku='DIFFERENT';input.variants[0].etsy_sku='DIFFERENT';input.variants[1].sku='DIFFERENT';input.variants[1].etsy_sku='DIFFERENT'
 expect(()=>planColorSharing(source,input,'')).toThrow('Map every original')
})
it('uses the documented third custom slot with one dependency and blocks two-property SKU dependencies', () => {
 const source=inventory();source.products[0].property_values=[property(513,'Size','4 inch'),property(514,'Finish','Natural')]
 const input=selection();input.variants[0]={...input.variants[0],sku:'OLD-BLACK',color_mode:'order',color:'Rose',price:15,quantity:9,options:{Size:'4 inch',Finish:'Natural',Color:'Rose'}}
 const plan=planColorSharing(source,input,'')
 expect(plan.body.products[0].property_values.find(p=>p.property_name==='Color').property_id).toBe(516)
 expect(plan.body.sku_on_property.length).toBeLessThanOrEqual(1)
 const full:any={products:[],sku_on_property:[513,514],price_on_property:[513,514],quantity_on_property:[513,514]};input.variants=[]
 for(const size of ['2 inch','4 inch'])for(const finish of ['Natural','Colors by Cate']){const sku=size+finish;full.products.push({...source.products[0],sku,property_values:[property(513,'Size',size),property(514,'Finish',finish)]});for(const color of ['Black','Rose'])input.variants.push({...selection().variants[0],sku,color_mode:'order',color,price:15,quantity:9,options:{Size:size,Finish:finish,Color:color}})}
 expect(()=>planColorSharing(full,input,'')).toThrow('Size / Finish')
})
