const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module')
const {patchTaxSource}=require('./round-production-nc-tax.cjs')
const root=path.resolve(__dirname,'../../node_modules/.pnpm')
const version=fs.readdirSync(root).find(n=>n.startsWith('@medusajs+utils@2.21.0_'))
const file=path.join(root,version,'node_modules/@medusajs/utils/dist/totals/tax/index.js')
const source=fs.readFileSync(file,'utf8')
function calculate(env,code='NC-SALES-TAX'){
 const exports={};vm.runInNewContext(patchTaxSource(source),{exports,require:createRequire(file),process:{env}})
 return amount=>exports.calculateTaxTotal({taxLines:[{rate:7.25,code}],taxableAmount:amount}).toNumber()
}
test('goods and shipping round individually before summation',()=>{
 const tax=calculate({APP_ENV:'production',STRIPE_TAX_LIVE_ENABLED:'true'})
 assert.equal(tax(14),1.02);assert.equal(tax(5.20),.38)
 assert.equal(tax(14)+tax(5.20),1.4)
 assert.equal(tax(50.4),3.65)
})
test('staging, disabled tax and other providers retain their behavior',()=>{
 for(const tax of [calculate({APP_ENV:'staging',STRIPE_TAX_LIVE_ENABLED:'true'}),calculate({APP_ENV:'production',STRIPE_TAX_LIVE_ENABLED:'false'}),calculate({APP_ENV:'production',STRIPE_TAX_LIVE_ENABLED:'true'},'OTHER')])assert.equal(tax(14),1.015)
})
test('actual Medusa item and shipping totals agree after a real discount',()=>{
 const env={APP_ENV:'production',STRIPE_TAX_LIVE_ENABLED:'true'},tax={}
 vm.runInNewContext(patchTaxSource(source),{exports:tax,require:createRequire(file),process:{env}})
 function totals(name){
  const target=path.resolve(path.dirname(file),'../'+name+'/index.js'),exports={}
  const realRequire=createRequire(target)
  vm.runInNewContext(fs.readFileSync(target,'utf8'),{exports,require:id=>id==='../tax'?tax:realRequire(id)})
  return exports
 }
 const lines=[{rate:7.25,code:'NC-SALES-TAX'}]
 const item=totals('line-item').getLineItemTotals({unit_price:14,quantity:4,tax_lines:lines,adjustments:[{amount:5.6}]},{})
 const shipping=totals('shipping-method').getShippingMethodTotals({amount:5.2,tax_lines:lines},{})
 assert.equal(Number(item.tax_total),3.65)
 assert.equal(Number(item.total),54.05)
 assert.equal(Number(shipping.tax_total),.38)
 assert.equal(Number(shipping.total),5.58)
})
test('patch is idempotent and refuses an unexpected implementation',()=>{
 assert.equal(patchTaxSource(patchTaxSource(source)),patchTaxSource(source))
 assert.throws(()=>patchTaxSource('changed framework source'))
})
