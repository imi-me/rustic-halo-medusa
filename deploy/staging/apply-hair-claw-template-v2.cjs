const fs=require('node:fs/promises');
const {createProductOptionsWorkflow,createProductVariantsWorkflow}=require('@medusajs/medusa/core-flows');
const {hash,key}=require('./plan-hair-claw-template-v2.cjs');
const fields=['id','title','handle','status','updated_at','metadata','options.*','options.values.*','images.*','variants.*','variants.options.*','variants.options.option.title','variants.price_set.id','variants.price_set.prices.*','variants.price_set.prices.price_rules.*','variants.inventory_items.*'];
exports.default=async({container})=>{
 if(process.env.APP_ENV!=='staging'||process.env.CLAW_TEMPLATE_APPLY!=='approved')throw Error('Approved staging execution required');
 const plan=JSON.parse(await fs.readFile('/tmp/claw-template-plan.json','utf8'));
 if(plan.version!==2||plan.policy!=='made_to_order'||plan.palette.length!==13)throw Error('Unexpected template policy');
 const products=container.resolve('product'),query=container.resolve('query');
 const ids=plan.products.map(p=>p.productId);
 const {data:current}=await query.graph({entity:'product',filters:{id:ids},fields});
 const currentById=new Map(current.map(p=>[p.id,p]));
 const skus=plan.products.flatMap(p=>p.additions.map(v=>v.sku));
 const collisions=await products.listProductVariants({sku:skus},{take:5000});
 if(collisions.length)throw Error('Existing template SKUs require reviewing the saved report; no automatic replay');
 for(const p of plan.products)if(!currentById.has(p.productId)||hash(currentById.get(p.productId))!==p.fingerprint)throw Error('Catalog changed; regenerate plan '+p.title);
 const report={startedAt:new Date().toISOString(),complete:false,products:[],originalVariantsModified:false,stockQuantitiesModified:false};
 const save=()=>fs.writeFile('/tmp/claw-template-apply-report.json',JSON.stringify(report,null,2));await save();
 for(const p of plan.products){
  const {data:[fresh]}=await query.graph({entity:'product',filters:{id:p.productId},fields});
  if(hash(fresh)!==p.fingerprint)throw Error('Catalog changed before applying '+p.title);
  const definitions=[{title:'Claw size',values:p.sizeValues,is_exclusive:true,metadata:{purpose:'physical_claw_size',template:plan.template}},{title:'Base color',values:plan.palette,is_exclusive:true,metadata:{purpose:'base_claw_color',template:plan.template}}];
  if(p.finishValues.length)definitions.push({title:p.finishTitle,values:p.finishValues,is_exclusive:true,metadata:{purpose:'design_finish',template:plan.template}});
  const {result:options}=await createProductOptionsWorkflow(container).run({input:{product_options:definitions}});
  for(const option of options)await products.addProductOptionToProduct({product_id:p.productId,product_option_id:option.id});
  const {result:variants}=await createProductVariantsWorkflow(container).run({input:{product_variants:p.additions}});
  if(variants.length!==p.additions.length)throw Error('Variant creation count mismatch');
  const [size,color,finish]=options;
  const defaultVariant=variants.find(v=>v.sku===p.additions.find(a=>a.metadata.physical_size==='4'&&a.metadata.base_claw_color==='Taupe')?.sku)||variants[0];
  const latest=await products.retrieveProduct(p.productId);
  const config={version:2,template:plan.template,policy:plan.policy,palette:plan.palette,variant_ids:variants.map(v=>v.id),option_ids:[size.id,...p.shownOptionIds,...(finish?[finish.id]:[]),color.id],size_option_id:size.id,color_option_id:color.id,default_variant_id:defaultVariant.id,option_titles:p.optionTitles,unlabelled_size:'4',applied_at:new Date().toISOString()};
  await products.updateProducts(p.productId,{metadata:{...latest.metadata,[key]:config}});
  report.products.push({productId:p.productId,title:p.title,variantCount:variants.length,optionIds:options.map(o=>o.id),variantIds:variants.map(v=>v.id),priorMetadata:latest.metadata});await save();
  console.log('CLAW_TEMPLATE_PRODUCT_READY',report.products.length,'of',plan.products.length,p.title,variants.length);
 }
 report.complete=true;report.completedAt=new Date().toISOString();report.newVariantCount=report.products.reduce((s,p)=>s+p.variantCount,0);await save();console.log('CLAW_TEMPLATE_APPLY_COMPLETE',report.products.length,report.newVariantCount);
};
