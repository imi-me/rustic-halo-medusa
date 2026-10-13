const fs=require('node:fs/promises');
const {createProductOptionsWorkflow,updateProductVariantsWorkflow}=require('@medusajs/medusa/core-flows');
const confirmed={'prod_01M30YT7PJVBX1HFYP8CJC3KW0':'natural','prod_01M30YTX967KTG9WNJWH43H9KZ':'cbc'};
exports.default=async({container})=>{
 if(process.env.APP_ENV!=='staging'||process.env.CLAW_FOUR_OPTIONS!=='approved')throw Error('Approved staging assignment required');
 const before=JSON.parse(await fs.readFile('/tmp/claw-four-options-before.json','utf8'));
 const products=container.resolve('product');const report={complete:false,products:[],priceWrites:false,inventoryWrites:false};const save=()=>fs.writeFile('/tmp/claw-four-options-report.json',JSON.stringify(report,null,2));await save();
 for(const p of before.products){
  const current=await products.retrieveProduct(p.id,{relations:['images','variants','variants.options','options','options.values']});
  if(JSON.stringify(current.metadata)!==JSON.stringify(p.metadata))throw Error('Product metadata changed '+p.title);
  const config=p.metadata.hair_claw_template_v2;if(!config||config.offer_mode)throw Error('Unexpected template '+p.title);
  const old=p.metadata.hair_claw_overlays_v1||{revision:null,recipes:{}};const media={...old,offer_mode:true,offers:{},draft_prices:{},recipes:{...old.recipes},drafts:{...old.drafts}};let nextConfig={...config,offer_mode:true};
  const finish=confirmed[p.id];
  if(finish){
   const {result:options}=await createProductOptionsWorkflow(container).run({input:{product_options:[{title:'Claw finish',values:['Natural','Colors by Cate'],is_exclusive:true}]}});const option=options[0];await products.addProductOptionToProduct({product_id:p.id,product_option_id:option.id});
   const variants=p.variants.filter(v=>config.variant_ids.includes(v.id));
   for(const size of ['2','4']){
    const group=variants.filter(v=>v.metadata.physical_size===size);if(!group.length)continue;
    if(group.length!==13)throw Error('Unexpected color group '+p.title);
    const key=`${size}-${finish}`;media.offers[key]={variant_ids:group.map(v=>v.id)};
    await updateProductVariantsWorkflow(container).run({input:{product_variants:group.map(v=>({id:v.id,title:`${size} inch · ${finish==='cbc'?'Colors by Cate':'Natural'} / ${v.metadata.base_claw_color}`,options:{...Object.fromEntries(v.options.map(o=>[p.options.find(x=>x.id===o.option_id).title,o.value])),[option.title]:finish==='cbc'?'Colors by Cate':'Natural'},metadata:{...v.metadata,claw_finish:finish}}))}});
    if(old.recipes?.[size]?.enabled)media.recipes[key]={...old.recipes[size],finish};
    if(old.drafts?.[size])media.drafts[key]={...old.drafts[size],finish};
   }
   nextConfig={...nextConfig,finish_option_id:option.id,option_ids:[config.size_option_id,option.id,config.color_option_id]};
  }
  const latest=await products.retrieveProduct(p.id);
  if(JSON.stringify(latest.metadata)!==JSON.stringify(p.metadata))throw Error('Metadata changed while assigning '+p.title);
  await products.updateProducts(p.id,{metadata:{...latest.metadata,hair_claw_template_v2:nextConfig,hair_claw_overlays_v1:media}});
  report.products.push({id:p.id,title:p.title,assignedFinish:finish||null,activeKeys:Object.keys(media.offers).filter(key=>media.recipes[key]?.enabled)});await save();
 }
 report.complete=true;await save();console.log('FOUR_OPTIONS_ASSIGNED',report.products.length);
};
