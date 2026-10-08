exports.default=async({container})=>{
 const db=new URL(process.env.DATABASE_URL||'')
 if(process.env.APP_ENV!=='production'||db.hostname!=='postgres-aw4sntlbsbfsukqtfvccduqm'||db.pathname!=='/rustic_halo_production'||process.env.STRIPE_TAX_LIVE_ENABLED!=='true'||process.env.STRIPE_TAX_REPORTING_LIVE_ENABLED!=='true'||process.env.TAX_COLLECTION_STATE!=='NC'||process.env.PRODUCTION_CHECKOUT_READY==='true'||process.env.STRIPE_LIVE_ENABLED==='true')throw Error('Guarded production tax configuration required')
 const tax=container.resolve('tax'),regions=container.resolve('region')
 const provider='tp_stripe-tax-live_stripe'
 if((await tax.listTaxProviders({id:provider})).length!==1)throw Error('Live provider missing')
 const all=await tax.listTaxRegions({},{take:100})
 if(all.some(r=>r.country_code!=='us'||r.province_code||r.parent_id)||(all.length>1))throw Error('Existing tax regions require review')
 const commerce=await regions.listRegions({},{relations:['countries']})
 if(commerce.length!==1||commerce[0].countries.length!==1||commerce[0].countries[0].iso_2!=='us')throw Error('Commerce region changed')
 console.log('RH_PRODUCTION_TAX '+JSON.stringify({mode:process.env.RH_TAX_APPLY==='yes'?'apply':'dry-run',existingTaxRegions:all.map(r=>({id:r.id,provider:r.provider_id})),region:commerce[0].id,automaticTaxes:commerce[0].automatic_taxes,checkoutBlocked:true}))
 if(process.env.RH_TAX_APPLY!=='yes')return
 if(all.length)await tax.updateTaxRegions({id:all[0].id,provider_id:provider})
 else await tax.createTaxRegions({country_code:'us',provider_id:provider})
 await regions.updateRegions(commerce[0].id,{automatic_taxes:true})
 console.log('RH_PRODUCTION_TAX '+JSON.stringify({mode:'applied',provider,collectionState:'NC',automaticTaxes:true,checkoutBlocked:true}))
}
