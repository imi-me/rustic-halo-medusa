const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const canonical=value=>Array.isArray(value)?value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const same=(a,b)=>assert.deepEqual(canonical(a),canonical(b));
const fingerprint=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fields=['id','title','handle','status','updated_at','metadata','options.*','options.values.*','images.*','variants.*','variants.options.*','variants.price_set.prices.*','variants.price_set.prices.price_rules.*','variants.inventory_items.*'];
exports.default=async({container})=>{
 if(process.env.APP_ENV!=='staging'||process.env.CLAW_EXISTING_FOUR_INCH!=='approved')throw Error('Explicit staging-only four-inch approval required.');
 const plan=JSON.parse(await fs.readFile('/tmp/claw-four-inch-catalog-plan.json','utf8'));
 assert.equal(plan.version,1);assert.equal(plan.scope,'existing-four-inch-only');
 const products=container.resolve('product'),query=container.resolve('query'),locking=container.resolve('locking');
 const read=async id=>(await query.graph({entity:'product',filters:{id},fields})).data[0];
 const report={complete:false,startedAt:new Date().toISOString(),products:[],priceWrites:false,variantWrites:false,stockWrites:false,imageWrites:false,statusWrites:false};
 const persist=()=>fs.writeFile('/tmp/claw-four-inch-catalog-report.json',JSON.stringify(report,null,2));
 await persist();
 // Every product must still match the reviewed snapshot before the first write.
 for(const row of plan.products){const p=await products.retrieveProduct(row.id);same(p.metadata,row.expectedMetadata);assert.equal(new Date(p.updated_at).toISOString(),new Date(row.expectedUpdatedAt).toISOString());}
 for(const row of plan.products){await locking.execute('rh-admin-product-identifiers',()=>locking.execute('hair-claw-media:'+row.id,async()=>{
  const before=await read(row.id),config=before.metadata.hair_claw_template_v2;
  same(before.metadata,row.expectedMetadata);assert.equal(new Date(before.updated_at).toISOString(),new Date(row.expectedUpdatedAt).toISOString());
  assert.equal(config.offer_mode,true);assert.equal(Object.keys(before.metadata.hair_claw_overlays_v1?.offers??{}).length,0);
  const ids=new Set(row.variantIds);assert.equal(ids.size,row.variantIds.length);assert.ok(ids.size>0);
  const variants=before.variants.filter(v=>ids.has(v.id));assert.equal(variants.length,ids.size);
  assert.ok(variants.every(v=>config.variant_ids.includes(v.id)&&v.metadata?.physical_size==='4'&&v.metadata?.base_claw_color&&v.price_set.prices.some(p=>!p.price_list_id&&p.currency_code==='usd'&&Number(p.amount)>0)));
  const defaultId=ids.has(config.default_variant_id)?config.default_variant_id:variants.find(v=>v.metadata.base_claw_color==='Taupe')?.id??variants[0].id;
  const next={...config,offer_mode:false,variant_ids:row.variantIds,default_variant_id:defaultId,catalog_approval:{version:1,size:'4',scope:'existing-prices-and-colors',approved_at:plan.approvedAt}};
  await fs.writeFile('/tmp/claw-four-inch-before-'+row.id+'.json',JSON.stringify(before,null,2));
  await products.updateProducts(row.id,{metadata:{...before.metadata,hair_claw_template_v2:next}});
  const after=await read(row.id);
  same(after.variants,before.variants);same(after.options,before.options);same(after.images,before.images);assert.equal(after.status,before.status);
  const metadata={...after.metadata,hair_claw_template_v2:config};same(metadata,before.metadata);
  await fs.writeFile('/tmp/claw-four-inch-after-'+row.id+'.json',JSON.stringify(after,null,2));
  report.products.push({id:row.id,title:row.title,handle:before.handle,status:before.status,activeFourInchVariants:ids.size,sourceVariantRecordsUnchanged:true,beforeHash:fingerprint(before),afterHash:fingerprint(after)});await persist();
 },{timeout:10,expire:120}),{timeout:10,expire:120});}
 report.complete=true;report.completedAt=new Date().toISOString();await persist();console.log('FOUR_INCH_CATALOG_READY',JSON.stringify({products:report.products.length,variants:report.products.reduce((n,p)=>n+p.activeFourInchVariants,0),priceWrites:false,variantWrites:false,stockWrites:false}));
};
