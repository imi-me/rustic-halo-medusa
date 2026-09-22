const {test}=require('node:test'), assert=require('node:assert/strict')
const {selectProducts}=require('./prepare-online-drafts.cjs')
const product=()=>({id:'p',metadata:{imported_from:'shopify_catalog_snapshot'},status:'draft',thumbnail:'https://cdn.rustichalo.com/photo.png',sales_channels:[],variants:[{sku:'claw',manage_inventory:true,inventory_items:[{inventory_item_id:'i'}]}]})
const select=p=>selectProducts(p,{claw:{}},'online','profile')
test('includes eligible draft but excludes published, unmeasured and missing-photo products',()=>{
 const p=product(); assert.equal(select([p]).length,1)
 assert.equal(select([{...p,status:'published'},{...p,thumbnail:null},{...p,variants:[{...p.variants[0],sku:'coaster'}]}]).length,0)
})
test('rejects conflicting market channel and shipping profile',()=>{
 assert.throws(()=>select([{...product(),sales_channels:[{id:'market'}]}]),/channel/)
 assert.throws(()=>select([{...product(),shipping_profile:{id:'other'}}]),/profile/)
})
test('preserves inventory tracking and permits idempotent links',()=>{
 const p=product(); assert.throws(()=>select([{...p,variants:[{...p.variants[0],manage_inventory:false}]}]),/inventory/)
 assert.equal(select([{...p,sales_channels:[{id:'online'}],shipping_profile:{id:'profile'}}]).length,1)
})
