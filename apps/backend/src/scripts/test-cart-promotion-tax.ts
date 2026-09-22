import type { ExecArgs } from '@medusajs/framework/types'
import { PromotionActions } from '@medusajs/framework/utils'
import { createPromotionsWorkflow, updateCartPromotionsWorkflow } from '@medusajs/medusa/core-flows'
import { assertShippingTestEnvironment } from '../lib/shipping-test-environment'
import { compareCartTax, type TaxCart } from '../lib/tax/cart-calculation'

/** Explicit unpaid sandbox carts only. Deactivates each temporary promotion. */
export default async function testCartPromotionTax({container,args}: ExecArgs) {
 assertShippingTestEnvironment(process.env)
 const key = process.env.STRIPE_API_KEY || ''
 if (!key.startsWith('sk_test_') || args.length !== 1 || !/^cart_[A-Za-z0-9]+$/.test(args[0])) throw Error('Provide one unpaid sandbox cart ID and test key')
 const query=container.resolve('query')
 const promotions=container.resolve('promotion')
 const fields=['id','email','completed_at','payment_collection.id','promotions.code','currency_code','total','tax_total','discount_total','shipping_total','shipping_tax_total','shipping_address.*','items.id','items.total','items.tax_total','items.is_giftcard','items.is_tax_inclusive','shipping_methods.is_tax_inclusive']
 const read=async()=> (await query.graph({entity:'cart',filters:{id:args[0]},fields})).data[0]
 const initial=await read()
 if (!initial || initial.email!=='staging-tax@example.com' || initial.completed_at || initial.payment_collection?.id || initial.promotions?.length) throw Error('Requires unused staging test cart without promotions or payment collection')
 let mismatches=0
 for (const scenario of [
  {name:'real-10-percent-discount',target:'items',type:'percentage',value:10},
  {name:'real-free-shipping',target:'shipping_methods',type:'percentage',value:100},
  {name:'real-one-dollar-discount',target:'items',type:'fixed',value:1},
 ] as const) {
  const target=scenario.target
  const code=`RH-TAX-TEST-${target}-${Date.now()}`
  const {result}=await createPromotionsWorkflow(container).run({input:{promotionsData:[{
   code,type:'standard',status:'active',is_automatic:false,
   application_method:{type:scenario.type,target_type:target,allocation:'across',value:scenario.value,currency_code:'usd'},
  }]}})
  try {
   await updateCartPromotionsWorkflow(container).run({input:{cart_id:args[0],promo_codes:[code],action:PromotionActions.ADD}})
   const cart=await read()
   if (!(Number(cart.discount_total)>0)) throw Error('Promotion did not produce a discount')
   const result=await compareCartTax(cart as unknown as TaxCart,key)
   console.log(JSON.stringify({scenario:scenario.name,discount:Number(cart.discount_total),...result}))
   if(!result.matches) mismatches++
  } finally {
   // Inactivate first, even if removal/recalculation later fails.
   await promotions.updatePromotions({id:result[0].id,status:'inactive'})
   await updateCartPromotionsWorkflow(container).run({input:{cart_id:args[0],promo_codes:[code],action:PromotionActions.REMOVE}})
  }
 }
 const restored=await read()
 if(restored.promotions?.length || Number(restored.discount_total)!==Number(initial.discount_total) || Number(restored.total)!==Number(initial.total)) throw Error('Test cart cleanup needs review')
 console.log(JSON.stringify({cartId:args[0],temporaryPromotionsInactive:true,cartRestored:true,mismatches}))
 if(mismatches) throw Error('Actual promotion tax mismatch; no payment made')
}
